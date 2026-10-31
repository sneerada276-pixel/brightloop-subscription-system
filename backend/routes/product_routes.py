"""
BrightLoop Subscription Management System - Product & Plan Routes
Module 2: Products, Product Variants, and Subscription Plans.

Blueprint: product_bp

Endpoints:
- GET    /products                — list all products (with their variants)
- POST   /products                — create a new product (admin/staff only)
- PUT    /products/<id>           — update a product (admin/staff only)
- DELETE /products/<id>           — soft-delete (set is_active=False) (admin only)
- POST   /products/<id>/variants  — add a variant to a product (admin/staff only)
- PUT    /products/variants/<id>  — update a variant (admin/staff only)
- GET    /plans                   — list all active plans (with linked product name)
- POST   /plans                   — create a plan (admin/staff only)
- PUT    /plans/<id>              — update a plan (admin/staff only)
- DELETE /plans/<id>              — soft-delete a plan (admin only)
"""

from functools import wraps
from flask import Blueprint, request, jsonify
from itsdangerous import SignatureExpired, BadSignature

from models import db, Product, ProductVariant, Plan, User
from routes.auth_routes import get_serializer, TOKEN_MAX_AGE_SECONDS

product_bp = Blueprint('products', __name__)

ALLOWED_BILLING_INTERVALS = ('daily', 'weekly', 'monthly', 'yearly')


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


# -----------------------------------------------------------------------------
# Serialization Helpers
# -----------------------------------------------------------------------------

def variant_to_dict(variant):
    """Serialize a ProductVariant model to a dictionary."""
    return {
        'id': variant.id,
        'product_id': variant.product_id,
        'variant_name': variant.variant_name,
        'sku': variant.sku,
        'sales_price_override': variant.sales_price_override,
        'cost_price_override': variant.cost_price_override
    }


def product_to_dict_with_variants(product):
    """Serialize a Product model including all its variants."""
    data = product.to_dict()
    data['variants'] = [variant_to_dict(v) for v in (product.variants or [])]
    return data


def plan_to_dict_with_product(plan):
    """Serialize a Plan model with linked product name."""
    data = plan.to_dict()
    data['product_name'] = plan.product.name if plan.product else None
    return data


# -----------------------------------------------------------------------------
# 1. Product Endpoints
# -----------------------------------------------------------------------------

@product_bp.route('/products', methods=['GET'])
def list_products():
    """
    List all products with their variants.
    Supports optional query filter (?query=...) and active filter (?active=true/false).
    """
    query = request.args.get('query', '').strip()
    active_filter = request.args.get('active', None)

    q = Product.query
    if active_filter is not None:
        is_active = active_filter.lower() in ['true', '1', 'yes']
        q = q.filter(Product.is_active == is_active)

    if query:
        like_pattern = f'%{query}%'
        q = q.filter(
            (Product.name.ilike(like_pattern)) |
            (Product.code.ilike(like_pattern)) |
            (Product.description.ilike(like_pattern))
        )

    products = q.order_by(Product.id.asc()).all()
    products_data = [product_to_dict_with_variants(p) for p in products]

    return jsonify({
        'products': products_data,
        'count': len(products_data)
    }), 200


@product_bp.route('/products', methods=['POST'])
@roles_required('admin', 'staff')
def create_product():
    """
    Create a new product (admin/staff only).
    Fields: name, code (unique), description, sales_price, cost_price, is_active.
    """
    data = request.get_json(silent=True) or {}
    name = (data.get('name') or '').strip()
    code = (data.get('code') or '').strip()
    description = (data.get('description') or '').strip() or None
    raw_sales_price = data.get('sales_price', 0.0)
    raw_cost_price = data.get('cost_price', 0.0)
    is_active = data.get('is_active', True)

    if not name:
        return jsonify({'error': 'Product name is required.'}), 400
    if not code:
        return jsonify({'error': 'Product code is required.'}), 400

    try:
        sales_price = float(raw_sales_price)
        cost_price = float(raw_cost_price)
        if sales_price < 0 or cost_price < 0:
            return jsonify({'error': 'Prices cannot be negative numbers.'}), 400
    except (ValueError, TypeError):
        return jsonify({'error': 'sales_price and cost_price must be valid numeric values.'}), 400

    # Validate unique product code
    if Product.query.filter_by(code=code).first():
        return jsonify({'error': f"Product code '{code}' already exists."}), 409

    try:
        new_product = Product(
            name=name,
            code=code,
            description=description,
            sales_price=sales_price,
            cost_price=cost_price,
            is_active=bool(is_active)
        )
        db.session.add(new_product)
        db.session.commit()

        prod_data = product_to_dict_with_variants(new_product)
        response_dict = {
            'message': 'Product created successfully.',
            'product': prod_data,
            **prod_data
        }
        return jsonify(response_dict), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to create product.'}), 500


@product_bp.route('/products/<int:id>', methods=['PUT'])
@roles_required('admin', 'staff')
def update_product(id):
    """
    Update an existing product (admin/staff only).
    """
    product = db.session.get(Product, id)
    if not product:
        return jsonify({'error': f'Product with id {id} not found.'}), 404

    data = request.get_json(silent=True) or {}

    if 'name' in data:
        name = (data.get('name') or '').strip()
        if not name:
            return jsonify({'error': 'Product name cannot be empty.'}), 400
        product.name = name

    if 'code' in data:
        code = (data.get('code') or '').strip()
        if not code:
            return jsonify({'error': 'Product code cannot be empty.'}), 400
        # Check uniqueness against other products
        duplicate = Product.query.filter(Product.code == code, Product.id != id).first()
        if duplicate:
            return jsonify({'error': f"Product code '{code}' already exists on another product."}), 409
        product.code = code

    if 'description' in data:
        desc = (data.get('description') or '').strip()
        product.description = desc if desc else None

    if 'sales_price' in data:
        try:
            sp = float(data['sales_price'])
            if sp < 0:
                return jsonify({'error': 'Sales price cannot be negative.'}), 400
            product.sales_price = sp
        except (ValueError, TypeError):
            return jsonify({'error': 'sales_price must be a valid number.'}), 400

    if 'cost_price' in data:
        try:
            cp = float(data['cost_price'])
            if cp < 0:
                return jsonify({'error': 'Cost price cannot be negative.'}), 400
            product.cost_price = cp
        except (ValueError, TypeError):
            return jsonify({'error': 'cost_price must be a valid number.'}), 400

    if 'is_active' in data:
        product.is_active = bool(data['is_active'])

    try:
        db.session.commit()
        prod_data = product_to_dict_with_variants(product)
        response_dict = {
            'message': 'Product updated successfully.',
            'product': prod_data,
            **prod_data
        }
        return jsonify(response_dict), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to update product.'}), 500


@product_bp.route('/products/<int:id>', methods=['DELETE'])
@roles_required('admin')
def delete_product(id):
    """
    Soft-delete a product by setting is_active=False (admin only).
    """
    product = db.session.get(Product, id)
    if not product:
        return jsonify({'error': f'Product with id {id} not found.'}), 404

    try:
        product.is_active = False
        db.session.commit()
        prod_data = product_to_dict_with_variants(product)
        response_dict = {
            'message': 'Product deactivated successfully.',
            'product': prod_data,
            **prod_data
        }
        return jsonify(response_dict), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to deactivate product.'}), 500


# -----------------------------------------------------------------------------
# 2. Product Variant Endpoints
# -----------------------------------------------------------------------------

@product_bp.route('/products/<int:id>/variants', methods=['POST'])
@roles_required('admin', 'staff')
def create_variant(id):
    """
    Add a variant to a product (admin/staff only).
    Fields: variant_name, sku (unique), sales_price_override, cost_price_override.
    """
    product = db.session.get(Product, id)
    if not product:
        return jsonify({'error': f'Product with id {id} not found.'}), 404

    data = request.get_json(silent=True) or {}
    variant_name = (data.get('variant_name') or '').strip()
    sku = (data.get('sku') or '').strip()
    raw_sales_override = data.get('sales_price_override', None)
    raw_cost_override = data.get('cost_price_override', None)

    if not variant_name:
        return jsonify({'error': 'Variant name is required.'}), 400
    if not sku:
        return jsonify({'error': 'Variant SKU is required.'}), 400

    sales_price_override = None
    if raw_sales_override is not None and str(raw_sales_override).strip() != '':
        try:
            sales_price_override = float(raw_sales_override)
            if sales_price_override < 0:
                return jsonify({'error': 'sales_price_override cannot be negative.'}), 400
        except (ValueError, TypeError):
            return jsonify({'error': 'sales_price_override must be a valid number.'}), 400

    cost_price_override = None
    if raw_cost_override is not None and str(raw_cost_override).strip() != '':
        try:
            cost_price_override = float(raw_cost_override)
            if cost_price_override < 0:
                return jsonify({'error': 'cost_price_override cannot be negative.'}), 400
        except (ValueError, TypeError):
            return jsonify({'error': 'cost_price_override must be a valid number.'}), 400

    # Validate unique SKU across variants
    if ProductVariant.query.filter_by(sku=sku).first():
        return jsonify({'error': f"Variant SKU '{sku}' already exists."}), 409

    try:
        new_variant = ProductVariant(
            product_id=product.id,
            variant_name=variant_name,
            sku=sku,
            sales_price_override=sales_price_override,
            cost_price_override=cost_price_override
        )
        db.session.add(new_variant)
        db.session.commit()

        v_data = variant_to_dict(new_variant)
        response_dict = {
            'message': 'Variant created successfully.',
            'variant': v_data,
            **v_data
        }
        return jsonify(response_dict), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to create variant.'}), 500


@product_bp.route('/products/variants/<int:id>', methods=['PUT'])
@roles_required('admin', 'staff')
def update_variant(id):
    """
    Update an existing variant (admin/staff only).
    """
    variant = db.session.get(ProductVariant, id)
    if not variant:
        return jsonify({'error': f'Product variant with id {id} not found.'}), 404

    data = request.get_json(silent=True) or {}

    if 'variant_name' in data:
        v_name = (data.get('variant_name') or '').strip()
        if not v_name:
            return jsonify({'error': 'Variant name cannot be empty.'}), 400
        variant.variant_name = v_name

    if 'sku' in data:
        sku = (data.get('sku') or '').strip()
        if not sku:
            return jsonify({'error': 'Variant SKU cannot be empty.'}), 400
        duplicate = ProductVariant.query.filter(ProductVariant.sku == sku, ProductVariant.id != id).first()
        if duplicate:
            return jsonify({'error': f"Variant SKU '{sku}' already exists on another variant."}), 409
        variant.sku = sku

    if 'sales_price_override' in data:
        val = data['sales_price_override']
        if val is None or str(val).strip() == '':
            variant.sales_price_override = None
        else:
            try:
                spo = float(val)
                if spo < 0:
                    return jsonify({'error': 'sales_price_override cannot be negative.'}), 400
                variant.sales_price_override = spo
            except (ValueError, TypeError):
                return jsonify({'error': 'sales_price_override must be a valid number.'}), 400

    if 'cost_price_override' in data:
        val = data['cost_price_override']
        if val is None or str(val).strip() == '':
            variant.cost_price_override = None
        else:
            try:
                cpo = float(val)
                if cpo < 0:
                    return jsonify({'error': 'cost_price_override cannot be negative.'}), 400
                variant.cost_price_override = cpo
            except (ValueError, TypeError):
                return jsonify({'error': 'cost_price_override must be a valid number.'}), 400

    try:
        db.session.commit()
        v_data = variant_to_dict(variant)
        response_dict = {
            'message': 'Variant updated successfully.',
            'variant': v_data,
            **v_data
        }
        return jsonify(response_dict), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to update variant.'}), 500


# -----------------------------------------------------------------------------
# 3. Subscription Plan Endpoints
# -----------------------------------------------------------------------------

@product_bp.route('/plans', methods=['GET'])
def list_plans():
    """
    List subscription plans with linked product name.
    By default returns active plans (is_active=True).
    Optional query param ?include_inactive=true to list all plans (for admin management).
    """
    include_inactive = request.args.get('include_inactive', '').lower() in ['true', '1', 'yes']

    q = Plan.query
    if not include_inactive:
        q = q.filter(Plan.is_active == True)

    plans = q.order_by(Plan.id.asc()).all()
    plans_data = [plan_to_dict_with_product(p) for p in plans]

    return jsonify({
        'plans': plans_data,
        'count': len(plans_data)
    }), 200


@product_bp.route('/plans', methods=['POST'])
@roles_required('admin', 'staff')
def create_plan():
    """
    Create a new subscription plan (admin/staff only).
    Fields: name, price, billing_interval ('daily'/'weekly'/'monthly'/'yearly'),
            product_id (optional), description (optional), trial_days (optional), is_active (optional).
    """
    data = request.get_json(silent=True) or {}
    name = (data.get('name') or '').strip()
    description = (data.get('description') or '').strip() or None
    raw_price = data.get('price', None)
    billing_interval = (data.get('billing_interval') or '').strip().lower()
    raw_trial_days = data.get('trial_days', 0)
    raw_product_id = data.get('product_id', None)
    is_active = data.get('is_active', True)

    if not name:
        return jsonify({'error': 'Plan name is required.'}), 400

    if raw_price is None:
        return jsonify({'error': 'Plan price is required.'}), 400
    try:
        price = float(raw_price)
        if price < 0:
            return jsonify({'error': 'Plan price cannot be negative.'}), 400
    except (ValueError, TypeError):
        return jsonify({'error': 'Plan price must be a valid number.'}), 400

    if billing_interval not in ALLOWED_BILLING_INTERVALS:
        return jsonify({
            'error': f"Invalid billing_interval '{billing_interval}'. Must be one of: {', '.join(ALLOWED_BILLING_INTERVALS)}."
        }), 400

    try:
        trial_days = int(raw_trial_days) if raw_trial_days is not None else 0
        if trial_days < 0:
            return jsonify({'error': 'trial_days cannot be negative.'}), 400
    except (ValueError, TypeError):
        return jsonify({'error': 'trial_days must be an integer.'}), 400

    product_id = None
    if raw_product_id not in (None, '', 0):
        try:
            product_id = int(raw_product_id)
            product = db.session.get(Product, product_id)
            if not product:
                return jsonify({'error': f'Referenced product with id {product_id} does not exist.'}), 404
        except (ValueError, TypeError):
            return jsonify({'error': 'product_id must be a valid integer.'}), 400

    try:
        new_plan = Plan(
            name=name,
            description=description,
            price=price,
            billing_interval=billing_interval,
            trial_days=trial_days,
            product_id=product_id,
            is_active=bool(is_active)
        )
        db.session.add(new_plan)
        db.session.commit()

        plan_data = plan_to_dict_with_product(new_plan)
        response_dict = {
            'message': 'Plan created successfully.',
            'plan': plan_data,
            **plan_data
        }
        return jsonify(response_dict), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to create plan.'}), 500


@product_bp.route('/plans/<int:id>', methods=['PUT'])
@roles_required('admin', 'staff')
def update_plan(id):
    """
    Update an existing subscription plan (admin/staff only).
    """
    plan = db.session.get(Plan, id)
    if not plan:
        return jsonify({'error': f'Plan with id {id} not found.'}), 404

    data = request.get_json(silent=True) or {}

    if 'name' in data:
        name = (data.get('name') or '').strip()
        if not name:
            return jsonify({'error': 'Plan name cannot be empty.'}), 400
        plan.name = name

    if 'description' in data:
        desc = (data.get('description') or '').strip()
        plan.description = desc if desc else None

    if 'price' in data:
        try:
            pr = float(data['price'])
            if pr < 0:
                return jsonify({'error': 'Plan price cannot be negative.'}), 400
            plan.price = pr
        except (ValueError, TypeError):
            return jsonify({'error': 'Plan price must be a valid number.'}), 400

    if 'billing_interval' in data:
        interval = (data.get('billing_interval') or '').strip().lower()
        if interval not in ALLOWED_BILLING_INTERVALS:
            return jsonify({
                'error': f"Invalid billing_interval '{interval}'. Must be one of: {', '.join(ALLOWED_BILLING_INTERVALS)}."
            }), 400
        plan.billing_interval = interval

    if 'trial_days' in data:
        try:
            td = int(data['trial_days'])
            if td < 0:
                return jsonify({'error': 'trial_days cannot be negative.'}), 400
            plan.trial_days = td
        except (ValueError, TypeError):
            return jsonify({'error': 'trial_days must be an integer.'}), 400

    if 'product_id' in data:
        raw_pid = data['product_id']
        if raw_pid in (None, '', 0):
            plan.product_id = None
        else:
            try:
                pid = int(raw_pid)
                prod = db.session.get(Product, pid)
                if not prod:
                    return jsonify({'error': f'Referenced product with id {pid} does not exist.'}), 404
                plan.product_id = pid
            except (ValueError, TypeError):
                return jsonify({'error': 'product_id must be a valid integer.'}), 400

    if 'is_active' in data:
        plan.is_active = bool(data['is_active'])

    try:
        db.session.commit()
        plan_data = plan_to_dict_with_product(plan)
        response_dict = {
            'message': 'Plan updated successfully.',
            'plan': plan_data,
            **plan_data
        }
        return jsonify(response_dict), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to update plan.'}), 500


@product_bp.route('/plans/<int:id>', methods=['DELETE'])
@roles_required('admin')
def delete_plan(id):
    """
    Soft-delete a plan by setting is_active=False (admin only).
    """
    plan = db.session.get(Plan, id)
    if not plan:
        return jsonify({'error': f'Plan with id {id} not found.'}), 404

    try:
        plan.is_active = False
        db.session.commit()
        plan_data = plan_to_dict_with_product(plan)
        response_dict = {
            'message': 'Plan deactivated successfully.',
            'plan': plan_data,
            **plan_data
        }
        return jsonify(response_dict), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to deactivate plan.'}), 500

