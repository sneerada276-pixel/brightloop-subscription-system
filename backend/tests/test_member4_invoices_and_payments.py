"""
Unit Tests for Member 4: Invoicing, Taxes, Discounts, Payments, and Dashboard Stats.
Tests all endpoints in backend/routes/invoice_routes.py.
"""

import sys
import os
import unittest
import json
from datetime import datetime, timezone, timedelta

# Ensure backend directory is in python path
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app import create_app
from models import db, User, Customer, Plan, Tax, Discount, Invoice, Payment, Subscription
from routes.auth_routes import auth_bp
from routes.invoice_routes import invoice_bp


class Member4InvoicesPaymentsTestCase(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app = create_app()
        cls.app.config['TESTING'] = True
        cls.app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'
        cls.app.config['SECRET_KEY'] = 'test-secret-key-member4'

        # Register invoice_bp with /api prefix for testing
        cls.app.register_blueprint(invoice_bp, url_prefix='/api')

        with cls.app.app_context():
            db.create_all()

        cls.client = cls.app.test_client()

    def setUp(self):
        with self.app.app_context():
            db.session.remove()
            db.drop_all()
            db.create_all()

            # 1. Seed Admin
            admin_res = self.client.post('/api/auth/login', json={
                'email': 'admin@brightloop.io',
                'password': 'Admin@BrightLoop2026!'
            })
            self.admin_token = admin_res.get_json()['token']

            # 2. Seed Staff
            self.client.post('/api/users/staff', json={
                'username': 'staff_billing',
                'email': 'billing_staff@brightloop.io',
                'password': 'StaffPassword2026!',
                'role': 'staff'
            }, headers={'Authorization': f'Bearer {self.admin_token}'})

            staff_res = self.client.post('/api/auth/login', json={
                'email': 'billing_staff@brightloop.io',
                'password': 'StaffPassword2026!'
            })
            self.staff_token = staff_res.get_json()['token']

            # 3. Seed Customer 1 (Tesla)
            cust1_res = self.client.post('/api/auth/register-customer', json={
                'name': 'Tesla Inc',
                'username': 'tesla_corp',
                'email': 'ap@tesla.com',
                'password': 'CustomerPassword2026!',
                'company': 'Tesla Motors',
                'phone': '+18005550199'
            })
            self.cust1_token = cust1_res.get_json()['token']
            cust1_profile = Customer.query.filter_by(email='ap@tesla.com').first()
            self.customer1_id = cust1_profile.id

            # 4. Seed Customer 2 (SpaceX)
            cust2_res = self.client.post('/api/auth/register-customer', json={
                'name': 'SpaceX',
                'username': 'spacex_corp',
                'email': 'finance@spacex.com',
                'password': 'CustomerPassword2026!',
                'company': 'Space Exploration Technologies'
            })
            self.cust2_token = cust2_res.get_json()['token']
            cust2_profile = Customer.query.filter_by(email='finance@spacex.com').first()
            self.customer2_id = cust2_profile.id

            # 5. Seed Tax Rule
            tax = Tax(name='GST 18%', rate=18.0, is_active=True)
            db.session.add(tax)
            db.session.commit()
            self.tax_id = tax.id

            # 6. Seed Discount Code
            discount = Discount(
                code='SUMMER20',
                discount_type='percentage',
                value=20.0,
                min_purchase_amount=50.0,
                valid_from=datetime.now(timezone.utc) - timedelta(days=1),
                valid_to=datetime.now(timezone.utc) + timedelta(days=30),
                usage_limit=100,
                used_count=0,
                is_active=True
            )
            db.session.add(discount)
            db.session.commit()
            self.discount_id = discount.id

    # -------------------------------------------------------------------------
    # 1. Taxes Tests
    # -------------------------------------------------------------------------

    def test_01_tax_creation_and_listing(self):
        """Test creating and listing taxes with RBAC."""
        # Customer cannot create tax
        unauth_res = self.client.post('/api/taxes', json={
            'name': 'VAT 5%',
            'rate': 5.0
        }, headers={'Authorization': f'Bearer {self.cust1_token}'})
        self.assertEqual(unauth_res.status_code, 403)

        # Staff can create tax
        res = self.client.post('/api/taxes', json={
            'name': 'VAT 5%',
            'rate': 5.0,
            'is_active': True
        }, headers={'Authorization': f'Bearer {self.staff_token}'})
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.get_json()['tax']['name'], 'VAT 5%')
        self.assertEqual(res.get_json()['tax']['rate'], 5.0)

        # List taxes
        list_res = self.client.get('/api/taxes', headers={
            'Authorization': f'Bearer {self.cust1_token}'
        })
        self.assertEqual(list_res.status_code, 200)
        self.assertGreaterEqual(list_res.get_json()['count'], 2)

    # -------------------------------------------------------------------------
    # 2. Discounts Tests
    # -------------------------------------------------------------------------

    def test_02_discount_creation_and_validation(self):
        """Test creating a discount code, uniqueness, and validation endpoint."""
        # Staff creates a fixed discount code
        res = self.client.post('/api/discounts', json={
            'code': 'FLAT10',
            'discount_type': 'fixed',
            'value': 10.0,
            'min_purchase_amount': 30.0,
            'usage_limit': 50
        }, headers={'Authorization': f'Bearer {self.staff_token}'})
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.get_json()['discount']['code'], 'FLAT10')

        # Duplicate discount code returns 409 Conflict
        dup_res = self.client.post('/api/discounts', json={
            'code': 'FLAT10',
            'discount_type': 'fixed',
            'value': 10.0
        }, headers={'Authorization': f'Bearer {self.admin_token}'})
        self.assertEqual(dup_res.status_code, 409)

        # Validate SUMMER20 with subtotal 100 (percentage 20% -> 20.00 discount)
        val_res = self.client.post('/api/discounts/validate', json={
            'code': 'SUMMER20',
            'subtotal': 100.00
        }, headers={'Authorization': f'Bearer {self.cust1_token}'})
        self.assertEqual(val_res.status_code, 200)
        self.assertTrue(val_res.get_json()['valid'])
        self.assertEqual(val_res.get_json()['discount_amount'], 20.00)
        self.assertEqual(val_res.get_json()['subtotal_after_discount'], 80.00)

        # Subtotal below minimum purchase threshold fails validation
        low_res = self.client.post('/api/discounts/validate', json={
            'code': 'SUMMER20',
            'subtotal': 20.00  # min is 50
        }, headers={'Authorization': f'Bearer {self.cust1_token}'})
        self.assertEqual(low_res.status_code, 400)
        self.assertIn('minimum purchase', low_res.get_json()['error'])

    # -------------------------------------------------------------------------
    # 3. Invoices Tests
    # -------------------------------------------------------------------------

    def test_03_create_invoice_and_formula_calculation(self):
        """
        Test creating an invoice with tax and discount calculation:
        total_amount = round(subtotal + tax_amount - discount_amount, 2).
        """
        payload = {
            'invoice_number': 'INV-2026-0001',
            'customer_id': self.customer1_id,
            'subtotal': 100.00,
            'tax_id': self.tax_id,      # 18% of 100 = 18.00
            'discount_code': 'SUMMER20', # 20% of 100 = 20.00
            'status': 'draft'
        }
        res = self.client.post('/api/invoices', json=payload, headers={
            'Authorization': f'Bearer {self.staff_token}'
        })
        self.assertEqual(res.status_code, 201)
        inv = res.get_json()['invoice']
        self.assertEqual(inv['invoice_number'], 'INV-2026-0001')
        self.assertEqual(inv['subtotal'], 100.00)
        self.assertEqual(inv['tax_amount'], 18.00)
        self.assertEqual(inv['discount_amount'], 20.00)
        self.assertEqual(inv['total_amount'], 98.00)  # 100 + 18 - 20 = 98.00
        self.assertEqual(inv['status'], 'draft')

        # Duplicate invoice_number -> 409 Conflict
        dup_res = self.client.post('/api/invoices', json=payload, headers={
            'Authorization': f'Bearer {self.admin_token}'
        })
        self.assertEqual(dup_res.status_code, 409)

    def test_04_invoice_rbac_and_status_filtering(self):
        """Test customer only sees their own invoices while staff sees all."""
        with self.app.app_context():
            inv1 = Invoice(
                invoice_number='INV-TESLA-01',
                customer_id=self.customer1_id,
                subtotal=200.00,
                total_amount=200.00,
                status='pending',
                issue_date=datetime.now(timezone.utc),
                due_date=datetime.now(timezone.utc) + timedelta(days=15)
            )
            inv2 = Invoice(
                invoice_number='INV-SPACEX-01',
                customer_id=self.customer2_id,
                subtotal=500.00,
                total_amount=500.00,
                status='paid',
                issue_date=datetime.now(timezone.utc),
                due_date=datetime.now(timezone.utc) + timedelta(days=15)
            )
            db.session.add_all([inv1, inv2])
            db.session.commit()
            inv2_id = inv2.id

        # Admin sees all (2)
        admin_res = self.client.get('/api/invoices', headers={
            'Authorization': f'Bearer {self.admin_token}'
        })
        self.assertEqual(admin_res.status_code, 200)
        self.assertEqual(admin_res.get_json()['count'], 2)

        # Filter by status='paid'
        filter_res = self.client.get('/api/invoices?status=paid', headers={
            'Authorization': f'Bearer {self.admin_token}'
        })
        self.assertEqual(filter_res.get_json()['count'], 1)
        self.assertEqual(filter_res.get_json()['invoices'][0]['invoice_number'], 'INV-SPACEX-01')

        # Customer 1 sees only their own (1)
        cust1_res = self.client.get('/api/invoices', headers={
            'Authorization': f'Bearer {self.cust1_token}'
        })
        self.assertEqual(cust1_res.status_code, 200)
        self.assertEqual(cust1_res.get_json()['count'], 1)
        self.assertEqual(cust1_res.get_json()['invoices'][0]['invoice_number'], 'INV-TESLA-01')

        # Customer 1 cannot access SpaceX's invoice (403)
        unauth_get = self.client.get(f'/api/invoices/{inv2_id}', headers={
            'Authorization': f'Bearer {self.cust1_token}'
        })
        self.assertEqual(unauth_get.status_code, 403)

    def test_05_send_and_cancel_invoice(self):
        """Test transitioning invoice status to sent (pending) and cancelled."""
        with self.app.app_context():
            inv = Invoice(
                invoice_number='INV-DRAFT-01',
                customer_id=self.customer1_id,
                subtotal=80.00,
                total_amount=80.00,
                status='draft',
                issue_date=datetime.now(timezone.utc),
                due_date=datetime.now(timezone.utc) + timedelta(days=15)
            )
            db.session.add(inv)
            db.session.commit()
            inv_id = inv.id

        # Send invoice (draft -> pending)
        send_res = self.client.post(f'/api/invoices/{inv_id}/send', headers={
            'Authorization': f'Bearer {self.staff_token}'
        })
        self.assertEqual(send_res.status_code, 200)
        self.assertEqual(send_res.get_json()['invoice']['status'], 'pending')

        # Cancel invoice (pending -> cancelled)
        cancel_res = self.client.post(f'/api/invoices/{inv_id}/cancel', headers={
            'Authorization': f'Bearer {self.staff_token}'
        })
        self.assertEqual(cancel_res.status_code, 200)
        self.assertEqual(cancel_res.get_json()['invoice']['status'], 'cancelled')

    # -------------------------------------------------------------------------
    # 4. Payments Tests
    # -------------------------------------------------------------------------

    def test_06_record_payment_and_auto_invoice_paid(self):
        """
        Test recording payment for an invoice with unique transaction_id.
        Verifies that if status='success', linked invoice status is automatically
        transitioned to 'paid'!
        """
        with self.app.app_context():
            inv = Invoice(
                invoice_number='INV-PAY-01',
                customer_id=self.customer1_id,
                subtotal=150.00,
                total_amount=150.00,
                status='pending',
                issue_date=datetime.now(timezone.utc),
                due_date=datetime.now(timezone.utc) + timedelta(days=15)
            )
            db.session.add(inv)
            db.session.commit()
            inv_id = inv.id

        # Customer records successful credit card payment
        pay_payload = {
            'invoice_id': inv_id,
            'amount': 150.00,
            'payment_method': 'credit_card',
            'transaction_id': 'TXN-CARD-9999',
            'status': 'success',
            'notes': 'Stripe payment auth #4561'
        }
        res = self.client.post('/api/payments', json=pay_payload, headers={
            'Authorization': f'Bearer {self.cust1_token}'
        })
        self.assertEqual(res.status_code, 201)
        data = res.get_json()

        # Payment details
        self.assertEqual(data['payment']['transaction_id'], 'TXN-CARD-9999')
        self.assertEqual(data['payment']['status'], 'success')

        # Linked invoice automatically becomes 'paid'
        self.assertEqual(data['invoice']['status'], 'paid')

        # Duplicate transaction_id -> 409 Conflict
        dup_pay = self.client.post('/api/payments', json=pay_payload, headers={
            'Authorization': f'Bearer {self.admin_token}'
        })
        self.assertEqual(dup_pay.status_code, 409)

    def test_07_payment_refund(self):
        """Test refunding a payment by admin."""
        with self.app.app_context():
            inv = Invoice(
                invoice_number='INV-REFUND-01',
                customer_id=self.customer1_id,
                subtotal=75.00,
                total_amount=75.00,
                status='paid',
                issue_date=datetime.now(timezone.utc),
                due_date=datetime.now(timezone.utc) + timedelta(days=15)
            )
            db.session.add(inv)
            db.session.commit()

            pay = Payment(
                invoice_id=inv.id,
                amount=75.00,
                payment_method='upi',
                transaction_id='TXN-UPI-8888',
                status='success'
            )
            db.session.add(pay)
            db.session.commit()
            pay_id = pay.id

        # Non-admin cannot refund (403)
        unauth_ref = self.client.post(f'/api/payments/{pay_id}/refund', headers={
            'Authorization': f'Bearer {self.staff_token}'
        })
        self.assertEqual(unauth_ref.status_code, 403)

        # Admin refunds
        ref_res = self.client.post(f'/api/payments/{pay_id}/refund', headers={
            'Authorization': f'Bearer {self.admin_token}'
        })
        self.assertEqual(ref_res.status_code, 200)
        self.assertEqual(ref_res.get_json()['payment']['status'], 'refunded')

    # -------------------------------------------------------------------------
    # 5. Dashboard Metrics & MRR Calculation Tests
    # -------------------------------------------------------------------------

    def test_08_dashboard_metrics_and_mrr_calculation(self):
        """
        Test /api/dashboard/stats:
        - active_subscriptions count
        - total_revenue (sum of successful payments)
        - overdue_invoices count & amount
        - MRR normalization:
          - Daily $10 * 30 = $300 MRR
          - Monthly $50 * 1 = $50 MRR
          - Yearly $1200 / 12 = $100 MRR
          Total MRR = $450.00
        """
        with self.app.app_context():
            # 1. Plans
            p_daily = Plan(name='Daily', price=10.0, billing_interval='daily', is_active=True)
            p_monthly = Plan(name='Monthly', price=50.0, billing_interval='monthly', is_active=True)
            p_yearly = Plan(name='Yearly', price=1200.0, billing_interval='yearly', is_active=True)
            db.session.add_all([p_daily, p_monthly, p_yearly])
            db.session.commit()

            # 2. Subscriptions
            now = datetime.now(timezone.utc)
            s1 = Subscription(customer_id=self.customer1_id, plan_id=p_daily.id, status='active', current_period_end=now + timedelta(days=1))
            s2 = Subscription(customer_id=self.customer1_id, plan_id=p_monthly.id, status='renewed', current_period_end=now + timedelta(days=30))
            s3 = Subscription(customer_id=self.customer2_id, plan_id=p_yearly.id, status='active', current_period_end=now + timedelta(days=365))
            s4_closed = Subscription(customer_id=self.customer2_id, plan_id=p_monthly.id, status='closed', current_period_end=now)
            db.session.add_all([s1, s2, s3, s4_closed])

            # 3. Invoices (1 overdue, 1 pending)
            inv_overdue = Invoice(
                invoice_number='INV-OVERDUE-01',
                customer_id=self.customer1_id,
                subtotal=120.00,
                total_amount=120.00,
                status='pending',
                issue_date=now - timedelta(days=40),
                due_date=now - timedelta(days=10) # Overdue!
            )
            inv_pending = Invoice(
                invoice_number='INV-CURRENT-01',
                customer_id=self.customer2_id,
                subtotal=80.00,
                total_amount=80.00,
                status='pending',
                issue_date=now,
                due_date=now + timedelta(days=20)
            )
            db.session.add_all([inv_overdue, inv_pending])
            db.session.commit()

            # 4. Successful Payment ($250.00)
            pay = Payment(
                invoice_id=inv_overdue.id,
                amount=250.00,
                payment_method='bank_transfer',
                transaction_id='TXN-REV-100',
                status='success'
            )
            db.session.add(pay)
            db.session.commit()

        # Query stats
        res = self.client.get('/api/dashboard/stats', headers={
            'Authorization': f'Bearer {self.admin_token}'
        })
        self.assertEqual(res.status_code, 200)
        stats = res.get_json()

        # Active subscriptions: s1, s2, s3 = 3 (s4 is closed)
        self.assertEqual(stats['active_subscriptions'], 3)

        # MRR: 10*30 (300) + 50*1 (50) + 1200/12 (100) = 450.00
        self.assertEqual(stats['mrr'], 450.00)
        self.assertEqual(stats['arr'], 450.00 * 12.0)

        # Revenue
        self.assertEqual(stats['total_revenue'], 250.00)

        # Overdue invoices
        self.assertEqual(stats['overdue_invoices_count'], 1)
        self.assertEqual(stats['overdue_amount'], 120.00)


if __name__ == '__main__':
    unittest.main()

