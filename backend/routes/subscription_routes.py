"""
BrightLoop Subscription Management System - Quotation & Subscription Lifecycle Routes
Module 3: Quotation Templates, Quotations, and Subscription Lifecycle Management.

Blueprint: subscription_bp

Endpoints:
- GET    /quotation-templates          — list quotation templates
- POST   /quotation-templates         — create a quotation template (admin/staff only)
- GET    /quotations                   — list quotations (admin/staff sees all; customer sees own; ?status= filter)
- POST   /quotations                  — create a quotation with unique quotation_number (admin/staff only)
- PUT    /quotations/<id>             — update quotation details (admin/staff only)
- POST   /quotations/<id>/send        — transition status to 'sent' (admin/staff only)
- POST   /quotations/<id>/accept      — transition status to 'accepted' AND automatically create an active Subscription
- POST   /quotations/<id>/reject      — transition status to 'rejected'
- GET    /subscriptions                — list subscriptions (admin/staff sees all; customer sees own; ?status= filter)
- GET    /subscriptions/<id>           — get details of a specific subscription
- POST   /subscriptions               — create a subscription directly (admin/staff only)
- POST   /subscriptions/<id>/pause    — pause subscription (status='paused', pause_date=now) (admin/staff only)
- POST   /subscriptions/<id>/resume   — resume subscription (status='active') (admin/staff only)
- POST   /subscriptions/<id>/renew    — renew subscription (advance period based on plan billing_interval) (admin/staff only)
- POST   /subscriptions/<id>/cancel   — close subscription (status='closed', cancellation_reason) (admin/staff/customer)
"""

from datetime import datetime, timezone, timedelta
from functools import wraps
from flask import Blueprint, request, jsonify
from itsdangerous import SignatureExpired, BadSignature

from models import db, QuotationTemplate, Quotation, Subscription, Plan, Customer, User
from routes.auth_routes import get_serializer, TOKEN_MAX_AGE_SECONDS

subscription_bp = Blueprint('subscriptions', __name__)

ALLOWED_SUBSCRIPTION_STATUSES = ('draft', 'active', 'paused', 'renewed', 'closed')
ALLOWED_QUOTATION_STATUSES = ('draft', 'sent', 'accepted', 'rejected', 'expired')


def utcnow():
    """Returns current UTC datetime."""
    return datetime.now(timezone.utc)


# -----------------------------------------------------------------------------
# Authentication & Authorization Helpers
# -----------------------------------------------------------------------------

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


def get_current_customer_profile(user):
    """If user is a customer, look up linked Customer record by email."""
    if not user or user.role != 'customer':
        return None
    return Customer.query.filter_by(email=user.email).first()


# -----------------------------------------------------------------------------
# Billing Period Calculation Helper
# -----------------------------------------------------------------------------

def calculate_period_end(start_date, billing_interval):
    """
    Calculate dynamic period end based on Plan.billing_interval:
    - 'daily'   -> +1 day
    - 'weekly'  -> +7 days
    - 'monthly' -> +30 days
    - 'yearly'  -> +365 days
    """
    interval = (billing_interval or 'monthly').strip().lower()
    if interval == 'daily':
        return start_date + timedelta(days=1)
    elif interval == 'weekly':
        return start_date + timedelta(days=7)
    elif interval == 'yearly':
        return start_date + timedelta(days=365)
    else:  # default monthly
        return start_date + timedelta(days=30)


# -----------------------------------------------------------------------------
# Model Serialization Helpers
# -----------------------------------------------------------------------------

def quotation_template_to_dict(template):
    """Manual serializer for QuotationTemplate."""
    if not template:
        return None
    return {
        'id': template.id,
        'name': template.name,
        'terms_conditions': template.terms_conditions,
        'default_validity_days': template.default_validity_days
    }


def quotation_to_dict(quotation):
    """Manual serializer for Quotation including customer, plan, and template names."""
    if not quotation:
        return None

    customer = db.session.get(Customer, quotation.customer_id)
    plan = db.session.get(Plan, quotation.plan_id)
    template = db.session.get(QuotationTemplate, quotation.template_id) if quotation.template_id else None

    # Determine if valid_until has passed
    is_past_validity = False
    if quotation.valid_until:
        # Normalize comparison timezone
        valid_until_dt = quotation.valid_until
        if valid_until_dt.tzinfo is None:
            valid_until_dt = valid_until_dt.replace(tzinfo=timezone.utc)
        is_past_validity = valid_until_dt < utcnow()

    return {
        'id': quotation.id,
        'quotation_number': quotation.quotation_number,
        'customer_id': quotation.customer_id,
        'customer_name': customer.name if customer else None,
        'customer_email': customer.email if customer else None,
        'customer_company': customer.company if customer else None,
        'template_id': quotation.template_id,
        'template_name': template.name if template else None,
        'plan_id': quotation.plan_id,
        'plan_name': plan.name if plan else None,
        'plan_price': plan.price if plan else 0.0,
        'billing_interval': plan.billing_interval if plan else 'monthly',
        'total_amount': quotation.total_amount,
        'status': quotation.status,
        'is_expired': is_past_validity and quotation.status not in ('accepted', 'rejected'),
        'valid_until': quotation.valid_until.isoformat() if quotation.valid_until else None,
        'created_at': quotation.created_at.isoformat() if quotation.created_at else None
    }


def subscription_to_dict(subscription):
    """Full serializer for Subscription model using to_dict() and supplementary fields."""
    if not subscription:
        return None

    data = subscription.to_dict()
    data.update({
        'quotation_id': subscription.quotation_id,
        'current_period_start': subscription.current_period_start.isoformat() if subscription.current_period_start else None,
        'current_period_end': subscription.current_period_end.isoformat() if subscription.current_period_end else None,
        'pause_date': subscription.pause_date.isoformat() if subscription.pause_date else None,
        'cancellation_reason': subscription.cancellation_reason,
        'created_at': subscription.created_at.isoformat() if subscription.created_at else None
    })
    return data


# -----------------------------------------------------------------------------
# 1. Quotation Templates
# -----------------------------------------------------------------------------

@subscription_bp.route('/quotation-templates', methods=['GET'])
@token_required
def list_quotation_templates():
    """List all quotation templates."""
    templates = QuotationTemplate.query.order_by(QuotationTemplate.name.asc()).all()
    return jsonify({
        'count': len(templates),
        'templates': [quotation_template_to_dict(t) for t in templates]
    }), 200


@subscription_bp.route('/quotation-templates', methods=['POST'])
@roles_required('admin', 'staff')
def create_quotation_template():
    """Create a quotation template (admin/staff only)."""
    data = request.get_json(silent=True) or {}
    name = (data.get('name') or '').strip()
    terms_conditions = (data.get('terms_conditions') or '').strip() or None
    default_validity_days = data.get('default_validity_days', 30)

    if not name:
        return jsonify({'error': 'Template name is required.'}), 400

    try:
        default_validity_days = int(default_validity_days)
        if default_validity_days <= 0:
            return jsonify({'error': 'default_validity_days must be a positive integer.'}), 400
    except (ValueError, TypeError):
        return jsonify({'error': 'default_validity_days must be an integer.'}), 400

    template = QuotationTemplate(
        name=name,
        terms_conditions=terms_conditions,
        default_validity_days=default_validity_days
    )
    db.session.add(template)
    db.session.commit()

    return jsonify({
        'message': 'Quotation template created successfully.',
        'template': quotation_template_to_dict(template)
    }), 201


# -----------------------------------------------------------------------------
# 2. Quotation Management
# -----------------------------------------------------------------------------

@subscription_bp.route('/quotations', methods=['GET'])
@token_required
def list_quotations():
    """
    List quotations.
    - Admin/staff sees all.
    - Customer sees only their own.
    - Supports ?status= filter.
    """
    user = request.current_user
    status_filter = request.args.get('status', '').strip().lower()

    q = Quotation.query

    # Customer scoping
    if user.role == 'customer':
        customer_profile = get_current_customer_profile(user)
        if not customer_profile:
            return jsonify({'count': 0, 'quotations': []}), 200
        q = q.filter(Quotation.customer_id == customer_profile.id)

    # Status filter
    if status_filter and status_filter != 'all':
        q = q.filter(Quotation.status == status_filter)

    quotations = q.order_by(Quotation.created_at.desc()).all()

    return jsonify({
        'count': len(quotations),
        'quotations': [quotation_to_dict(item) for item in quotations]
    }), 200


@subscription_bp.route('/quotations/<int:id>', methods=['GET'])
@token_required
def get_quotation(id):
    """Get details of a specific quotation."""
    user = request.current_user
    quotation = db.session.get(Quotation, id)
    if not quotation:
        return jsonify({'error': f'Quotation with id {id} not found.'}), 404

    # RBAC ownership check for customers
    if user.role == 'customer':
        customer_profile = get_current_customer_profile(user)
        if not customer_profile or quotation.customer_id != customer_profile.id:
            return jsonify({'error': 'Forbidden. You can only view your own quotations.'}), 403

    return jsonify({'quotation': quotation_to_dict(quotation)}), 200


@subscription_bp.route('/quotations', methods=['POST'])
@roles_required('admin', 'staff')
def create_quotation():
    """Create a quotation with unique quotation_number (admin/staff only)."""
    data = request.get_json(silent=True) or {}

    quotation_number = (data.get('quotation_number') or '').strip()
    customer_id = data.get('customer_id')
    plan_id = data.get('plan_id')
    template_id = data.get('template_id')
    total_amount = data.get('total_amount')
    validity_days = data.get('validity_days')
    valid_until_str = data.get('valid_until')

    if not quotation_number:
        return jsonify({'error': 'quotation_number is required.'}), 400

    if not customer_id or not plan_id:
        return jsonify({'error': 'customer_id and plan_id are required.'}), 400

    # Check unique quotation_number
    existing = Quotation.query.filter_by(quotation_number=quotation_number).first()
    if existing:
        return jsonify({'error': f"A quotation with number '{quotation_number}' already exists."}), 409

    # Validate Customer
    customer = db.session.get(Customer, customer_id)
    if not customer or not customer.is_active:
        return jsonify({'error': 'Selected customer does not exist or is inactive.'}), 400

    # Validate Plan
    plan = db.session.get(Plan, plan_id)
    if not plan or not plan.is_active:
        return jsonify({'error': 'Selected plan does not exist or is inactive.'}), 400

    # Validate Template if provided
    template = None
    if template_id:
        template = db.session.get(QuotationTemplate, template_id)
        if not template:
            return jsonify({'error': 'Selected quotation template does not exist.'}), 400

    # Determine Total Amount
    if total_amount is None:
        total_amount = plan.price
    else:
        try:
            total_amount = float(total_amount)
            if total_amount < 0:
                return jsonify({'error': 'total_amount cannot be negative.'}), 400
        except (ValueError, TypeError):
            return jsonify({'error': 'total_amount must be a valid number.'}), 400

    # Determine valid_until
    valid_until = None
    if valid_until_str:
        try:
            # Try parsing ISO format
            clean_str = valid_until_str.replace('Z', '+00:00')
            valid_until = datetime.fromisoformat(clean_str)
        except Exception:
            return jsonify({'error': 'valid_until must be a valid ISO 8601 date string.'}), 400
    else:
        # Compute from validity_days or template default or 30 days
        days = 30
        if validity_days is not None:
            try:
                days = int(validity_days)
            except (ValueError, TypeError):
                return jsonify({'error': 'validity_days must be an integer.'}), 400
        elif template and template.default_validity_days:
            days = template.default_validity_days

        valid_until = utcnow() + timedelta(days=days)

    quotation = Quotation(
        quotation_number=quotation_number,
        customer_id=customer_id,
        template_id=template_id if template_id else None,
        plan_id=plan_id,
        total_amount=total_amount,
        status='draft',
        valid_until=valid_until,
        created_at=utcnow()
    )
    db.session.add(quotation)
    db.session.commit()

    return jsonify({
        'message': 'Quotation created successfully.',
        'quotation': quotation_to_dict(quotation)
    }), 201


@subscription_bp.route('/quotations/<int:id>', methods=['PUT'])
@roles_required('admin', 'staff')
def update_quotation(id):
    """Update quotation details (admin/staff only)."""
    quotation = db.session.get(Quotation, id)
    if not quotation:
        return jsonify({'error': f'Quotation with id {id} not found.'}), 404

    # Disallow modifying finalized quotations
    if quotation.status in ('accepted', 'rejected'):
        return jsonify({
            'error': f"Cannot update quotation in '{quotation.status}' status."
        }), 400

    data = request.get_json(silent=True) or {}

    # Check unique quotation_number if changing
    new_number = data.get('quotation_number')
    if new_number and new_number.strip() != quotation.quotation_number:
        new_number = new_number.strip()
        existing = Quotation.query.filter_by(quotation_number=new_number).first()
        if existing and existing.id != quotation.id:
            return jsonify({'error': f"A quotation with number '{new_number}' already exists."}), 409
        quotation.quotation_number = new_number

    if 'customer_id' in data:
        customer = db.session.get(Customer, data['customer_id'])
        if not customer or not customer.is_active:
            return jsonify({'error': 'Customer does not exist or is inactive.'}), 400
        quotation.customer_id = customer.id

    if 'plan_id' in data:
        plan = db.session.get(Plan, data['plan_id'])
        if not plan or not plan.is_active:
            return jsonify({'error': 'Plan does not exist or is inactive.'}), 400
        quotation.plan_id = plan.id

    if 'template_id' in data:
        if data['template_id']:
            template = db.session.get(QuotationTemplate, data['template_id'])
            if not template:
                return jsonify({'error': 'Quotation template not found.'}), 400
            quotation.template_id = template.id
        else:
            quotation.template_id = None

    if 'total_amount' in data:
        try:
            amt = float(data['total_amount'])
            if amt < 0:
                return jsonify({'error': 'total_amount cannot be negative.'}), 400
            quotation.total_amount = amt
        except (ValueError, TypeError):
            return jsonify({'error': 'total_amount must be a valid number.'}), 400

    if 'valid_until' in data:
        if data['valid_until']:
            try:
                clean_str = data['valid_until'].replace('Z', '+00:00')
                quotation.valid_until = datetime.fromisoformat(clean_str)
            except Exception:
                return jsonify({'error': 'valid_until must be a valid ISO 8601 date string.'}), 400
        else:
            quotation.valid_until = None

    db.session.commit()
    return jsonify({
        'message': 'Quotation updated successfully.',
        'quotation': quotation_to_dict(quotation)
    }), 200


@subscription_bp.route('/quotations/<int:id>/send', methods=['POST'])
@roles_required('admin', 'staff')
def send_quotation(id):
    """Transition status to 'sent' (admin/staff only)."""
    quotation = db.session.get(Quotation, id)
    if not quotation:
        return jsonify({'error': f'Quotation with id {id} not found.'}), 404

    if quotation.status != 'draft':
        return jsonify({
            'error': f"Invalid status transition. Only 'draft' quotations can be sent (current status: '{quotation.status}')."
        }), 400

    quotation.status = 'sent'
    db.session.commit()

    return jsonify({
        'message': 'Quotation marked as sent.',
        'quotation': quotation_to_dict(quotation)
    }), 200


@subscription_bp.route('/quotations/<int:id>/accept', methods=['POST'])
@token_required
def accept_quotation(id):
    """
    Transition status to 'accepted' AND automatically create an active Subscription
    record linked to this quotation with dynamic billing period calculation.
    """
    user = request.current_user
    quotation = db.session.get(Quotation, id)
    if not quotation:
        return jsonify({'error': f'Quotation with id {id} not found.'}), 404

    # RBAC check: Customers can only accept their own quotations; Admin/staff can accept any
    if user.role == 'customer':
        customer_profile = get_current_customer_profile(user)
        if not customer_profile or quotation.customer_id != customer_profile.id:
            return jsonify({'error': 'Forbidden. You can only accept quotations issued to your account.'}), 403

    # Check status transition
    if quotation.status == 'accepted':
        return jsonify({'error': 'This quotation has already been accepted.'}), 400
    if quotation.status in ('rejected', 'expired'):
        return jsonify({
            'error': f"Cannot accept a quotation with status '{quotation.status}'."
        }), 400

    # Check validity expiry
    if quotation.valid_until:
        valid_until_dt = quotation.valid_until
        if valid_until_dt.tzinfo is None:
            valid_until_dt = valid_until_dt.replace(tzinfo=timezone.utc)
        if valid_until_dt < utcnow():
            quotation.status = 'expired'
            db.session.commit()
            return jsonify({'error': 'This quotation has expired and cannot be accepted.'}), 400

    # Fetch linked plan
    plan = db.session.get(Plan, quotation.plan_id)
    if not plan:
        return jsonify({'error': 'Linked subscription plan does not exist.'}), 400

    # Calculate period
    start_date = utcnow()
    period_end = calculate_period_end(start_date, plan.billing_interval)

    # Transition quotation status
    quotation.status = 'accepted'

    # Create active subscription
    subscription = Subscription(
        customer_id=quotation.customer_id,
        plan_id=quotation.plan_id,
        quotation_id=quotation.id,
        status='active',
        start_date=start_date,
        current_period_start=start_date,
        current_period_end=period_end,
        auto_renew=True,
        created_at=utcnow()
    )
    db.session.add(subscription)
    db.session.commit()

    return jsonify({
        'message': 'Quotation accepted and active subscription created successfully.',
        'quotation': quotation_to_dict(quotation),
        'subscription': subscription_to_dict(subscription)
    }), 200


@subscription_bp.route('/quotations/<int:id>/reject', methods=['POST'])
@token_required
def reject_quotation(id):
    """Transition status to 'rejected'."""
    user = request.current_user
    quotation = db.session.get(Quotation, id)
    if not quotation:
        return jsonify({'error': f'Quotation with id {id} not found.'}), 404

    # RBAC check: Customers can reject their own quotations; Admin/staff can reject any
    if user.role == 'customer':
        customer_profile = get_current_customer_profile(user)
        if not customer_profile or quotation.customer_id != customer_profile.id:
            return jsonify({'error': 'Forbidden. You can only reject quotations issued to your account.'}), 403

    if quotation.status in ('accepted', 'rejected'):
        return jsonify({
            'error': f"Quotation is already '{quotation.status}' and cannot be rejected."
        }), 400

    quotation.status = 'rejected'
    db.session.commit()

    return jsonify({
        'message': 'Quotation rejected.',
        'quotation': quotation_to_dict(quotation)
    }), 200


# -----------------------------------------------------------------------------
# 3. Subscription Management & Lifecycle
# -----------------------------------------------------------------------------

@subscription_bp.route('/subscriptions', methods=['GET'])
@token_required
def list_subscriptions():
    """
    List subscriptions.
    - Admin/staff sees all.
    - Customer sees only their own.
    - Supports ?status= filter.
    """
    user = request.current_user
    status_filter = request.args.get('status', '').strip().lower()

    q = Subscription.query

    # Customer scoping
    if user.role == 'customer':
        customer_profile = get_current_customer_profile(user)
        if not customer_profile:
            return jsonify({'count': 0, 'subscriptions': []}), 200
        q = q.filter(Subscription.customer_id == customer_profile.id)

    # Status filter
    if status_filter and status_filter != 'all':
        q = q.filter(Subscription.status == status_filter)

    subscriptions = q.order_by(Subscription.created_at.desc()).all()

    return jsonify({
        'count': len(subscriptions),
        'subscriptions': [subscription_to_dict(s) for s in subscriptions]
    }), 200


@subscription_bp.route('/subscriptions/<int:id>', methods=['GET'])
@token_required
def get_subscription(id):
    """Get details of a specific subscription."""
    user = request.current_user
    subscription = db.session.get(Subscription, id)
    if not subscription:
        return jsonify({'error': f'Subscription with id {id} not found.'}), 404

    # Customer ownership check
    if user.role == 'customer':
        customer_profile = get_current_customer_profile(user)
        if not customer_profile or subscription.customer_id != customer_profile.id:
            return jsonify({'error': 'Forbidden. You can only view your own subscriptions.'}), 403

    return jsonify({'subscription': subscription_to_dict(subscription)}), 200


@subscription_bp.route('/subscriptions', methods=['POST'])
@roles_required('admin', 'staff')
def create_subscription():
    """Create a subscription directly (admin/staff only)."""
    data = request.get_json(silent=True) or {}
    customer_id = data.get('customer_id')
    plan_id = data.get('plan_id')
    quotation_id = data.get('quotation_id')
    auto_renew = data.get('auto_renew', True)
    status = data.get('status', 'active')

    if not customer_id or not plan_id:
        return jsonify({'error': 'customer_id and plan_id are required.'}), 400

    if status not in ALLOWED_SUBSCRIPTION_STATUSES:
        return jsonify({'error': f"Invalid status '{status}'. Allowed: {ALLOWED_SUBSCRIPTION_STATUSES}"}), 400

    customer = db.session.get(Customer, customer_id)
    if not customer or not customer.is_active:
        return jsonify({'error': 'Customer does not exist or is inactive.'}), 400

    plan = db.session.get(Plan, plan_id)
    if not plan or not plan.is_active:
        return jsonify({'error': 'Plan does not exist or is inactive.'}), 400

    if quotation_id:
        quotation = db.session.get(Quotation, quotation_id)
        if not quotation:
            return jsonify({'error': 'Quotation does not exist.'}), 400

    start_date = utcnow()
    if data.get('start_date'):
        try:
            clean_str = data['start_date'].replace('Z', '+00:00')
            start_date = datetime.fromisoformat(clean_str)
        except Exception:
            return jsonify({'error': 'start_date must be a valid ISO 8601 date string.'}), 400

    period_end = calculate_period_end(start_date, plan.billing_interval)

    subscription = Subscription(
        customer_id=customer_id,
        plan_id=plan_id,
        quotation_id=quotation_id if quotation_id else None,
        status=status,
        start_date=start_date,
        current_period_start=start_date,
        current_period_end=period_end,
        auto_renew=bool(auto_renew),
        created_at=utcnow()
    )
    db.session.add(subscription)
    db.session.commit()

    return jsonify({
        'message': 'Subscription created successfully.',
        'subscription': subscription_to_dict(subscription)
    }), 201


@subscription_bp.route('/subscriptions/<int:id>/pause', methods=['POST'])
@roles_required('admin', 'staff')
def pause_subscription(id):
    """Pause subscription (set status='paused', record pause_date=now) (admin/staff only)."""
    subscription = db.session.get(Subscription, id)
    if not subscription:
        return jsonify({'error': f'Subscription with id {id} not found.'}), 404

    if subscription.status == 'paused':
        return jsonify({'error': 'Subscription is already paused.'}), 400

    if subscription.status == 'closed':
        return jsonify({'error': 'Cannot pause a closed subscription.'}), 400

    subscription.status = 'paused'
    subscription.pause_date = utcnow()
    db.session.commit()

    return jsonify({
        'message': 'Subscription paused successfully.',
        'subscription': subscription_to_dict(subscription)
    }), 200


@subscription_bp.route('/subscriptions/<int:id>/resume', methods=['POST'])
@roles_required('admin', 'staff')
def resume_subscription(id):
    """Resume subscription (set status='active') (admin/staff only)."""
    subscription = db.session.get(Subscription, id)
    if not subscription:
        return jsonify({'error': f'Subscription with id {id} not found.'}), 404

    if subscription.status != 'paused':
        return jsonify({
            'error': f"Invalid status transition. Only 'paused' subscriptions can be resumed (current status: '{subscription.status}')."
        }), 400

    subscription.status = 'active'
    subscription.pause_date = None
    db.session.commit()

    return jsonify({
        'message': 'Subscription resumed successfully.',
        'subscription': subscription_to_dict(subscription)
    }), 200


@subscription_bp.route('/subscriptions/<int:id>/renew', methods=['POST'])
@roles_required('admin', 'staff')
def renew_subscription(id):
    """
    Renew subscription: advance current_period_start and current_period_end based on
    plan billing_interval (admin/staff only).
    """
    subscription = db.session.get(Subscription, id)
    if not subscription:
        return jsonify({'error': f'Subscription with id {id} not found.'}), 404

    if subscription.status == 'closed':
        return jsonify({'error': 'Cannot renew a closed subscription.'}), 400

    plan = db.session.get(Plan, subscription.plan_id)
    if not plan:
        return jsonify({'error': 'Linked subscription plan does not exist.'}), 400

    # Base the renewal from current_period_end if it is still in the future,
    # otherwise from now
    base_start = subscription.current_period_end
    if base_start:
        if base_start.tzinfo is None:
            base_start = base_start.replace(tzinfo=timezone.utc)
        if base_start < utcnow():
            base_start = utcnow()
    else:
        base_start = utcnow()

    new_end = calculate_period_end(base_start, plan.billing_interval)

    subscription.current_period_start = base_start
    subscription.current_period_end = new_end
    subscription.status = 'renewed'
    subscription.pause_date = None
    db.session.commit()

    return jsonify({
        'message': f"Subscription renewed successfully until {new_end.strftime('%Y-%m-%d')}.",
        'subscription': subscription_to_dict(subscription)
    }), 200


@subscription_bp.route('/subscriptions/<int:id>/cancel', methods=['POST'])
@token_required
def cancel_subscription(id):
    """
    Close subscription (set status='closed', record cancellation_reason) (admin/staff/customer).
    """
    user = request.current_user
    subscription = db.session.get(Subscription, id)
    if not subscription:
        return jsonify({'error': f'Subscription with id {id} not found.'}), 404

    # RBAC ownership check for customers
    if user.role == 'customer':
        customer_profile = get_current_customer_profile(user)
        if not customer_profile or subscription.customer_id != customer_profile.id:
            return jsonify({'error': 'Forbidden. You can only cancel your own subscription.'}), 403

    if subscription.status == 'closed':
        return jsonify({'error': 'Subscription is already closed.'}), 400

    data = request.get_json(silent=True) or {}
    cancellation_reason = (data.get('cancellation_reason') or '').strip()

    subscription.status = 'closed'
    subscription.cancellation_reason = cancellation_reason or f"Cancelled by {user.role} ({user.username})"
    subscription.auto_renew = False
    db.session.commit()

    return jsonify({
        'message': 'Subscription has been closed.',
        'subscription': subscription_to_dict(subscription)
    }), 200

