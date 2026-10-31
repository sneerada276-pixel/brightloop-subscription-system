"""
BrightLoop Subscription Management System - Invoicing, Payments & Analytics Routes
Module 4: Invoices, Taxes, Discounts/Promo Codes, Payments, and Financial Dashboard.

Blueprint: invoice_bp

Endpoints:
- GET    /taxes                       — list all taxes (support ?active=true filter)
- POST   /taxes                      — create a tax rule (e.g., GST 18%, VAT 5%) (admin/staff only)
- GET    /discounts                   — list discounts (admin/staff sees all; customer sees active only)
- POST   /discounts                  — create a discount code with unique code (admin/staff only)
- POST   /discounts/validate         — validate discount code for subtotal, check validity & limits
- GET    /invoices                   — list invoices (admin/staff sees all; customer sees own; ?status= filter)
- GET    /invoices/<id>              — get invoice details (with customer, subscription, tax, and payments)
- POST   /invoices                   — create an invoice with unique invoice_number (admin/staff only)
- POST   /invoices/<id>/send         — transition invoice status from 'draft' to 'pending' (admin/staff only)
- POST   /invoices/<id>/cancel       — transition invoice status to 'cancelled' (admin/staff only)
- GET    /payments                   — list payment transactions (admin/staff sees all; customer sees own)
- POST   /payments                   — record payment for an invoice with unique transaction_id. If success, sets invoice status='paid'!
- POST   /payments/<id>/refund       — record payment refund (status='refunded') (admin only)
- GET    /dashboard/stats            — compute financial and subscription KPI summary (MRR, revenue, active subs, overdue)
"""

from datetime import datetime, timezone, timedelta
from functools import wraps
from flask import Blueprint, request, jsonify
from itsdangerous import SignatureExpired, BadSignature

from models import db, Tax, Discount, Invoice, Payment, Subscription, Customer, Plan, User
from routes.auth_routes import get_serializer, TOKEN_MAX_AGE_SECONDS

invoice_bp = Blueprint('invoices', __name__)

ALLOWED_PAYMENT_METHODS = ('credit_card', 'bank_transfer', 'upi', 'cash')
ALLOWED_PAYMENT_STATUSES = ('success', 'failed', 'refunded')
ALLOWED_INVOICE_STATUSES = ('draft', 'pending', 'paid', 'overdue', 'cancelled')
ALLOWED_DISCOUNT_TYPES = ('percentage', 'fixed')


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
# Model Serialization Helpers
# -----------------------------------------------------------------------------

def tax_to_dict(tax):
    """Serialize Tax model."""
    if not tax:
        return None
    return {
        'id': tax.id,
        'name': tax.name,
        'rate': tax.rate,
        'is_active': tax.is_active
    }


def discount_to_dict(discount):
    """Serialize Discount model."""
    if not discount:
        return None
    return {
        'id': discount.id,
        'code': discount.code,
        'discount_type': discount.discount_type,
        'value': discount.value,
        'min_purchase_amount': discount.min_purchase_amount,
        'valid_from': discount.valid_from.isoformat() if discount.valid_from else None,
        'valid_to': discount.valid_to.isoformat() if discount.valid_to else None,
        'usage_limit': discount.usage_limit,
        'used_count': discount.used_count,
        'is_active': discount.is_active
    }


def payment_to_dict(payment):
    """Serialize Payment model."""
    if not payment:
        return None
    inv = payment.invoice if hasattr(payment, 'invoice') else None
    customer_name = None
    invoice_number = None
    if inv:
        invoice_number = inv.invoice_number
        if inv.customer:
            customer_name = inv.customer.name

    data = payment.to_dict()
    data.update({
        'invoice_number': invoice_number,
        'customer_name': customer_name,
        'notes': payment.notes
    })
    return data


def invoice_to_dict(invoice):
    """Serialize Invoice model with customer details, tax info, and payments."""
    if not invoice:
        return None

    tax = db.session.get(Tax, invoice.tax_id) if invoice.tax_id else None

    # Check overdue status dynamically
    is_overdue = False
    if invoice.status == 'pending' and invoice.due_date:
        due_dt = invoice.due_date
        if due_dt.tzinfo is None:
            due_dt = due_dt.replace(tzinfo=timezone.utc)
        if due_dt < utcnow():
            is_overdue = True

    data = invoice.to_dict()
    data.update({
        'tax_id': invoice.tax_id,
        'tax_name': tax.name if tax else None,
        'tax_rate': tax.rate if tax else 0.0,
        'is_overdue': is_overdue,
        'customer_email': invoice.customer.email if invoice.customer else None,
        'customer_company': invoice.customer.company if invoice.customer else None,
        'payments': [payment_to_dict(p) for p in (invoice.payments or [])]
    })
    return data


# -----------------------------------------------------------------------------
# 1. Tax Management
# -----------------------------------------------------------------------------

@invoice_bp.route('/taxes', methods=['GET'])
@token_required
def list_taxes():
    """List taxes, optionally filtered by ?active=true."""
    active_param = request.args.get('active', None)
    q = Tax.query
    if active_param is not None:
        is_active = active_param.strip().lower() in ('true', '1', 'yes')
        q = q.filter(Tax.is_active == is_active)

    taxes = q.order_by(Tax.rate.asc()).all()
    return jsonify({
        'count': len(taxes),
        'taxes': [tax_to_dict(t) for t in taxes]
    }), 200


@invoice_bp.route('/taxes', methods=['POST'])
@roles_required('admin', 'staff')
def create_tax():
    """Create a tax rule (e.g., 'GST 18%', 'VAT 5%') (admin/staff only)."""
    data = request.get_json(silent=True) or {}
    name = (data.get('name') or '').strip()
    rate = data.get('rate')
    is_active = data.get('is_active', True)

    if not name:
        return jsonify({'error': 'Tax name is required.'}), 400

    if rate is None:
        return jsonify({'error': 'Tax rate is required.'}), 400

    try:
        rate = float(rate)
        if rate < 0:
            return jsonify({'error': 'Tax rate cannot be negative.'}), 400
    except (ValueError, TypeError):
        return jsonify({'error': 'Tax rate must be a valid number.'}), 400

    tax = Tax(
        name=name,
        rate=rate,
        is_active=bool(is_active)
    )
    db.session.add(tax)
    db.session.commit()

    return jsonify({
        'message': 'Tax rate created successfully.',
        'tax': tax_to_dict(tax)
    }), 201


# -----------------------------------------------------------------------------
# 2. Discounts & Promo Codes
# -----------------------------------------------------------------------------

@invoice_bp.route('/discounts', methods=['GET'])
@token_required
def list_discounts():
    """
    List discounts.
    - Admin/staff sees all.
    - Customer sees only active discounts within valid dates.
    """
    user = request.current_user
    q = Discount.query

    if user.role == 'customer':
        q = q.filter(Discount.is_active == True)

    discounts = q.order_by(Discount.code.asc()).all()
    return jsonify({
        'count': len(discounts),
        'discounts': [discount_to_dict(d) for d in discounts]
    }), 200


@invoice_bp.route('/discounts', methods=['POST'])
@roles_required('admin', 'staff')
def create_discount():
    """Create a discount code with unique code (admin/staff only)."""
    data = request.get_json(silent=True) or {}
    code = (data.get('code') or '').strip().upper()
    discount_type = (data.get('discount_type') or 'percentage').strip().lower()
    value = data.get('value')
    min_purchase_amount = data.get('min_purchase_amount', 0.0)
    valid_from_str = data.get('valid_from')
    valid_to_str = data.get('valid_to')
    usage_limit = data.get('usage_limit', 100)
    is_active = data.get('is_active', True)

    if not code:
        return jsonify({'error': 'Discount code is required.'}), 400

    if discount_type not in ALLOWED_DISCOUNT_TYPES:
        return jsonify({
            'error': f"Invalid discount_type '{discount_type}'. Allowed: {ALLOWED_DISCOUNT_TYPES}"
        }), 400

    if value is None:
        return jsonify({'error': 'Discount value is required.'}), 400

    try:
        value = float(value)
        if value <= 0:
            return jsonify({'error': 'Discount value must be greater than zero.'}), 400
        if discount_type == 'percentage' and value > 100:
            return jsonify({'error': 'Percentage discount cannot exceed 100%.'}), 400
    except (ValueError, TypeError):
        return jsonify({'error': 'Discount value must be a valid number.'}), 400

    # Uniqueness check
    if Discount.query.filter_by(code=code).first():
        return jsonify({'error': f"A discount with code '{code}' already exists."}), 409

    try:
        min_purchase_amount = float(min_purchase_amount)
        if min_purchase_amount < 0:
            return jsonify({'error': 'min_purchase_amount cannot be negative.'}), 400
    except (ValueError, TypeError):
        return jsonify({'error': 'min_purchase_amount must be a valid number.'}), 400

    valid_from = None
    if valid_from_str:
        try:
            valid_from = datetime.fromisoformat(valid_from_str.replace('Z', '+00:00'))
        except Exception:
            return jsonify({'error': 'valid_from must be a valid ISO date string.'}), 400

    valid_to = None
    if valid_to_str:
        try:
            valid_to = datetime.fromisoformat(valid_to_str.replace('Z', '+00:00'))
        except Exception:
            return jsonify({'error': 'valid_to must be a valid ISO date string.'}), 400

    try:
        usage_limit = int(usage_limit)
        if usage_limit <= 0:
            return jsonify({'error': 'usage_limit must be a positive integer.'}), 400
    except (ValueError, TypeError):
        return jsonify({'error': 'usage_limit must be an integer.'}), 400

    discount = Discount(
        code=code,
        discount_type=discount_type,
        value=value,
        min_purchase_amount=min_purchase_amount,
        valid_from=valid_from,
        valid_to=valid_to,
        usage_limit=usage_limit,
        used_count=0,
        is_active=bool(is_active)
    )
    db.session.add(discount)
    db.session.commit()

    return jsonify({
        'message': f"Discount code '{code}' created successfully.",
        'discount': discount_to_dict(discount)
    }), 201


@invoice_bp.route('/discounts/validate', methods=['POST'])
@token_required
def validate_discount():
    """
    Validate discount code for subtotal, check validity window & usage limit.
    Returns computed discount amount.
    """
    data = request.get_json(silent=True) or {}
    code = (data.get('code') or '').strip().upper()
    subtotal = data.get('subtotal', 0.0)

    if not code:
        return jsonify({'error': 'Discount code is required.'}), 400

    try:
        subtotal = float(subtotal)
        if subtotal < 0:
            return jsonify({'error': 'Subtotal cannot be negative.'}), 400
    except (ValueError, TypeError):
        return jsonify({'error': 'Subtotal must be a valid number.'}), 400

    discount = Discount.query.filter_by(code=code).first()
    if not discount:
        return jsonify({'valid': False, 'error': f"Discount code '{code}' does not exist."}), 404

    if not discount.is_active:
        return jsonify({'valid': False, 'error': f"Discount code '{code}' is inactive."}), 400

    # Check usage limit
    if discount.used_count >= discount.usage_limit:
        return jsonify({'valid': False, 'error': f"Discount code '{code}' usage limit reached."}), 400

    # Check validity dates
    now = utcnow()
    if discount.valid_from:
        v_from = discount.valid_from.replace(tzinfo=timezone.utc) if discount.valid_from.tzinfo is None else discount.valid_from
        if now < v_from:
            return jsonify({'valid': False, 'error': f"Discount code '{code}' is not active yet."}), 400

    if discount.valid_to:
        v_to = discount.valid_to.replace(tzinfo=timezone.utc) if discount.valid_to.tzinfo is None else discount.valid_to
        if now > v_to:
            return jsonify({'valid': False, 'error': f"Discount code '{code}' has expired."}), 400

    # Check minimum purchase amount
    if subtotal < discount.min_purchase_amount:
        return jsonify({
            'valid': False,
            'error': f"Discount code '{code}' requires a minimum purchase of ${discount.min_purchase_amount:.2f}."
        }), 400

    # Compute discount amount
    if discount.discount_type == 'percentage':
        discount_amount = round(subtotal * (discount.value / 100.0), 2)
    else:  # fixed
        discount_amount = round(min(subtotal, discount.value), 2)

    return jsonify({
        'valid': True,
        'discount': discount_to_dict(discount),
        'discount_amount': discount_amount,
        'subtotal_after_discount': max(0.0, round(subtotal - discount_amount, 2))
    }), 200


# -----------------------------------------------------------------------------
# 3. Invoice Management
# -----------------------------------------------------------------------------

@invoice_bp.route('/invoices', methods=['GET'])
@token_required
def list_invoices():
    """
    List invoices.
    - Admin/staff sees all.
    - Customer sees only their own.
    - Supports ?status= filter.
    """
    user = request.current_user
    status_filter = request.args.get('status', '').strip().lower()

    q = Invoice.query

    # Customer scoping
    if user.role == 'customer':
        customer_profile = get_current_customer_profile(user)
        if not customer_profile:
            return jsonify({'count': 0, 'invoices': []}), 200
        q = q.filter(Invoice.customer_id == customer_profile.id)

    # Status filter
    if status_filter and status_filter != 'all':
        if status_filter == 'overdue':
            # Overdue invoices: status is overdue OR (status is pending and due_date < now)
            q = q.filter(
                (Invoice.status == 'overdue') |
                ((Invoice.status == 'pending') & (Invoice.due_date < utcnow()))
            )
        else:
            q = q.filter(Invoice.status == status_filter)

    invoices = q.order_by(Invoice.issue_date.desc()).all()

    return jsonify({
        'count': len(invoices),
        'invoices': [invoice_to_dict(inv) for inv in invoices]
    }), 200


@invoice_bp.route('/invoices/<int:id>', methods=['GET'])
@token_required
def get_invoice(id):
    """Get invoice details (with customer, subscription, tax, and payments)."""
    user = request.current_user
    invoice = db.session.get(Invoice, id)
    if not invoice:
        return jsonify({'error': f'Invoice with id {id} not found.'}), 404

    # Customer RBAC ownership check
    if user.role == 'customer':
        customer_profile = get_current_customer_profile(user)
        if not customer_profile or invoice.customer_id != customer_profile.id:
            return jsonify({'error': 'Forbidden. You can only view your own invoices.'}), 403

    return jsonify({'invoice': invoice_to_dict(invoice)}), 200


@invoice_bp.route('/invoices', methods=['POST'])
@roles_required('admin', 'staff')
def create_invoice():
    """Create an invoice with unique invoice_number (admin/staff only)."""
    data = request.get_json(silent=True) or {}

    invoice_number = (data.get('invoice_number') or '').strip()
    customer_id = data.get('customer_id')
    subscription_id = data.get('subscription_id')
    subtotal = data.get('subtotal')
    tax_id = data.get('tax_id')
    discount_code = (data.get('discount_code') or '').strip().upper()
    discount_amount = data.get('discount_amount', 0.0)
    status = (data.get('status') or 'pending').strip().lower()
    due_date_str = data.get('due_date')

    if not invoice_number:
        return jsonify({'error': 'invoice_number is required.'}), 400

    if not customer_id:
        return jsonify({'error': 'customer_id is required.'}), 400

    if subtotal is None:
        return jsonify({'error': 'subtotal is required.'}), 400

    try:
        subtotal = float(subtotal)
        if subtotal < 0:
            return jsonify({'error': 'subtotal cannot be negative.'}), 400
    except (ValueError, TypeError):
        return jsonify({'error': 'subtotal must be a valid number.'}), 400

    if status not in ALLOWED_INVOICE_STATUSES:
        return jsonify({
            'error': f"Invalid status '{status}'. Allowed: {ALLOWED_INVOICE_STATUSES}"
        }), 400

    # Uniqueness check for invoice_number
    if Invoice.query.filter_by(invoice_number=invoice_number).first():
        return jsonify({'error': f"An invoice with number '{invoice_number}' already exists."}), 409

    # Customer validation
    customer = db.session.get(Customer, customer_id)
    if not customer or not customer.is_active:
        return jsonify({'error': 'Customer does not exist or is inactive.'}), 400

    # Subscription validation if provided
    if subscription_id:
        sub = db.session.get(Subscription, subscription_id)
        if not sub:
            return jsonify({'error': 'Linked subscription does not exist.'}), 400

    # Tax calculation
    tax_amount = 0.0
    if tax_id:
        tax = db.session.get(Tax, tax_id)
        if not tax or not tax.is_active:
            return jsonify({'error': 'Selected tax rule does not exist or is inactive.'}), 400
        # Calculate tax: rate could be 18.0 or 0.18
        effective_rate = tax.rate / 100.0 if tax.rate > 1.0 else tax.rate
        tax_amount = round(subtotal * effective_rate, 2)

    # Discount handling
    if discount_code:
        discount = Discount.query.filter_by(code=discount_code).first()
        if discount and discount.is_active:
            if discount.discount_type == 'percentage':
                discount_amount = round(subtotal * (discount.value / 100.0), 2)
            else:
                discount_amount = round(min(subtotal, discount.value), 2)
            discount.used_count += 1
    else:
        try:
            discount_amount = float(discount_amount)
            if discount_amount < 0:
                return jsonify({'error': 'discount_amount cannot be negative.'}), 400
        except (ValueError, TypeError):
            return jsonify({'error': 'discount_amount must be a valid number.'}), 400

    # Validation formula: total_amount = max(0.0, round(subtotal + tax_amount - discount_amount, 2))
    total_amount = max(0.0, round(subtotal + tax_amount - discount_amount, 2))

    # Due date
    if due_date_str:
        try:
            clean_str = due_date_str.replace('Z', '+00:00')
            due_date = datetime.fromisoformat(clean_str)
        except Exception:
            return jsonify({'error': 'due_date must be a valid ISO 8601 date string.'}), 400
    else:
        # Default due in 30 days
        due_date = utcnow() + timedelta(days=30)

    invoice = Invoice(
        invoice_number=invoice_number,
        subscription_id=subscription_id if subscription_id else None,
        customer_id=customer_id,
        subtotal=subtotal,
        tax_id=tax_id if tax_id else None,
        tax_amount=tax_amount,
        discount_amount=discount_amount,
        total_amount=total_amount,
        status=status,
        issue_date=utcnow(),
        due_date=due_date
    )
    db.session.add(invoice)
    db.session.commit()

    return jsonify({
        'message': 'Invoice created successfully.',
        'invoice': invoice_to_dict(invoice)
    }), 201


@invoice_bp.route('/invoices/<int:id>/send', methods=['POST'])
@roles_required('admin', 'staff')
def send_invoice(id):
    """Transition invoice status from 'draft' to 'pending' (admin/staff only)."""
    invoice = db.session.get(Invoice, id)
    if not invoice:
        return jsonify({'error': f'Invoice with id {id} not found.'}), 404

    if invoice.status != 'draft':
        return jsonify({
            'error': f"Invalid status transition. Only 'draft' invoices can be marked as sent (current status: '{invoice.status}')."
        }), 400

    invoice.status = 'pending'
    db.session.commit()

    return jsonify({
        'message': f"Invoice '{invoice.invoice_number}' sent and marked as pending.",
        'invoice': invoice_to_dict(invoice)
    }), 200


@invoice_bp.route('/invoices/<int:id>/cancel', methods=['POST'])
@roles_required('admin', 'staff')
def cancel_invoice(id):
    """Transition invoice status to 'cancelled' (admin/staff only)."""
    invoice = db.session.get(Invoice, id)
    if not invoice:
        return jsonify({'error': f'Invoice with id {id} not found.'}), 404

    if invoice.status == 'paid':
        return jsonify({'error': 'Cannot cancel an invoice that has already been paid.'}), 400

    if invoice.status == 'cancelled':
        return jsonify({'error': 'Invoice is already cancelled.'}), 400

    invoice.status = 'cancelled'
    db.session.commit()

    return jsonify({
        'message': f"Invoice '{invoice.invoice_number}' has been cancelled.",
        'invoice': invoice_to_dict(invoice)
    }), 200


# -----------------------------------------------------------------------------
# 4. Payment Recording & Processing
# -----------------------------------------------------------------------------

@invoice_bp.route('/payments', methods=['GET'])
@token_required
def list_payments():
    """
    List payment transactions.
    - Admin/staff sees all.
    - Customer sees only their own.
    """
    user = request.current_user
    q = Payment.query

    if user.role == 'customer':
        customer_profile = get_current_customer_profile(user)
        if not customer_profile:
            return jsonify({'count': 0, 'payments': []}), 200
        # Join invoice to filter by customer_id
        q = q.join(Invoice).filter(Invoice.customer_id == customer_profile.id)

    payments = q.order_by(Payment.payment_date.desc()).all()

    return jsonify({
        'count': len(payments),
        'payments': [payment_to_dict(p) for p in payments]
    }), 200


@invoice_bp.route('/payments', methods=['POST'])
@token_required
def record_payment():
    """
    Record payment for an invoice with unique transaction_id (admin/staff/customer).
    If status='success', automatically set linked invoice status to 'paid'!
    """
    user = request.current_user
    data = request.get_json(silent=True) or {}

    invoice_id = data.get('invoice_id')
    amount = data.get('amount')
    payment_method = (data.get('payment_method') or 'credit_card').strip().lower()
    transaction_id = (data.get('transaction_id') or '').strip()
    status = (data.get('status') or 'success').strip().lower()
    notes = (data.get('notes') or '').strip() or None

    if not invoice_id:
        return jsonify({'error': 'invoice_id is required.'}), 400

    if not transaction_id:
        return jsonify({'error': 'transaction_id is required.'}), 400

    if payment_method not in ALLOWED_PAYMENT_METHODS:
        return jsonify({
            'error': f"Invalid payment_method '{payment_method}'. Allowed: {ALLOWED_PAYMENT_METHODS}"
        }), 400

    if status not in ALLOWED_PAYMENT_STATUSES:
        return jsonify({
            'error': f"Invalid payment status '{status}'. Allowed: {ALLOWED_PAYMENT_STATUSES}"
        }), 400

    # Uniqueness check for transaction_id
    if Payment.query.filter_by(transaction_id=transaction_id).first():
        return jsonify({'error': f"Payment with transaction_id '{transaction_id}' already exists."}), 409

    # Invoice validation
    invoice = db.session.get(Invoice, invoice_id)
    if not invoice:
        return jsonify({'error': f'Invoice with id {invoice_id} not found.'}), 404

    # RBAC check: Customers can only pay for their own invoice
    if user.role == 'customer':
        customer_profile = get_current_customer_profile(user)
        if not customer_profile or invoice.customer_id != customer_profile.id:
            return jsonify({'error': 'Forbidden. You can only record payments for your own invoices.'}), 403

    if invoice.status == 'cancelled':
        return jsonify({'error': 'Cannot record payments for a cancelled invoice.'}), 400

    if amount is None:
        amount = invoice.total_amount
    else:
        try:
            amount = float(amount)
            if amount <= 0:
                return jsonify({'error': 'Payment amount must be greater than zero.'}), 400
        except (ValueError, TypeError):
            return jsonify({'error': 'Payment amount must be a valid number.'}), 400

    payment = Payment(
        invoice_id=invoice_id,
        amount=amount,
        payment_method=payment_method,
        payment_date=utcnow(),
        transaction_id=transaction_id,
        status=status,
        notes=notes
    )
    db.session.add(payment)

    # Automatic invoice status transition if payment succeeded
    if status == 'success':
        invoice.status = 'paid'

    db.session.commit()

    return jsonify({
        'message': f"Payment of ${amount:.2f} recorded successfully ({status}).",
        'payment': payment_to_dict(payment),
        'invoice': invoice_to_dict(invoice)
    }), 201


@invoice_bp.route('/payments/<int:id>/refund', methods=['POST'])
@roles_required('admin')
def refund_payment(id):
    """Record payment refund (status='refunded') (admin only)."""
    payment = db.session.get(Payment, id)
    if not payment:
        return jsonify({'error': f'Payment with id {id} not found.'}), 404

    if payment.status == 'refunded':
        return jsonify({'error': 'This payment is already marked as refunded.'}), 400

    payment.status = 'refunded'

    # If linked invoice is paid and has no other successful payment, adjust back to pending
    invoice = payment.invoice
    if invoice and invoice.status == 'paid':
        has_other_success = any(
            p.id != payment.id and p.status == 'success' for p in invoice.payments
        )
        if not has_other_success:
            invoice.status = 'pending'

    db.session.commit()

    return jsonify({
        'message': f"Payment transaction '{payment.transaction_id}' has been refunded.",
        'payment': payment_to_dict(payment)
    }), 200


# -----------------------------------------------------------------------------
# 5. Financial Dashboard & Business Metrics
# -----------------------------------------------------------------------------

@invoice_bp.route('/dashboard/stats', methods=['GET'])
@token_required
def get_dashboard_stats():
    """
    Compute financial and subscription KPI summary:
    - active_subscriptions: count of active or renewed subscriptions
    - total_revenue: sum of successful payments
    - overdue_invoices_count & overdue_amount: invoices with status='overdue' or (status='pending' and due_date < now)
    - mrr: Monthly Recurring Revenue normalized across active subscriptions:
      - daily: price * 30
      - weekly: price * 4.33
      - monthly: price * 1
      - yearly: price / 12
    """
    now = utcnow()

    # 1. Active Subscriptions count & MRR
    active_subs = Subscription.query.filter(
        Subscription.status.in_(['active', 'renewed'])
    ).all()

    active_subscriptions_count = len(active_subs)
    mrr = 0.0

    for sub in active_subs:
        plan = db.session.get(Plan, sub.plan_id)
        if plan and plan.price:
            interval = (plan.billing_interval or 'monthly').strip().lower()
            if interval == 'daily':
                mrr += plan.price * 30.0
            elif interval == 'weekly':
                mrr += plan.price * 4.33
            elif interval == 'yearly':
                mrr += plan.price / 12.0
            else:  # monthly
                mrr += plan.price * 1.0

    mrr = round(mrr, 2)

    # 2. Total Revenue (sum of successful payments)
    successful_payments = Payment.query.filter_by(status='success').all()
    total_revenue = round(sum(p.amount for p in successful_payments), 2)

    # 3. Overdue invoices count and amount
    all_invoices = Invoice.query.all()
    overdue_count = 0
    overdue_amount = 0.0
    pending_amount = 0.0

    for inv in all_invoices:
        if inv.status == 'pending':
            pending_amount += inv.total_amount
            # Check if overdue
            due_dt = inv.due_date
            if due_dt:
                if due_dt.tzinfo is None:
                    due_dt = due_dt.replace(tzinfo=timezone.utc)
                if due_dt < now:
                    overdue_count += 1
                    overdue_amount += inv.total_amount
        elif inv.status == 'overdue':
            overdue_count += 1
            overdue_amount += inv.total_amount

    overdue_amount = round(overdue_amount, 2)
    pending_amount = round(pending_amount, 2)

    return jsonify({
        'active_subscriptions': active_subscriptions_count,
        'total_revenue': total_revenue,
        'mrr': mrr,
        'arr': round(mrr * 12.0, 2),
        'overdue_invoices_count': overdue_count,
        'overdue_amount': overdue_amount,
        'pending_amount': pending_amount,
        'total_payments_count': len(successful_payments)
    }), 200
