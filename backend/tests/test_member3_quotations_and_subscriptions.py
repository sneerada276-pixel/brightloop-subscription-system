"""
Unit Tests for Member 3: Quotations, Quotation Templates, and Subscription Lifecycle.
Tests all endpoints in backend/routes/subscription_routes.py.
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
from models import db, User, Customer, Plan, Product, QuotationTemplate, Quotation, Subscription
from routes.auth_routes import auth_bp
from routes.subscription_routes import subscription_bp


class Member3QuotationsSubscriptionsTestCase(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app = create_app()
        cls.app.config['TESTING'] = True
        cls.app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'
        cls.app.config['SECRET_KEY'] = 'test-secret-key-member3'

        # Register subscription_bp with /api prefix for testing
        if 'subscriptions' not in cls.app.blueprints:
            cls.app.register_blueprint(subscription_bp, url_prefix='/api')

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
                'username': 'staff_sam',
                'email': 'sam@brightloop.io',
                'password': 'StaffPassword2026!',
                'role': 'staff'
            }, headers={'Authorization': f'Bearer {self.admin_token}'})

            staff_res = self.client.post('/api/auth/login', json={
                'email': 'sam@brightloop.io',
                'password': 'StaffPassword2026!'
            })
            self.staff_token = staff_res.get_json()['token']

            # 3. Seed Customer 1
            cust1_res = self.client.post('/api/auth/register-customer', json={
                'name': 'Acme Corporation',
                'username': 'acme_user',
                'email': 'billing@acme.com',
                'password': 'CustomerPassword2026!',
                'company': 'Acme Corp',
                'phone': '+1234567890'
            })
            self.cust1_token = cust1_res.get_json()['token']
            cust1_profile = Customer.query.filter_by(email='billing@acme.com').first()
            self.customer1_id = cust1_profile.id

            # 4. Seed Customer 2
            cust2_res = self.client.post('/api/auth/register-customer', json={
                'name': 'Globex Inc',
                'username': 'globex_user',
                'email': 'contact@globex.com',
                'password': 'CustomerPassword2026!',
                'company': 'Globex'
            })
            self.cust2_token = cust2_res.get_json()['token']
            cust2_profile = Customer.query.filter_by(email='contact@globex.com').first()
            self.customer2_id = cust2_profile.id

            # 5. Seed Plans with various intervals
            plan_m = Plan(name='Pro Monthly', price=49.00, billing_interval='monthly', is_active=True)
            plan_y = Plan(name='Enterprise Annual', price=499.00, billing_interval='yearly', is_active=True)
            plan_w = Plan(name='Weekly Pass', price=15.00, billing_interval='weekly', is_active=True)
            plan_d = Plan(name='Daily Pass', price=5.00, billing_interval='daily', is_active=True)
            db.session.add_all([plan_m, plan_y, plan_w, plan_d])
            db.session.commit()

            self.plan_monthly_id = plan_m.id
            self.plan_yearly_id = plan_y.id
            self.plan_weekly_id = plan_w.id
            self.plan_daily_id = plan_d.id

    # -------------------------------------------------------------------------
    # Quotation Templates Tests
    # -------------------------------------------------------------------------

    def test_01_create_and_list_quotation_template(self):
        """Test creating and listing quotation templates."""
        # Non-staff cannot create
        res = self.client.post('/api/quotation-templates', json={
            'name': 'Standard Terms',
            'terms_conditions': 'Net 30 days',
            'default_validity_days': 30
        }, headers={'Authorization': f'Bearer {self.cust1_token}'})
        self.assertEqual(res.status_code, 403)

        # Staff can create
        res = self.client.post('/api/quotation-templates', json={
            'name': 'Standard Terms',
            'terms_conditions': 'Net 30 days payment terms apply.',
            'default_validity_days': 45
        }, headers={'Authorization': f'Bearer {self.staff_token}'})
        self.assertEqual(res.status_code, 201)
        data = res.get_json()
        self.assertEqual(data['template']['name'], 'Standard Terms')
        self.assertEqual(data['template']['default_validity_days'], 45)

        # List templates
        list_res = self.client.get('/api/quotation-templates', headers={
            'Authorization': f'Bearer {self.admin_token}'
        })
        self.assertEqual(list_res.status_code, 200)
        self.assertGreaterEqual(list_res.get_json()['count'], 1)

    # -------------------------------------------------------------------------
    # Quotations Tests
    # -------------------------------------------------------------------------

    def test_02_create_quotation_and_uniqueness(self):
        """Test creating a quotation and enforcing unique quotation_number."""
        with self.app.app_context():
            tpl = QuotationTemplate(name='Enterprise Terms', default_validity_days=20)
            db.session.add(tpl)
            db.session.commit()
            tpl_id = tpl.id

        # Staff creates quotation
        payload = {
            'quotation_number': 'QT-2026-0001',
            'customer_id': self.customer1_id,
            'plan_id': self.plan_monthly_id,
            'template_id': tpl_id,
            'total_amount': 45.00
        }
        res = self.client.post('/api/quotations', json=payload, headers={
            'Authorization': f'Bearer {self.staff_token}'
        })
        self.assertEqual(res.status_code, 201)
        data = res.get_json()['quotation']
        self.assertEqual(data['quotation_number'], 'QT-2026-0001')
        self.assertEqual(data['status'], 'draft')
        self.assertEqual(data['total_amount'], 45.00)
        self.assertIsNotNone(data['valid_until'])

        # Duplicate quotation_number returns 409 Conflict
        dup_res = self.client.post('/api/quotations', json=payload, headers={
            'Authorization': f'Bearer {self.admin_token}'
        })
        self.assertEqual(dup_res.status_code, 409)
        self.assertIn('already exists', dup_res.get_json()['error'])

    def test_03_quotations_rbac_and_filtering(self):
        """Test that customers only see their quotations while staff sees all."""
        with self.app.app_context():
            q1 = Quotation(
                quotation_number='QT-ACME-01',
                customer_id=self.customer1_id,
                plan_id=self.plan_monthly_id,
                status='sent',
                total_amount=49.00
            )
            q2 = Quotation(
                quotation_number='QT-GLOBEX-01',
                customer_id=self.customer2_id,
                plan_id=self.plan_yearly_id,
                status='draft',
                total_amount=499.00
            )
            db.session.add_all([q1, q2])
            db.session.commit()

        # Admin sees all (2)
        admin_res = self.client.get('/api/quotations', headers={
            'Authorization': f'Bearer {self.admin_token}'
        })
        self.assertEqual(admin_res.status_code, 200)
        self.assertEqual(admin_res.get_json()['count'], 2)

        # Admin filter by ?status=sent
        filter_res = self.client.get('/api/quotations?status=sent', headers={
            'Authorization': f'Bearer {self.admin_token}'
        })
        self.assertEqual(filter_res.get_json()['count'], 1)
        self.assertEqual(filter_res.get_json()['quotations'][0]['quotation_number'], 'QT-ACME-01')

        # Customer 1 sees only their quotation (1)
        cust1_res = self.client.get('/api/quotations', headers={
            'Authorization': f'Bearer {self.cust1_token}'
        })
        self.assertEqual(cust1_res.status_code, 200)
        self.assertEqual(cust1_res.get_json()['count'], 1)
        self.assertEqual(cust1_res.get_json()['quotations'][0]['quotation_number'], 'QT-ACME-01')

    def test_04_quotation_send_and_update(self):
        """Test updating and sending quotations."""
        with self.app.app_context():
            q = Quotation(
                quotation_number='QT-SEND-01',
                customer_id=self.customer1_id,
                plan_id=self.plan_monthly_id,
                status='draft',
                total_amount=49.00
            )
            db.session.add(q)
            db.session.commit()
            q_id = q.id

        # Update quotation
        up_res = self.client.put(f'/api/quotations/{q_id}', json={
            'total_amount': 42.00
        }, headers={'Authorization': f'Bearer {self.staff_token}'})
        self.assertEqual(up_res.status_code, 200)
        self.assertEqual(up_res.get_json()['quotation']['total_amount'], 42.00)

        # Send quotation
        send_res = self.client.post(f'/api/quotations/{q_id}/send', headers={
            'Authorization': f'Bearer {self.staff_token}'
        })
        self.assertEqual(send_res.status_code, 200)
        self.assertEqual(send_res.get_json()['quotation']['status'], 'sent')

        # Cannot send already sent quotation
        send_again = self.client.post(f'/api/quotations/{q_id}/send', headers={
            'Authorization': f'Bearer {self.staff_token}'
        })
        self.assertEqual(send_again.status_code, 400)

    # -------------------------------------------------------------------------
    # Quotation Acceptance -> Subscription Conversion & Dynamic Period Calculation
    # -------------------------------------------------------------------------

    def test_05_accept_quotation_and_convert_to_subscription(self):
        """
        Test that accepting a quotation transitions it to 'accepted' AND automatically
        creates an active Subscription with correct billing period calculation.
        """
        with self.app.app_context():
            q_monthly = Quotation(
                quotation_number='QT-CONVERT-M',
                customer_id=self.customer1_id,
                plan_id=self.plan_monthly_id,
                status='sent',
                total_amount=49.00,
                valid_until=datetime.now(timezone.utc) + timedelta(days=15)
            )
            db.session.add(q_monthly)
            db.session.commit()
            q_id = q_monthly.id

        # Customer accepts their quotation
        accept_res = self.client.post(f'/api/quotations/{q_id}/accept', headers={
            'Authorization': f'Bearer {self.cust1_token}'
        })
        self.assertEqual(accept_res.status_code, 200)
        res_data = accept_res.get_json()

        # Quotation is accepted
        self.assertEqual(res_data['quotation']['status'], 'accepted')

        # Subscription is automatically created
        sub = res_data['subscription']
        self.assertIsNotNone(sub)
        self.assertEqual(sub['status'], 'active')
        self.assertEqual(sub['customer_id'], self.customer1_id)
        self.assertEqual(sub['plan_id'], self.plan_monthly_id)
        self.assertEqual(sub['quotation_id'], q_id)

        # Check billing interval dynamic calculation (monthly -> +30 days)
        start_dt = datetime.fromisoformat(sub['current_period_start'].replace('Z', '+00:00'))
        end_dt = datetime.fromisoformat(sub['current_period_end'].replace('Z', '+00:00'))
        delta_days = (end_dt.date() - start_dt.date()).days
        self.assertEqual(delta_days, 30)

        # Cannot accept again
        again_res = self.client.post(f'/api/quotations/{q_id}/accept', headers={
            'Authorization': f'Bearer {self.cust1_token}'
        })
        self.assertEqual(again_res.status_code, 400)

    def test_06_dynamic_period_calculation_intervals(self):
        """Test dynamic billing period calculation for daily, weekly, and yearly intervals."""
        with self.app.app_context():
            q_yearly = Quotation(
                quotation_number='QT-CONVERT-Y',
                customer_id=self.customer1_id,
                plan_id=self.plan_yearly_id,
                status='sent',
                total_amount=499.00
            )
            q_weekly = Quotation(
                quotation_number='QT-CONVERT-W',
                customer_id=self.customer1_id,
                plan_id=self.plan_weekly_id,
                status='sent',
                total_amount=15.00
            )
            q_daily = Quotation(
                quotation_number='QT-CONVERT-D',
                customer_id=self.customer1_id,
                plan_id=self.plan_daily_id,
                status='sent',
                total_amount=5.00
            )
            db.session.add_all([q_yearly, q_weekly, q_daily])
            db.session.commit()
            y_id = q_yearly.id
            w_id = q_weekly.id
            d_id = q_daily.id

        # Yearly test
        res_y = self.client.post(f'/api/quotations/{y_id}/accept', headers={
            'Authorization': f'Bearer {self.staff_token}'
        })
        sub_y = res_y.get_json()['subscription']
        delta_y = (datetime.fromisoformat(sub_y['current_period_end'].replace('Z', '+00:00')).date() -
                   datetime.fromisoformat(sub_y['current_period_start'].replace('Z', '+00:00')).date()).days
        self.assertEqual(delta_y, 365)

        # Weekly test
        res_w = self.client.post(f'/api/quotations/{w_id}/accept', headers={
            'Authorization': f'Bearer {self.staff_token}'
        })
        sub_w = res_w.get_json()['subscription']
        delta_w = (datetime.fromisoformat(sub_w['current_period_end'].replace('Z', '+00:00')).date() -
                   datetime.fromisoformat(sub_w['current_period_start'].replace('Z', '+00:00')).date()).days
        self.assertEqual(delta_w, 7)

        # Daily test
        res_d = self.client.post(f'/api/quotations/{d_id}/accept', headers={
            'Authorization': f'Bearer {self.staff_token}'
        })
        sub_d = res_d.get_json()['subscription']
        delta_d = (datetime.fromisoformat(sub_d['current_period_end'].replace('Z', '+00:00')).date() -
                   datetime.fromisoformat(sub_d['current_period_start'].replace('Z', '+00:00')).date()).days
        self.assertEqual(delta_d, 1)

    def test_07_reject_quotation(self):
        """Test rejecting a quotation."""
        with self.app.app_context():
            q = Quotation(
                quotation_number='QT-REJECT-01',
                customer_id=self.customer1_id,
                plan_id=self.plan_monthly_id,
                status='sent',
                total_amount=49.00
            )
            db.session.add(q)
            db.session.commit()
            q_id = q.id

        rej_res = self.client.post(f'/api/quotations/{q_id}/reject', headers={
            'Authorization': f'Bearer {self.cust1_token}'
        })
        self.assertEqual(rej_res.status_code, 200)
        self.assertEqual(rej_res.get_json()['quotation']['status'], 'rejected')

    # -------------------------------------------------------------------------
    # Subscription Lifecycle Tests (Pause, Resume, Renew, Cancel)
    # -------------------------------------------------------------------------

    def test_08_create_subscription_directly(self):
        """Test creating a subscription directly by admin/staff."""
        payload = {
            'customer_id': self.customer2_id,
            'plan_id': self.plan_monthly_id,
            'auto_renew': True,
            'status': 'active'
        }
        res = self.client.post('/api/subscriptions', json=payload, headers={
            'Authorization': f'Bearer {self.staff_token}'
        })
        self.assertEqual(res.status_code, 201)
        sub = res.get_json()['subscription']
        self.assertEqual(sub['status'], 'active')
        self.assertEqual(sub['customer_id'], self.customer2_id)
        self.assertTrue(sub['auto_renew'])

    def test_09_pause_and_resume_subscription(self):
        """Test pausing and resuming subscription lifecycle."""
        with self.app.app_context():
            sub = Subscription(
                customer_id=self.customer1_id,
                plan_id=self.plan_monthly_id,
                status='active',
                current_period_start=datetime.now(timezone.utc),
                current_period_end=datetime.now(timezone.utc) + timedelta(days=30)
            )
            db.session.add(sub)
            db.session.commit()
            sub_id = sub.id

        # Pause subscription (admin/staff only)
        pause_res = self.client.post(f'/api/subscriptions/{sub_id}/pause', headers={
            'Authorization': f'Bearer {self.staff_token}'
        })
        self.assertEqual(pause_res.status_code, 200)
        paused_data = pause_res.get_json()['subscription']
        self.assertEqual(paused_data['status'], 'paused')
        self.assertIsNotNone(paused_data['pause_date'])

        # Cannot pause again
        dup_pause = self.client.post(f'/api/subscriptions/{sub_id}/pause', headers={
            'Authorization': f'Bearer {self.staff_token}'
        })
        self.assertEqual(dup_pause.status_code, 400)

        # Resume subscription
        resume_res = self.client.post(f'/api/subscriptions/{sub_id}/resume', headers={
            'Authorization': f'Bearer {self.staff_token}'
        })
        self.assertEqual(resume_res.status_code, 200)
        resumed_data = resume_res.get_json()['subscription']
        self.assertEqual(resumed_data['status'], 'active')

    def test_10_renew_subscription(self):
        """Test renewing subscription advances current period end based on plan interval."""
        start_now = datetime.now(timezone.utc)
        initial_end = start_now + timedelta(days=30)
        with self.app.app_context():
            sub = Subscription(
                customer_id=self.customer1_id,
                plan_id=self.plan_monthly_id,
                status='active',
                current_period_start=start_now,
                current_period_end=initial_end
            )
            db.session.add(sub)
            db.session.commit()
            sub_id = sub.id

        # Renew subscription
        renew_res = self.client.post(f'/api/subscriptions/{sub_id}/renew', headers={
            'Authorization': f'Bearer {self.admin_token}'
        })
        self.assertEqual(renew_res.status_code, 200)
        renewed_sub = renew_res.get_json()['subscription']
        self.assertEqual(renewed_sub['status'], 'renewed')

        # Verify period advanced by 30 days
        new_end_dt = datetime.fromisoformat(renewed_sub['current_period_end'].replace('Z', '+00:00'))
        self.assertEqual(new_end_dt.date(), (initial_end + timedelta(days=30)).date())

    def test_11_cancel_subscription_with_reason(self):
        """Test closing/cancelling a subscription with reason (admin, staff, or customer)."""
        with self.app.app_context():
            sub = Subscription(
                customer_id=self.customer1_id,
                plan_id=self.plan_monthly_id,
                status='active',
                current_period_start=datetime.now(timezone.utc),
                current_period_end=datetime.now(timezone.utc) + timedelta(days=30)
            )
            db.session.add(sub)
            db.session.commit()
            sub_id = sub.id

        # Customer 2 cannot cancel Customer 1's subscription (403)
        unauth_res = self.client.post(f'/api/subscriptions/{sub_id}/cancel', json={
            'cancellation_reason': 'Not my subscription'
        }, headers={'Authorization': f'Bearer {self.cust2_token}'})
        self.assertEqual(unauth_res.status_code, 403)

        # Customer 1 cancels their own subscription
        cancel_res = self.client.post(f'/api/subscriptions/{sub_id}/cancel', json={
            'cancellation_reason': 'Company downsizing'
        }, headers={'Authorization': f'Bearer {self.cust1_token}'})
        self.assertEqual(cancel_res.status_code, 200)
        closed_sub = cancel_res.get_json()['subscription']
        self.assertEqual(closed_sub['status'], 'closed')
        self.assertEqual(closed_sub['cancellation_reason'], 'Company downsizing')
        self.assertFalse(closed_sub['auto_renew'])

        # Cannot cancel an already closed subscription
        dup_cancel = self.client.post(f'/api/subscriptions/{sub_id}/cancel', headers={
            'Authorization': f'Bearer {self.admin_token}'
        })
        self.assertEqual(dup_cancel.status_code, 400)


if __name__ == '__main__':
    unittest.main()
