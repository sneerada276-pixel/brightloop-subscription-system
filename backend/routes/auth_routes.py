"""
BrightLoop Subscription Management System - Authentication & User Management Routes
Module 1: User Authentication, Role-Based Access Control, and Customer Management.

Endpoints:
- POST /api/auth/login
- POST /api/auth/register-customer
- POST /api/auth/reset-password-request
- POST /api/auth/reset-password
- GET  /api/auth/me
- GET  /api/users
- POST /api/users/staff
- GET  /api/customers
- POST /api/customers
- PUT  /api/customers/<id>
"""

import os
import re
import secrets
from datetime import datetime, timezone, timedelta
from functools import wraps

from flask import Blueprint, request, jsonify, current_app
from werkzeug.security import generate_password_hash, check_password_hash
from itsdangerous import URLSafeTimedSerializer, SignatureExpired, BadSignature

from models import db, User, PasswordResetToken, Customer

auth_bp = Blueprint('auth', __name__)

# Fallback secret key for token serialization
SECRET_KEY = os.environ.get('SECRET_KEY', 'brightloop-dev-secret-key-2026-hackathon')
TOKEN_MAX_AGE_SECONDS = 86400  # 24 hours
EMAIL_REGEX = re.compile(r'^[\w\.-]+@[\w\.-]+\.\w+$')


def get_serializer():
    secret = current_app.config.get('SECRET_KEY', SECRET_KEY)
    return URLSafeTimedSerializer(secret)


def utcnow():
    return datetime.now(timezone.utc)


def validate_password_complexity(password):
    """
    Validates required password policy:
    - More than 8 characters long
    - At least one uppercase letter
    - At least one lowercase letter
    - At least one special character
    """
    if not password or len(password) <= 8:
        return False, "Password must be more than 8 characters long."
    if not re.search(r'[A-Z]', password):
        return False, "Password must contain at least one uppercase letter (A-Z)."
    if not re.search(r'[a-z]', password):
        return False, "Password must contain at least one lowercase letter (a-z)."
    if not re.search(r'[^A-Za-z0-9]', password):
        return False, "Password must contain at least one special character (!@#$%^&* etc.)."
    return True, None


def validate_email_format(email):
    """Checks if email matches standard format."""
    if not email or not EMAIL_REGEX.match(email.strip()):
        return False, "Invalid email address format."
    return True, None


def ensure_default_admin():
    """
    Ensures an initial administrator account exists in the database.
    If no admin user exists, seeds 'admin@brightloop.io'.
    """
    admin = User.query.filter_by(role='admin').first()
    if not admin:
        default_admin = User(
            username='admin',
            email='admin@brightloop.io',
            password_hash=generate_password_hash('Admin@BrightLoop2026!'),
            role='admin',
            is_active=True
        )
        db.session.add(default_admin)
        db.session.commit()
        return default_admin
    return admin


def token_required(f):
    """Decorator to authenticate requests via Bearer token."""
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get('Authorization', None)
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({'error': 'Authorization token is missing or malformed.'}), 401

        token = auth_header.split(' ', 1)[1].strip()
        serializer = get_serializer()

        try:
            payload = serializer.loads(token, max_age=TOKEN_MAX_AGE_SECONDS)
            user_id = payload.get('user_id')
        except SignatureExpired:
            return jsonify({'error': 'Token has expired. Please log in again.'}), 401
        except (BadSignature, Exception):
            return jsonify({'error': 'Invalid authentication token.'}), 401

        user = db.session.get(User, user_id)
        if not user or not user.is_active:
            return jsonify({'error': 'User not found or account is deactivated.'}), 401

        request.current_user = user
        return f(*args, **kwargs)
    return decorated


def roles_required(*allowed_roles):
    """Decorator to enforce role-based access control."""
    def decorator(f):
        @wraps(f)
        @token_required
        def wrapper(*args, **kwargs):
            user = getattr(request, 'current_user', None)
            if not user or user.role not in allowed_roles:
                return jsonify({
                    'error': f"Forbidden. Role '{user.role if user else 'anonymous'}' is not authorized to access this resource.",
                    'required_roles': list(allowed_roles)
                }), 403
            return f(*args, **kwargs)
        return wrapper
    return decorator


# -----------------------------------------------------------------------------
# 1. Authentication Endpoints
# -----------------------------------------------------------------------------

@auth_bp.route('/auth/login', methods=['POST'])
def login():
    """
    Authenticate user via email or username and password.
    Returns Bearer token and sanitized user details.
    """
    data = request.get_json(silent=True) or {}
    identifier = (data.get('email') or data.get('username') or '').strip().lower()
    password = data.get('password', '')

    if not identifier or not password:
        return jsonify({'error': 'Username/email and password are required.'}), 400

    # Ensure admin exists if database was fresh
    ensure_default_admin()

    # Find user by either email or username
    user = User.query.filter(
        (User.email.ilike(identifier)) | (User.username.ilike(identifier))
    ).first()

    if not user or not check_password_hash(user.password_hash, password):
        return jsonify({'error': 'Invalid email/username or password.'}), 401

    if not user.is_active:
        return jsonify({'error': 'Your account has been deactivated. Contact an administrator.'}), 403

    serializer = get_serializer()
    token = serializer.dumps({
        'user_id': user.id,
        'username': user.username,
        'role': user.role
    })

    return jsonify({
        'message': 'Login successful.',
        'token': token,
        'user': user.to_dict()
    }), 200


@auth_bp.route('/auth/register-customer', methods=['POST'])
def register_customer():
    """
    Self-service registration for customers.
    Creates both a User account (role: 'customer') and a Customer profile.
    """
    data = request.get_json(silent=True) or {}
    name = (data.get('name') or '').strip()
    username = (data.get('username') or '').strip().lower()
    email = (data.get('email') or '').strip().lower()
    password = data.get('password', '')
    phone = (data.get('phone') or '').strip() or None
    company = (data.get('company') or '').strip() or None
    address = (data.get('address') or '').strip() or None

    if not name or not username or not email or not password:
        return jsonify({'error': 'Name, username, email, and password are required.'}), 400

    # Validate email format
    is_valid_email, email_err = validate_email_format(email)
    if not is_valid_email:
        return jsonify({'error': email_err}), 400

    # Validate password complexity
    is_valid_pw, pw_err = validate_password_complexity(password)
    if not is_valid_pw:
        return jsonify({'error': pw_err}), 400

    # Check for duplicate user account
    if User.query.filter((User.username == username) | (User.email == email)).first():
        return jsonify({'error': 'A user with this username or email already exists.'}), 409

    # Check for existing customer email
    existing_customer = Customer.query.filter_by(email=email).first()

    try:
        new_user = User(
            username=username,
            email=email,
            password_hash=generate_password_hash(password),
            role='customer',
            is_active=True
        )
        db.session.add(new_user)

        if existing_customer:
            # Link/update existing customer profile details if needed
            if phone and not existing_customer.phone:
                existing_customer.phone = phone
            if company and not existing_customer.company:
                existing_customer.company = company
            if address and not existing_customer.address:
                existing_customer.address = address
            customer_profile = existing_customer
        else:
            customer_profile = Customer(
                name=name,
                email=email,
                phone=phone,
                company=company,
                address=address,
                is_active=True
            )
            db.session.add(customer_profile)

        db.session.commit()

        # Generate login token for immediate session start
        serializer = get_serializer()
        token = serializer.dumps({
            'user_id': new_user.id,
            'username': new_user.username,
            'role': new_user.role
        })

        return jsonify({
            'message': 'Customer account created successfully.',
            'token': token,
            'user': new_user.to_dict(),
            'customer': customer_profile.to_dict()
        }), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to register customer: {str(e)}'}), 500


@auth_bp.route('/auth/reset-password-request', methods=['POST'])
def reset_password_request():
    """
    Generates a secure password reset token for the given user email.
    Note: Does not pretend to deliver external emails when SMTP is not configured;
    returns the token directly for testing/development.
    """
    data = request.get_json(silent=True) or {}
    email = (data.get('email') or '').strip().lower()

    if not email:
        return jsonify({'error': 'Email address is required.'}), 400

    user = User.query.filter_by(email=email).first()
    if not user:
        # Prevent user enumeration in production, but provide clear message
        return jsonify({'error': 'No account found with this email address.'}), 404

    # Invalidate previous unused reset tokens for this user
    PasswordResetToken.query.filter_by(user_id=user.id, used=False).update({'used': True})

    token = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(hours=1)

    reset_record = PasswordResetToken(
        user_id=user.id,
        token=token,
        expires_at=expires_at,
        used=False
    )
    db.session.add(reset_record)
    db.session.commit()

    return jsonify({
        'message': 'Password reset token generated successfully. (Development mode: no SMTP server configured).',
        'reset_token': token,
        'expires_at': expires_at.isoformat(),
        'instructions': 'Pass this reset_token and your new password to /api/auth/reset-password.'
    }), 200


@auth_bp.route('/auth/reset-password', methods=['POST'])
def reset_password():
    """
    Consumes a valid, unused password reset token and updates the user's password.
    """
    data = request.get_json(silent=True) or {}
    token = (data.get('token') or '').strip()
    new_password = data.get('new_password', '')

    if not token or not new_password:
        return jsonify({'error': 'Reset token and new password are required.'}), 400

    # Validate new password complexity
    is_valid_pw, pw_err = validate_password_complexity(new_password)
    if not is_valid_pw:
        return jsonify({'error': pw_err}), 400

    reset_record = PasswordResetToken.query.filter_by(token=token, used=False).first()
    if not reset_record:
        return jsonify({'error': 'Invalid or already used password reset token.'}), 400

    # Ensure token is not expired
    expires_at = reset_record.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)

    if datetime.now(timezone.utc) > expires_at:
        return jsonify({'error': 'Password reset token has expired. Please request a new one.'}), 400

    user = db.session.get(User, reset_record.user_id)
    if not user:
        return jsonify({'error': 'Associated user account not found.'}), 404

    try:
        user.password_hash = generate_password_hash(new_password)
        reset_record.used = True
        db.session.commit()

        return jsonify({'message': 'Password has been reset successfully. You can now log in.'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to reset password: {str(e)}'}), 500


@auth_bp.route('/auth/me', methods=['GET'])
@token_required
def get_current_user_profile():
    """Returns the authenticated user's profile and customer details if applicable."""
    user = request.current_user
    res = {'user': user.to_dict()}

    if user.role == 'customer':
        customer = Customer.query.filter_by(email=user.email).first()
        res['customer'] = customer.to_dict() if customer else None

    return jsonify(res), 200


# -----------------------------------------------------------------------------
# 2. User Management (Admin Only)
# -----------------------------------------------------------------------------

@auth_bp.route('/users', methods=['GET'])
@roles_required('admin')
def list_users():
    """Admin-only: list all system users."""
    users = User.query.order_by(User.created_at.desc()).all()
    return jsonify({
        'count': len(users),
        'users': [u.to_dict() for u in users]
    }), 200


@auth_bp.route('/users/staff', methods=['POST'])
@roles_required('admin')
def create_staff_user():
    """
    Admin-only: Create a staff (or additional admin) account.
    """
    data = request.get_json(silent=True) or {}
    username = (data.get('username') or '').strip().lower()
    email = (data.get('email') or '').strip().lower()
    password = data.get('password', '')
    role = (data.get('role') or 'staff').strip().lower()

    if not username or not email or not password:
        return jsonify({'error': 'Username, email, and password are required.'}), 400

    if role not in ['staff', 'admin']:
        return jsonify({'error': "Role must be 'staff' or 'admin'."}), 400

    is_valid_email, email_err = validate_email_format(email)
    if not is_valid_email:
        return jsonify({'error': email_err}), 400

    is_valid_pw, pw_err = validate_password_complexity(password)
    if not is_valid_pw:
        return jsonify({'error': pw_err}), 400

    if User.query.filter((User.username == username) | (User.email == email)).first():
        return jsonify({'error': 'A user with this username or email already exists.'}), 409

    try:
        new_staff = User(
            username=username,
            email=email,
            password_hash=generate_password_hash(password),
            role=role,
            is_active=True
        )
        db.session.add(new_staff)
        db.session.commit()

        return jsonify({
            'message': f"{role.capitalize()} user created successfully.",
            'user': new_staff.to_dict()
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to create staff member: {str(e)}'}), 500


# -----------------------------------------------------------------------------
# 3. Customer Management (Admin & Staff)
# -----------------------------------------------------------------------------

@auth_bp.route('/customers', methods=['GET'])
@roles_required('admin', 'staff')
def list_customers():
    """
    Admin & Staff: List customers with optional search query and active filter.
    """
    query = request.args.get('query', '').strip()
    active_filter = request.args.get('active', None)

    q = Customer.query
    if active_filter is not None:
        is_active = active_filter.lower() in ['true', '1', 'yes']
        q = q.filter(Customer.is_active == is_active)

    if query:
        like_pattern = f'%{query}%'
        q = q.filter(
            (Customer.name.ilike(like_pattern)) |
            (Customer.email.ilike(like_pattern)) |
            (Customer.company.ilike(like_pattern))
        )

    customers = q.order_by(Customer.created_at.desc()).all()
    return jsonify({
        'count': len(customers),
        'customers': [c.to_dict() for c in customers]
    }), 200


@auth_bp.route('/customers', methods=['POST'])
@roles_required('admin', 'staff')
def create_customer():
    """
    Admin & Staff: Create a new customer profile.
    """
    data = request.get_json(silent=True) or {}
    name = (data.get('name') or '').strip()
    email = (data.get('email') or '').strip().lower()
    phone = (data.get('phone') or '').strip() or None
    company = (data.get('company') or '').strip() or None
    address = (data.get('address') or '').strip() or None

    if not name or not email:
        return jsonify({'error': 'Customer name and email are required.'}), 400

    is_valid_email, email_err = validate_email_format(email)
    if not is_valid_email:
        return jsonify({'error': email_err}), 400

    if Customer.query.filter_by(email=email).first():
        return jsonify({'error': 'A customer with this email already exists.'}), 409

    try:
        customer = Customer(
            name=name,
            email=email,
            phone=phone,
            company=company,
            address=address,
            is_active=True
        )
        db.session.add(customer)
        db.session.commit()

        return jsonify({
            'message': 'Customer created successfully.',
            'customer': customer.to_dict()
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to create customer: {str(e)}'}), 500


@auth_bp.route('/customers/<int:customer_id>', methods=['PUT'])
@roles_required('admin', 'staff')
def update_customer(customer_id):
    """
    Admin & Staff: Update existing customer details.
    """
    customer = db.session.get(Customer, customer_id)
    if not customer:
        return jsonify({'error': 'Customer not found.'}), 404

    data = request.get_json(silent=True) or {}

    if 'name' in data:
        name = data['name'].strip()
        if not name:
            return jsonify({'error': 'Customer name cannot be empty.'}), 400
        customer.name = name

    if 'email' in data:
        email = data['email'].strip().lower()
        is_valid_email, email_err = validate_email_format(email)
        if not is_valid_email:
            return jsonify({'error': email_err}), 400

        # Check uniqueness if email changed
        duplicate = Customer.query.filter(Customer.email == email, Customer.id != customer_id).first()
        if duplicate:
            return jsonify({'error': 'Another customer already uses this email.'}), 409
        customer.email = email

    if 'phone' in data:
        customer.phone = (data['phone'] or '').strip() or None

    if 'company' in data:
        customer.company = (data['company'] or '').strip() or None

    if 'address' in data:
        customer.address = (data['address'] or '').strip() or None

    if 'is_active' in data:
        customer.is_active = bool(data['is_active'])

    try:
        db.session.commit()
        return jsonify({
            'message': 'Customer updated successfully.',
            'customer': customer.to_dict()
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to update customer: {str(e)}'}), 500

