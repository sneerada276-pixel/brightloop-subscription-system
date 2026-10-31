"""
Database models for BrightLoop Subscription Management System.
Designed to support the complete Odoo Make-A-Ton problem statement:
- User authentication & role-based permissions (Admin, Staff, Customer)
- Customer management
- Products & product variants with sales/cost prices
- Subscription plans (daily, weekly, monthly, yearly intervals)
- Quotations & quotation templates
- Subscription lifecycle (draft, active, paused, renewed, closed)
- Invoicing with configurable taxes & status tracking
- Discounts (fixed or percentage, min purchase, usage limits, validity)
- Payment recording and tracking
"""

from datetime import datetime, timezone
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

def utcnow():
    return datetime.now(timezone.utc)

# -------------------------------------------------------------------------
# 1. User & Authentication Models
# -------------------------------------------------------------------------
class User(db.Model):
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(20), nullable=False, default='staff')  # 'admin', 'staff', 'customer'
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    created_at = db.Column(db.DateTime, default=utcnow, nullable=False)

    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username,
            'email': self.email,
            'role': self.role,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

class PasswordResetToken(db.Model):
    __tablename__ = 'password_reset_tokens'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    token = db.Column(db.String(100), unique=True, nullable=False)
    expires_at = db.Column(db.DateTime, nullable=False)
    used = db.Column(db.Boolean, default=False, nullable=False)


# -------------------------------------------------------------------------
# 2. Customer Management Model
# -------------------------------------------------------------------------
class Customer(db.Model):
    __tablename__ = 'customers'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    phone = db.Column(db.String(30), nullable=True)
    company = db.Column(db.String(120), nullable=True)
    address = db.Column(db.Text, nullable=True)
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    created_at = db.Column(db.DateTime, default=utcnow, nullable=False)

    subscriptions = db.relationship('Subscription', backref='customer', lazy=True)
    invoices = db.relationship('Invoice', backref='customer', lazy=True)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'email': self.email,
            'phone': self.phone,
            'company': self.company,
            'address': self.address,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


# -------------------------------------------------------------------------
# 3. Product & Product Variant Models
# -------------------------------------------------------------------------
class Product(db.Model):
    __tablename__ = 'products'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    code = db.Column(db.String(50), unique=True, nullable=False)
    description = db.Column(db.Text, nullable=True)
    sales_price = db.Column(db.Float, nullable=False, default=0.0)
    cost_price = db.Column(db.Float, nullable=False, default=0.0)
    is_active = db.Column(db.Boolean, default=True, nullable=False)

    variants = db.relationship('ProductVariant', backref='product', lazy=True)
    plans = db.relationship('Plan', backref='product', lazy=True)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'code': self.code,
            'description': self.description,
            'sales_price': self.sales_price,
            'cost_price': self.cost_price,
            'is_active': self.is_active
        }

class ProductVariant(db.Model):
    __tablename__ = 'product_variants'

    id = db.Column(db.Integer, primary_key=True)
    product_id = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=False)
    variant_name = db.Column(db.String(100), nullable=False)
    sku = db.Column(db.String(50), unique=True, nullable=False)
    sales_price_override = db.Column(db.Float, nullable=True)
    cost_price_override = db.Column(db.Float, nullable=True)


# -------------------------------------------------------------------------
# 4. Subscription Plans (daily, weekly, monthly, yearly)
# -------------------------------------------------------------------------
class Plan(db.Model):
    __tablename__ = 'plans'

    id = db.Column(db.Integer, primary_key=True)
    product_id = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=True)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text, nullable=True)
    price = db.Column(db.Float, nullable=False, default=0.0)
    # Intervals: 'daily', 'weekly', 'monthly', 'yearly'
    billing_interval = db.Column(db.String(20), nullable=False, default='monthly')
    trial_days = db.Column(db.Integer, default=0, nullable=False)
    is_active = db.Column(db.Boolean, default=True, nullable=False)

    subscriptions = db.relationship('Subscription', backref='plan', lazy=True)

    def to_dict(self):
        return {
            'id': self.id,
            'product_id': self.product_id,
            'name': self.name,
            'description': self.description,
            'price': self.price,
            'billing_interval': self.billing_interval,
            'trial_days': self.trial_days,
            'is_active': self.is_active
        }


# -------------------------------------------------------------------------
# 5. Quotations & Quotation Templates
# -------------------------------------------------------------------------
class QuotationTemplate(db.Model):
    __tablename__ = 'quotation_templates'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    terms_conditions = db.Column(db.Text, nullable=True)
    default_validity_days = db.Column(db.Integer, default=30, nullable=False)

class Quotation(db.Model):
    __tablename__ = 'quotations'

    id = db.Column(db.Integer, primary_key=True)
    quotation_number = db.Column(db.String(50), unique=True, nullable=False)
    customer_id = db.Column(db.Integer, db.ForeignKey('customers.id'), nullable=False)
    template_id = db.Column(db.Integer, db.ForeignKey('quotation_templates.id'), nullable=True)
    plan_id = db.Column(db.Integer, db.ForeignKey('plans.id'), nullable=False)
    total_amount = db.Column(db.Float, nullable=False, default=0.0)
    # Status: 'draft', 'sent', 'accepted', 'rejected', 'expired'
    status = db.Column(db.String(20), default='draft', nullable=False)
    valid_until = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=utcnow, nullable=False)


# -------------------------------------------------------------------------
# 6. Taxes & Discounts
# -------------------------------------------------------------------------
class Tax(db.Model):
    __tablename__ = 'taxes'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), nullable=False)  # e.g., 'GST 18%', 'VAT 5%'
    rate = db.Column(db.Float, nullable=False, default=0.0)
    is_active = db.Column(db.Boolean, default=True, nullable=False)

class Discount(db.Model):
    __tablename__ = 'discounts'

    id = db.Column(db.Integer, primary_key=True)
    code = db.Column(db.String(50), unique=True, nullable=False)
    discount_type = db.Column(db.String(20), nullable=False, default='percentage') # 'percentage', 'fixed'
    value = db.Column(db.Float, nullable=False)
    min_purchase_amount = db.Column(db.Float, default=0.0, nullable=False)
    valid_from = db.Column(db.DateTime, nullable=True)
    valid_to = db.Column(db.DateTime, nullable=True)
    usage_limit = db.Column(db.Integer, default=100, nullable=False)
    used_count = db.Column(db.Integer, default=0, nullable=False)
    is_active = db.Column(db.Boolean, default=True, nullable=False)


# -------------------------------------------------------------------------
# 7. Subscription Lifecycle Management
# -------------------------------------------------------------------------
class Subscription(db.Model):
    __tablename__ = 'subscriptions'

    id = db.Column(db.Integer, primary_key=True)
    customer_id = db.Column(db.Integer, db.ForeignKey('customers.id'), nullable=False)
    plan_id = db.Column(db.Integer, db.ForeignKey('plans.id'), nullable=False)
    quotation_id = db.Column(db.Integer, db.ForeignKey('quotations.id'), nullable=True)
    # Status: 'draft', 'active', 'paused', 'renewed', 'closed'
    status = db.Column(db.String(20), default='active', nullable=False)
    start_date = db.Column(db.DateTime, default=utcnow, nullable=False)
    current_period_start = db.Column(db.DateTime, default=utcnow, nullable=False)
    current_period_end = db.Column(db.DateTime, nullable=False)
    pause_date = db.Column(db.DateTime, nullable=True)
    cancellation_reason = db.Column(db.Text, nullable=True)
    auto_renew = db.Column(db.Boolean, default=True, nullable=False)
    created_at = db.Column(db.DateTime, default=utcnow, nullable=False)

    invoices = db.relationship('Invoice', backref='subscription', lazy=True)

    def to_dict(self):
        return {
            'id': self.id,
            'customer_id': self.customer_id,
            'customer_name': self.customer.name if self.customer else None,
            'plan_id': self.plan_id,
            'plan_name': self.plan.name if self.plan else None,
            'plan_price': self.plan.price if self.plan else 0.0,
            'billing_interval': self.plan.billing_interval if self.plan else 'monthly',
            'status': self.status,
            'start_date': self.start_date.isoformat() if self.start_date else None,
            'current_period_end': self.current_period_end.isoformat() if self.current_period_end else None,
            'auto_renew': self.auto_renew
        }


# -------------------------------------------------------------------------
# 8. Invoicing & Payments
# -------------------------------------------------------------------------
class Invoice(db.Model):
    __tablename__ = 'invoices'

    id = db.Column(db.Integer, primary_key=True)
    invoice_number = db.Column(db.String(50), unique=True, nullable=False)
    subscription_id = db.Column(db.Integer, db.ForeignKey('subscriptions.id'), nullable=True)
    customer_id = db.Column(db.Integer, db.ForeignKey('customers.id'), nullable=False)
    subtotal = db.Column(db.Float, nullable=False, default=0.0)
    tax_id = db.Column(db.Integer, db.ForeignKey('taxes.id'), nullable=True)
    tax_amount = db.Column(db.Float, default=0.0, nullable=False)
    discount_amount = db.Column(db.Float, default=0.0, nullable=False)
    total_amount = db.Column(db.Float, nullable=False, default=0.0)
    # Status: 'draft', 'pending', 'paid', 'overdue', 'cancelled'
    status = db.Column(db.String(20), default='pending', nullable=False)
    issue_date = db.Column(db.DateTime, default=utcnow, nullable=False)
    due_date = db.Column(db.DateTime, nullable=False)

    payments = db.relationship('Payment', backref='invoice', lazy=True)

    def to_dict(self):
        return {
            'id': self.id,
            'invoice_number': self.invoice_number,
            'subscription_id': self.subscription_id,
            'customer_id': self.customer_id,
            'customer_name': self.customer.name if self.customer else None,
            'subtotal': self.subtotal,
            'tax_amount': self.tax_amount,
            'discount_amount': self.discount_amount,
            'total_amount': self.total_amount,
            'status': self.status,
            'issue_date': self.issue_date.isoformat() if self.issue_date else None,
            'due_date': self.due_date.isoformat() if self.due_date else None
        }

class Payment(db.Model):
    __tablename__ = 'payments'

    id = db.Column(db.Integer, primary_key=True)
    invoice_id = db.Column(db.Integer, db.ForeignKey('invoices.id'), nullable=False)
    amount = db.Column(db.Float, nullable=False)
    payment_method = db.Column(db.String(50), default='credit_card', nullable=False) # 'credit_card', 'bank_transfer', 'upi', 'cash'
    payment_date = db.Column(db.DateTime, default=utcnow, nullable=False)
    transaction_id = db.Column(db.String(100), unique=True, nullable=False)
    # Status: 'success', 'failed', 'refunded'
    status = db.Column(db.String(20), default='success', nullable=False)
    notes = db.Column(db.Text, nullable=True)

    def to_dict(self):
        return {
            'id': self.id,
            'invoice_id': self.invoice_id,
            'amount': self.amount,
            'payment_method': self.payment_method,
            'payment_date': self.payment_date.isoformat() if self.payment_date else None,
            'transaction_id': self.transaction_id,
            'status': self.status
        }
