"""
Unit Tests for Member 2: Products, Product Variants, and Subscription Plans.
Tests all 10 required endpoints in backend/routes/product_routes.py.
"""

import sys
import os
import unittest
import json

# Ensure backend directory is in python path
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app import create_app
from models import db, User, Product, ProductVariant, Plan
from routes.auth_routes import auth_bp
from routes.product_routes import product_bp


class Member2ProductsPlansTestCase(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app = create_app()
        cls.app.config['TESTING'] = True
        cls.app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'
        cls.app.config['SECRET_KEY'] = 'test-secret-key-member2'

        # Register product_bp with /api prefix for testing if not already registered
        if 'products' not in cls.app.blueprints:
            cls.app.register_blueprint(product_bp, url_prefix='/api')

        with cls.app.app_context():
            db.create_all()

        cls.client = cls.app.test_client()

    def setUp(self):
        with self.app.app_context():
            db.session.remove()
            db.drop_all()
            db.create_all()

            # Seed Admin
            admin_res = self.client.post('/api/auth/login', json={
                'email': 'admin@brightloop.io',
                'password': 'Admin@BrightLoop2026!'
            })
            self.admin_token = admin_res.get_json()['token']

            # Seed Staff via Admin
            staff_res = self.client.post('/api/users/staff', json={
                'username': 'staff_alex',
                'email': 'alex@brightloop.io',
                'password': 'StaffPassword2026!',
                'role': 'staff'
            }, headers={'Authorization': f'Bearer {self.admin_token}'})
            self.staff_token = self.client.post('/api/auth/login', json={
                'email': 'alex@brightloop.io',
                'password': 'StaffPassword2026!'
            }).get_json()['token']

            # Seed Customer
            cust_res = self.client.post('/api/auth/register-customer', json={
                'name': 'Customer Dave',
                'username': 'dave_cust',
                'email': 'dave@example.com',
                'password': 'CustPassword2026!'
            })
            self.cust_token = cust_res.get_json()['token']

    def test_01_product_creation_and_authorization(self):
        """Test product creation by admin/staff and rejection of customer/unauthenticated."""
        product_payload = {
            'name': 'Cloud Hosting Tier 1',
            'code': 'CLOUD-T1',
            'description': 'Basic Linux VM',
            'sales_price': 19.99,
            'cost_price': 8.50,
            'is_active': True
        }

        # 1. Unauthenticated request -> 401
        res = self.client.post('/api/products', json=product_payload)
        self.assertEqual(res.status_code, 401)

        # 2. Customer request -> 403 Forbidden
        res = self.client.post('/api/products', json=product_payload, headers={
            'Authorization': f'Bearer {self.cust_token}'
        })
        self.assertEqual(res.status_code, 403)

        # 3. Staff request -> 201 Created
        res = self.client.post('/api/products', json=product_payload, headers={
            'Authorization': f'Bearer {self.staff_token}'
        })
        self.assertEqual(res.status_code, 201)
        data = res.get_json()
        self.assertEqual(data['code'], 'CLOUD-T1')
        self.assertEqual(data['sales_price'], 19.99)
        self.assertEqual(data['variants'], [])

        # 4. Duplicate code rejection -> 409 Conflict
        res_dup = self.client.post('/api/products', json=product_payload, headers={
            'Authorization': f'Bearer {self.admin_token}'
        })
        self.assertEqual(res_dup.status_code, 409)
        self.assertIn('already exists', res_dup.get_json()['error'])

    def test_02_product_validation(self):
        """Test input validation on product creation."""
        # Missing name
        res = self.client.post('/api/products', json={'code': 'CODE1'}, headers={
            'Authorization': f'Bearer {self.admin_token}'
        })
        self.assertEqual(res.status_code, 400)

        # Missing code
        res = self.client.post('/api/products', json={'name': 'Prod 1'}, headers={
            'Authorization': f'Bearer {self.admin_token}'
        })
        self.assertEqual(res.status_code, 400)

        # Negative price
        res = self.client.post('/api/products', json={
            'name': 'Prod 1',
            'code': 'CODE1',
            'sales_price': -10.0
        }, headers={'Authorization': f'Bearer {self.admin_token}'})
        self.assertEqual(res.status_code, 400)

    def test_03_product_update_and_soft_delete(self):
        """Test updating products and soft-deleting products."""
        # Create product
        res = self.client.post('/api/products', json={
            'name': 'Old Name',
            'code': 'CODE-ORIG',
            'sales_price': 10.0
        }, headers={'Authorization': f'Bearer {self.admin_token}'})
        prod_id = res.get_json()['id']

        # Staff updates product
        res_update = self.client.put(f'/api/products/{prod_id}', json={
            'name': 'New Product Name',
            'sales_price': 25.0
        }, headers={'Authorization': f'Bearer {self.staff_token}'})
        self.assertEqual(res_update.status_code, 200)
        self.assertEqual(res_update.get_json()['name'], 'New Product Name')
        self.assertEqual(res_update.get_json()['sales_price'], 25.0)

        # Staff tries to delete -> 403 Forbidden (Only Admin can delete)
        res_del_staff = self.client.delete(f'/api/products/{prod_id}', headers={
            'Authorization': f'Bearer {self.staff_token}'
        })
        self.assertEqual(res_del_staff.status_code, 403)

        # Admin soft-deletes -> 200 (is_active becomes False)
        res_del_admin = self.client.delete(f'/api/products/{prod_id}', headers={
            'Authorization': f'Bearer {self.admin_token}'
        })
        self.assertEqual(res_del_admin.status_code, 200)
        self.assertEqual(res_del_admin.get_json()['is_active'], False)

    def test_04_product_variants_crud(self):
        """Test adding and updating product variants."""
        # Create product
        prod_res = self.client.post('/api/products', json={
            'name': 'T-Shirt',
            'code': 'TSHIRT-01',
            'sales_price': 20.0
        }, headers={'Authorization': f'Bearer {self.admin_token}'})
        prod_id = prod_res.get_json()['id']

        # Add variant (Staff)
        var_payload = {
            'variant_name': 'Size: Large, Color: Blue',
            'sku': 'TSHIRT-BLU-L',
            'sales_price_override': 24.50,
            'cost_price_override': 12.00
        }
        res_var = self.client.post(f'/api/products/{prod_id}/variants', json=var_payload, headers={
            'Authorization': f'Bearer {self.staff_token}'
        })
        self.assertEqual(res_var.status_code, 201)
        var_data = res_var.get_json()
        self.assertEqual(var_data['sku'], 'TSHIRT-BLU-L')
        self.assertEqual(var_data['sales_price_override'], 24.50)
        var_id = var_data['id']

        # Duplicate SKU rejection -> 409
        res_dup_sku = self.client.post(f'/api/products/{prod_id}/variants', json=var_payload, headers={
            'Authorization': f'Bearer {self.admin_token}'
        })
        self.assertEqual(res_dup_sku.status_code, 409)

        # Update variant
        res_upd_var = self.client.put(f'/api/products/variants/{var_id}', json={
            'variant_name': 'Size: Large, Color: Navy Blue',
            'sales_price_override': 26.00
        }, headers={'Authorization': f'Bearer {self.staff_token}'})
        self.assertEqual(res_upd_var.status_code, 200)
        self.assertEqual(res_upd_var.get_json()['variant_name'], 'Size: Large, Color: Navy Blue')
        self.assertEqual(res_upd_var.get_json()['sales_price_override'], 26.00)

        # GET products must include variants list
        res_list = self.client.get('/api/products')
        self.assertEqual(res_list.status_code, 200)
        prods = res_list.get_json()['products']
        self.assertEqual(len(prods), 1)
        self.assertEqual(len(prods[0]['variants']), 1)
        self.assertEqual(prods[0]['variants'][0]['sku'], 'TSHIRT-BLU-L')

    def test_05_plans_crud_and_intervals(self):
        """Test subscription plans creation, intervals validation, update, and soft-delete."""
        # Create product to link
        prod_res = self.client.post('/api/products', json={
            'name': 'SaaS Platform Pro',
            'code': 'SAAS-PRO',
            'sales_price': 99.0
        }, headers={'Authorization': f'Bearer {self.admin_token}'})
        prod_id = prod_res.get_json()['id']

        # Invalid billing interval -> 400
        res_bad_int = self.client.post('/api/plans', json={
            'name': 'Hourly Plan',
            'price': 5.0,
            'billing_interval': 'hourly'
        }, headers={'Authorization': f'Bearer {self.admin_token}'})
        self.assertEqual(res_bad_int.status_code, 400)
        self.assertIn('daily, weekly, monthly, yearly', res_bad_int.get_json()['error'])

        # Valid plan creation (monthly)
        plan_payload = {
            'name': 'Pro Monthly Subscription',
            'description': 'All Pro SaaS features with monthly renewal',
            'price': 49.99,
            'billing_interval': 'monthly',
            'trial_days': 14,
            'product_id': prod_id,
            'is_active': True
        }
        res_plan = self.client.post('/api/plans', json=plan_payload, headers={
            'Authorization': f'Bearer {self.staff_token}'
        })
        self.assertEqual(res_plan.status_code, 201)
        plan_data = res_plan.get_json()
        self.assertEqual(plan_data['name'], 'Pro Monthly Subscription')
        self.assertEqual(plan_data['product_name'], 'SaaS Platform Pro')
        self.assertEqual(plan_data['billing_interval'], 'monthly')
        plan_id = plan_data['id']

        # GET /api/plans returns active plans with product_name
        res_list = self.client.get('/api/plans')
        self.assertEqual(res_list.status_code, 200)
        plans = res_list.get_json()['plans']
        self.assertEqual(len(plans), 1)
        self.assertEqual(plans[0]['product_name'], 'SaaS Platform Pro')

        # Update plan (yearly)
        res_upd = self.client.put(f'/api/plans/{plan_id}', json={
            'price': 499.00,
            'billing_interval': 'yearly'
        }, headers={'Authorization': f'Bearer {self.staff_token}'})
        self.assertEqual(res_upd.status_code, 200)
        self.assertEqual(res_upd.get_json()['billing_interval'], 'yearly')
        self.assertEqual(res_upd.get_json()['price'], 499.00)

        # Soft delete plan (Staff -> 403, Admin -> 200)
        res_del_staff = self.client.delete(f'/api/plans/{plan_id}', headers={
            'Authorization': f'Bearer {self.staff_token}'
        })
        self.assertEqual(res_del_staff.status_code, 403)

        res_del_admin = self.client.delete(f'/api/plans/{plan_id}', headers={
            'Authorization': f'Bearer {self.admin_token}'
        })
        self.assertEqual(res_del_admin.status_code, 200)
        self.assertEqual(res_del_admin.get_json()['is_active'], False)

        # Inactive plan not in default GET /api/plans
        res_list_after = self.client.get('/api/plans')
        self.assertEqual(len(res_list_after.get_json()['plans']), 0)

        # But included if include_inactive=true
        res_list_all = self.client.get('/api/plans?include_inactive=true')
        self.assertEqual(len(res_list_all.get_json()['plans']), 1)


if __name__ == '__main__':
    unittest.main()

