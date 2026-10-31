"""
Unit Tests for Member 1: Authentication, User Roles, and Customer Management.
Tests all 9 required endpoints in backend/routes/auth_routes.py.
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
from models import db, User, Customer, PasswordResetToken
from routes.auth_routes import auth_bp


class Member1AuthTestCase(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Configure app with in-memory database for isolated testing
        cls.app = create_app()
        cls.app.config['TESTING'] = True
        cls.app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'
        cls.app.config['SECRET_KEY'] = 'test-secret-key-12345'
        # Register Member 1's Blueprint for test client
        cls.app.register_blueprint(auth_bp, url_prefix='/api')

        with cls.app.app_context():
            db.create_all()

        cls.client = cls.app.test_client()

    def setUp(self):
        with self.app.app_context():
            db.session.remove()
            db.drop_all()
            db.create_all()

    def test_01_default_admin_login(self):
        """Test initial admin auto-seeding and login."""
        res = self.client.post('/api/auth/login', json={
            'email': 'admin@brightloop.io',
            'password': 'Admin@BrightLoop2026!'
        })
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertIn('token', data)
        self.assertEqual(data['user']['role'], 'admin')
        self.assertEqual(data['user']['username'], 'admin')

    def test_02_password_complexity_validation(self):
        """Test rejection of passwords that do not meet complexity requirements."""
        # Too short (<= 8 chars)
        res = self.client.post('/api/auth/register-customer', json={
            'name': 'Short PW',
            'username': 'shortpw',
            'email': 'short@example.com',
            'password': 'Aa1!'
        })
        self.assertEqual(res.status_code, 400)
        self.assertIn('more than 8 characters', res.get_json()['error'])

        # Missing uppercase
        res = self.client.post('/api/auth/register-customer', json={
            'name': 'No Upper',
            'username': 'noupper',
            'email': 'noupper@example.com',
            'password': 'lowercase123!'
        })
        self.assertEqual(res.status_code, 400)
        self.assertIn('uppercase', res.get_json()['error'])

        # Missing lowercase
        res = self.client.post('/api/auth/register-customer', json={
            'name': 'No Lower',
            'username': 'nolower',
            'email': 'nolower@example.com',
            'password': 'UPPERCASE123!'
        })
        self.assertEqual(res.status_code, 400)
        self.assertIn('lowercase', res.get_json()['error'])

        # Missing special char
        res = self.client.post('/api/auth/register-customer', json={
            'name': 'No Special',
            'username': 'nospecial',
            'email': 'nospecial@example.com',
            'password': 'UppercaseLowercase123'
        })
        self.assertEqual(res.status_code, 400)
        self.assertIn('special character', res.get_json()['error'])

    def test_03_customer_registration_and_duplicate_prevention(self):
        """Test valid customer registration and duplicate account rejection."""
        payload = {
            'name': 'Sarah Connor',
            'username': 'sarah_c',
            'email': 'sarah@skynet.com',
            'password': 'SecurePassword2026!',
            'phone': '+1 555-0199',
            'company': 'Cyberdyne Systems',
            'address': 'Los Angeles, CA'
        }
        res = self.client.post('/api/auth/register-customer', json=payload)
        self.assertEqual(res.status_code, 201)
        data = res.get_json()
        self.assertIn('token', data)
        self.assertEqual(data['user']['role'], 'customer')
        self.assertEqual(data['customer']['company'], 'Cyberdyne Systems')

        # Test duplicate registration rejection
        res_dup = self.client.post('/api/auth/register-customer', json=payload)
        self.assertEqual(res_dup.status_code, 409)
        self.assertIn('already exists', res_dup.get_json()['error'])

    def test_04_password_reset_flow(self):
        """Test requesting reset token and resetting password."""
        # Create a user first
        self.client.post('/api/auth/register-customer', json={
            'name': 'Reset Test',
            'username': 'resetuser',
            'email': 'reset@example.com',
            'password': 'InitialPassword123!'
        })

        # Request reset token
        res_req = self.client.post('/api/auth/reset-password-request', json={
            'email': 'reset@example.com'
        })
        self.assertEqual(res_req.status_code, 200)
        reset_token = res_req.get_json()['reset_token']
        self.assertTrue(bool(reset_token))

        # Perform password reset
        new_password = 'NewPassword456!@#'
        res_reset = self.client.post('/api/auth/reset-password', json={
            'token': reset_token,
            'new_password': new_password
        })
        self.assertEqual(res_reset.status_code, 200)

        # Verify old password fails
        res_old = self.client.post('/api/auth/login', json={
            'email': 'reset@example.com',
            'password': 'InitialPassword123!'
        })
        self.assertEqual(res_old.status_code, 401)

        # Verify new password succeeds
        res_new = self.client.post('/api/auth/login', json={
            'email': 'reset@example.com',
            'password': new_password
        })
        self.assertEqual(res_new.status_code, 200)

    def test_05_admin_staff_management_and_role_security(self):
        """Test admin creating staff and non-admin access denial (403)."""
        # Login as default admin
        admin_login = self.client.post('/api/auth/login', json={
            'email': 'admin@brightloop.io',
            'password': 'Admin@BrightLoop2026!'
        }).get_json()
        admin_token = admin_login['token']

        # Register a normal customer
        cust_reg = self.client.post('/api/auth/register-customer', json={
            'name': 'Customer Joe',
            'username': 'custjoe',
            'email': 'joe@example.com',
            'password': 'CustomerPassword2026!'
        }).get_json()
        cust_token = cust_reg['token']

        # Customer tries to access GET /api/users -> must return 403 Forbidden
        res_forbidden = self.client.get('/api/users', headers={
            'Authorization': f'Bearer {cust_token}'
        })
        self.assertEqual(res_forbidden.status_code, 403)

        # Customer tries to create staff -> must return 403 Forbidden
        res_forbidden_post = self.client.post('/api/users/staff', json={
            'username': 'hackstaff',
            'email': 'hack@example.com',
            'password': 'HackPassword2026!'
        }, headers={'Authorization': f'Bearer {cust_token}'})
        self.assertEqual(res_forbidden_post.status_code, 403)

        # Admin creates staff successfully
        res_staff = self.client.post('/api/users/staff', json={
            'username': 'jane_staff',
            'email': 'jane@brightloop.io',
            'password': 'StaffPassword2026!',
            'role': 'staff'
        }, headers={'Authorization': f'Bearer {admin_token}'})
        self.assertEqual(res_staff.status_code, 201)
        self.assertEqual(res_staff.get_json()['user']['role'], 'staff')

        # Admin lists users
        res_users = self.client.get('/api/users', headers={
            'Authorization': f'Bearer {admin_token}'
        })
        self.assertEqual(res_users.status_code, 200)
        self.assertGreaterEqual(res_users.get_json()['count'], 3)

    def test_06_customer_crud(self):
        """Test staff/admin creating, listing, and updating customers."""
        admin_login = self.client.post('/api/auth/login', json={
            'email': 'admin@brightloop.io',
            'password': 'Admin@BrightLoop2026!'
        }).get_json()
        token = admin_login['token']

        # Create customer
        res_create = self.client.post('/api/customers', json={
            'name': 'Acme Corp',
            'email': 'billing@acme.com',
            'phone': '+1 800-555-ACME',
            'company': 'Acme Global',
            'address': 'Industrial Way 1'
        }, headers={'Authorization': f'Bearer {token}'})
        self.assertEqual(res_create.status_code, 201)
        cust_id = res_create.get_json()['customer']['id']

        # List customers
        res_list = self.client.get('/api/customers?query=Acme', headers={
            'Authorization': f'Bearer {token}'
        })
        self.assertEqual(res_list.status_code, 200)
        self.assertEqual(len(res_list.get_json()['customers']), 1)

        # Update customer
        res_update = self.client.put(f'/api/customers/{cust_id}', json={
            'company': 'Acme Super Global Inc',
            'phone': '+1 800-999-ACME'
        }, headers={'Authorization': f'Bearer {token}'})
        self.assertEqual(res_update.status_code, 200)
        self.assertEqual(res_update.get_json()['customer']['company'], 'Acme Super Global Inc')


if __name__ == '__main__':
    unittest.main()

