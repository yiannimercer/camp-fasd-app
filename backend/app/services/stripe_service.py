"""
Stripe Service for Payment Processing
Handles invoice creation, payment plan management, and webhook processing

Documentation reference: https://stripe.com/docs/api/invoices
"""

import stripe
import hashlib
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, List, Tuple
from uuid import UUID
from decimal import Decimal
from sqlalchemy.orm import Session
from sqlalchemy import text

from ..core.config import get_settings
from ..models.user import User
from ..models.application import Application
from ..models.super_admin import SystemConfiguration

settings = get_settings()

# Initialize Stripe with API key
stripe.api_key = settings.STRIPE_SECRET_KEY


def generate_idempotency_key(*args) -> str:
    """
    Generate a deterministic idempotency key from input arguments.
    This ensures the same operation with the same inputs produces the same key,
    allowing Stripe to deduplicate requests on network retries.

    Args:
        *args: Values to include in the key (e.g., application_id, payment_number, amount)

    Returns:
        A 32-character hash string suitable for Stripe's idempotency_key parameter
    """
    key_data = '-'.join(str(arg) for arg in args)
    return hashlib.sha256(key_data.encode()).hexdigest()[:32]


def get_system_config(db: Session, key: str, default: Any = None) -> Any:
    """Get a system configuration value"""
    config = db.query(SystemConfiguration).filter(SystemConfiguration.key == key).first()
    if config:
        value = config.value
        if isinstance(value, str):
            return value.strip('"')
        return value
    return default


def get_camp_fee(db: Session) -> Decimal:
    """Get the current camp tuition fee from system configuration"""
    fee = get_system_config(db, 'camp_fee', 500.00)
    return Decimal(str(fee))


def get_camp_year(db: Session) -> int:
    """Get the current camp year from system configuration"""
    return int(get_system_config(db, 'camp_year', datetime.now().year))


def calculate_invoice_due_date(db: Session, from_date: Optional[datetime] = None) -> Tuple[datetime, int]:
    """
    Calculate the invoice due date based on billing settings.

    Uses the earlier of:
    1. Calculated date (from_date + invoice_due_days in invoice_due_unit)
    2. Global final due date (if enabled)

    Args:
        db: Database session
        from_date: Start date for calculation (defaults to now)

    Returns:
        Tuple of (due_date, days_until_due)
    """
    if from_date is None:
        from_date = datetime.now(timezone.utc)

    # Get billing settings
    due_days = int(get_system_config(db, 'invoice_due_days', 30))
    due_unit = get_system_config(db, 'invoice_due_unit', 'days')
    final_due_enabled = get_system_config(db, 'invoice_final_due_date_enabled', 'false')
    final_due_date_str = get_system_config(db, 'invoice_final_due_date', '')

    # Calculate the dynamic due date based on unit
    if due_unit == 'weeks':
        calculated_due = from_date + timedelta(days=due_days * 7)
    elif due_unit == 'months':
        # Add months by adding days (approximate, 30 days per month)
        calculated_due = from_date + timedelta(days=due_days * 30)
    else:  # days
        calculated_due = from_date + timedelta(days=due_days)

    # Check if global final due date should be used
    effective_due = calculated_due

    if final_due_enabled in ('true', True, 'True') and final_due_date_str:
        try:
            final_due = datetime.strptime(final_due_date_str, '%Y-%m-%d').replace(tzinfo=timezone.utc)
            # Use the earlier of calculated or global final date
            if final_due < calculated_due:
                effective_due = final_due
        except ValueError:
            # Invalid date format, use calculated date
            pass

    # Calculate days until due for Stripe
    days_until_due = max(1, (effective_due - from_date).days)

    return effective_due, days_until_due


# =============================================================================
# Stripe Customer Management
# =============================================================================

def get_or_create_stripe_customer(
    db: Session,
    user: User,
) -> str:
    """
    Get existing Stripe customer or create a new one.
    Stores the customer ID in the user record for future use.

    Args:
        db: Database session
        user: User model instance

    Returns:
        Stripe customer ID
    """
    # If user already has a Stripe customer ID, verify it still exists
    if user.stripe_customer_id:
        try:
            customer = stripe.Customer.retrieve(user.stripe_customer_id)
            # Check if customer is deleted (attribute only exists on deleted customers)
            if not getattr(customer, 'deleted', False):
                return user.stripe_customer_id
        except stripe.error.InvalidRequestError:
            # Customer doesn't exist in Stripe, create a new one
            pass

    # Create new Stripe customer
    customer_name = f"{user.first_name or ''} {user.last_name or ''}".strip() or user.email

    customer = stripe.Customer.create(
        email=user.email,
        name=customer_name,
        phone=user.phone,
        metadata={
            'user_id': str(user.id),
            'source': 'camp_fasd_app'
        }
    )

    # Save customer ID to user record
    db.execute(
        text("UPDATE users SET stripe_customer_id = :customer_id WHERE id = :user_id"),
        {'customer_id': customer.id, 'user_id': str(user.id)}
    )
    db.commit()

    return customer.id


# =============================================================================
# Invoice Creation
# =============================================================================

def create_invoice_for_application(
    db: Session,
    application: Application,
    user: User,
    amount: Optional[Decimal] = None,
    description: Optional[str] = None,
    due_days: Optional[int] = None,  # Override due days (for payment plans with specific dates)
    created_by: Optional[UUID] = None,
    invoice_type: str = 'initial',  # 'initial', 'scholarship', 'replacement'
) -> Dict[str, Any]:
    """
    Create a Stripe invoice for an application.
    Called automatically when a camper is accepted.

    Args:
        db: Database session
        application: Application model instance
        user: User (parent) who will pay
        amount: Invoice amount (defaults to camp_fee from system config)
        description: Line item description
        due_days: Override for days until due (uses billing settings if None)
        created_by: Admin user ID who initiated the invoice
        invoice_type: Type of invoice for idempotency ('initial', 'scholarship', 'replacement')

    Returns:
        Dict with invoice details including stripe_invoice_id and hosted_url
    """
    # Get or create Stripe customer
    customer_id = get_or_create_stripe_customer(db, user)

    # Get amount from config if not specified
    if amount is None:
        amount = get_camp_fee(db)

    # Convert to cents for Stripe
    amount_cents = int(amount * 100)

    # Get camp year for description
    camp_year = get_camp_year(db)
    camper_name = f"{application.camper_first_name or ''} {application.camper_last_name or ''}".strip() or "Camper"

    if description is None:
        description = f"CAMP {camp_year} Tuition - {camper_name}"

    # Calculate due date from billing settings (or use override for payment plans)
    if due_days is not None:
        # Override provided (e.g., for payment plan with specific dates)
        due_date = datetime.now(timezone.utc) + timedelta(days=due_days)
    else:
        # Use billing settings to calculate due date
        due_date, due_days = calculate_invoice_due_date(db)

    try:
        # Generate idempotency keys to prevent duplicate charges on network retries
        # Include invoice_type to differentiate initial vs scholarship vs replacement invoices
        invoice_idempotency_key = generate_idempotency_key(
            'invoice', application.id, invoice_type, camp_year, amount_cents
        )

        # IMPORTANT: Create invoice FIRST as a draft, then attach line items
        # This ensures items go to THIS invoice, not to pending/draft invoices
        invoice = stripe.Invoice.create(
            customer=customer_id,
            collection_method='send_invoice',
            days_until_due=due_days,
            auto_advance=False,  # Don't auto-finalize - we'll do it manually
            metadata={
                'application_id': str(application.id),
                'camper_name': camper_name,
                'camp_year': camp_year,
                'source': 'camp_fasd_app'
            },
            idempotency_key=invoice_idempotency_key
        )

        # Generate item idempotency key (includes invoice ID for uniqueness)
        item_idempotency_key = generate_idempotency_key(
            'invoice_item', application.id, invoice.id, amount_cents, camp_year
        )

        # Create invoice item and attach it directly to this invoice
        stripe.InvoiceItem.create(
            customer=customer_id,
            invoice=invoice.id,  # CRITICAL: Attach to our specific invoice
            amount=amount_cents,
            currency='usd',
            description=description,
            metadata={
                'application_id': str(application.id),
                'camper_name': camper_name,
                'camp_year': camp_year
            },
            idempotency_key=item_idempotency_key
        )

        # Finalize the invoice to generate the payment link
        invoice = stripe.Invoice.finalize_invoice(invoice.id)

        # Store invoice in our database
        result = db.execute(
            text("""
                INSERT INTO invoices (
                    application_id, stripe_invoice_id, amount, status,
                    due_date, stripe_invoice_url, stripe_hosted_url,
                    description, payment_number, total_payments, created_by
                ) VALUES (
                    :application_id, :stripe_invoice_id, :amount, :status,
                    :due_date, :stripe_invoice_url, :stripe_hosted_url,
                    :description, 1, 1, :created_by
                )
                RETURNING id
            """),
            {
                'application_id': str(application.id),
                'stripe_invoice_id': invoice.id,
                'amount': float(amount),
                'status': 'open',
                'due_date': due_date,
                'stripe_invoice_url': invoice.hosted_invoice_url,
                'stripe_hosted_url': invoice.hosted_invoice_url,
                'description': description,
                'created_by': str(created_by) if created_by else None
            }
        )
        db.commit()

        invoice_id = result.fetchone()[0]

        # Update application with stripe references
        db.execute(
            text("""
                UPDATE applications
                SET stripe_invoice_id = :stripe_invoice_id,
                    stripe_customer_id = :customer_id,
                    paid_invoice = false
                WHERE id = :application_id
            """),
            {
                'stripe_invoice_id': invoice.id,
                'customer_id': customer_id,
                'application_id': str(application.id)
            }
        )
        db.commit()

        return {
            'success': True,
            'invoice_id': str(invoice_id),
            'stripe_invoice_id': invoice.id,
            'hosted_invoice_url': invoice.hosted_invoice_url,
            'amount': float(amount),
            'status': 'open',
            'due_date': due_date.isoformat()
        }

    except stripe.error.StripeError as e:
        return {
            'success': False,
            'error': str(e)
        }


# =============================================================================
# Invoice Management
# =============================================================================

def get_invoices_for_application(db: Session, application_id: UUID) -> List[Dict[str, Any]]:
    """Get all invoices for an application"""
    result = db.execute(
        text("""
            SELECT id, stripe_invoice_id, amount, discount_amount,
                   scholarship_applied, scholarship_note, status, paid_at,
                   payment_number, total_payments, due_date,
                   stripe_invoice_url, voided_at, voided_reason,
                   description, created_at, updated_at
            FROM invoices
            WHERE application_id = :application_id
            ORDER BY payment_number ASC, created_at ASC
        """),
        {'application_id': str(application_id)}
    )

    invoices = []
    for row in result.fetchall():
        invoices.append({
            'id': str(row[0]),
            'application_id': str(application_id),
            'stripe_invoice_id': row[1],
            'amount': float(row[2]) if row[2] else 0,
            'discount_amount': float(row[3]) if row[3] else 0,
            'scholarship_applied': row[4],
            'scholarship_note': row[5],
            'status': row[6],
            'paid_at': row[7].isoformat() if row[7] else None,
            'payment_number': row[8],
            'total_payments': row[9],
            'due_date': row[10].isoformat() if row[10] else None,
            'stripe_invoice_url': row[11],
            'voided_at': row[12].isoformat() if row[12] else None,
            'voided_reason': row[13],
            'description': row[14],
            'created_at': row[15].isoformat() if row[15] else None,
            'updated_at': row[16].isoformat() if row[16] else None,
        })

    return invoices


def void_invoice(
    db: Session,
    invoice_id: UUID,
    reason: str,
    admin_id: UUID
) -> Dict[str, Any]:
    """
    Void an invoice (cannot be undone).
    Used when applying scholarships or canceling.

    Args:
        db: Database session
        invoice_id: Our invoice ID (not Stripe's)
        reason: Reason for voiding
        admin_id: Admin who is voiding

    Returns:
        Dict with result
    """
    # Get the invoice
    result = db.execute(
        text("SELECT stripe_invoice_id, status FROM invoices WHERE id = :id"),
        {'id': str(invoice_id)}
    )
    row = result.fetchone()

    if not row:
        return {'success': False, 'error': 'Invoice not found'}

    stripe_invoice_id, status = row

    if status == 'void':
        return {'success': False, 'error': 'Invoice is already voided'}

    if status == 'paid':
        return {'success': False, 'error': 'Cannot void a paid invoice. Use refund instead.'}

    try:
        # Void in Stripe
        if stripe_invoice_id:
            stripe.Invoice.void_invoice(stripe_invoice_id)

        # Update our database
        db.execute(
            text("""
                UPDATE invoices
                SET status = 'void',
                    voided_at = NOW(),
                    voided_reason = :reason
                WHERE id = :id
            """),
            {'id': str(invoice_id), 'reason': reason}
        )
        db.commit()

        return {'success': True}

    except stripe.error.StripeError as e:
        return {'success': False, 'error': str(e)}


def mark_invoice_paid(
    db: Session,
    invoice_id: UUID,
    admin_id: UUID,
    note: Optional[str] = None
) -> Dict[str, Any]:
    """
    Mark an invoice as paid manually (for offline payments).
    Updates both our database and optionally Stripe.

    Args:
        db: Database session
        invoice_id: Our invoice ID
        admin_id: Admin marking as paid
        note: Optional note about payment

    Returns:
        Dict with result
    """
    # Get the invoice and application
    result = db.execute(
        text("""
            SELECT i.stripe_invoice_id, i.status, i.application_id, i.amount
            FROM invoices i
            WHERE i.id = :id
        """),
        {'id': str(invoice_id)}
    )
    row = result.fetchone()

    if not row:
        return {'success': False, 'error': 'Invoice not found'}

    stripe_invoice_id, status, application_id, amount = row

    if status == 'paid':
        return {'success': False, 'error': 'Invoice is already paid'}

    if status == 'void':
        return {'success': False, 'error': 'Cannot pay a voided invoice'}

    try:
        # Mark as paid in Stripe (if exists)
        if stripe_invoice_id:
            try:
                stripe.Invoice.pay(stripe_invoice_id, paid_out_of_band=True)
            except stripe.error.InvalidRequestError:
                # Invoice might already be paid or in a state that can't be paid
                pass

        # Update our database
        db.execute(
            text("""
                UPDATE invoices
                SET status = 'paid',
                    paid_at = NOW()
                WHERE id = :id
            """),
            {'id': str(invoice_id)}
        )

        # Check if all invoices for this application are paid
        check_result = db.execute(
            text("""
                SELECT COUNT(*) as unpaid
                FROM invoices
                WHERE application_id = :application_id
                  AND status NOT IN ('paid', 'void')
            """),
            {'application_id': str(application_id)}
        )
        unpaid_count = check_result.fetchone()[0]

        # If all invoices are paid, update application
        if unpaid_count == 0:
            db.execute(
                text("""
                    UPDATE applications
                    SET paid_invoice = true,
                        paid_at = NOW()
                    WHERE id = :id
                """),
                {'id': str(application_id)}
            )

        db.commit()

        return {
            'success': True,
            'all_invoices_paid': unpaid_count == 0
        }

    except stripe.error.StripeError as e:
        db.rollback()
        return {'success': False, 'error': str(e)}


def mark_invoice_unpaid(
    db: Session,
    invoice_id: UUID,
    admin_id: UUID,
    reason: Optional[str] = None
) -> Dict[str, Any]:
    """
    Mark a paid invoice as unpaid (for refunds/corrections).
    Creates a new open invoice with the same amount.

    Args:
        db: Database session
        invoice_id: Our invoice ID
        admin_id: Admin marking as unpaid
        reason: Reason for reverting

    Returns:
        Dict with result and new invoice ID
    """
    # Get the invoice details
    result = db.execute(
        text("""
            SELECT stripe_invoice_id, status, application_id, amount,
                   description, payment_number, total_payments
            FROM invoices WHERE id = :id
        """),
        {'id': str(invoice_id)}
    )
    row = result.fetchone()

    if not row:
        return {'success': False, 'error': 'Invoice not found'}

    stripe_invoice_id, status, application_id, amount, description, payment_number, total_payments = row

    if status != 'paid':
        return {'success': False, 'error': 'Invoice is not paid'}

    try:
        # Void the original invoice and mark as refunded
        db.execute(
            text("""
                UPDATE invoices
                SET status = 'void',
                    voided_at = NOW(),
                    voided_reason = :reason
                WHERE id = :id
            """),
            {'id': str(invoice_id), 'reason': reason or 'Marked as unpaid/refunded'}
        )

        # Get application and user for creating new invoice
        app_result = db.execute(
            text("SELECT id, user_id FROM applications WHERE id = :id"),
            {'id': str(application_id)}
        )
        app_row = app_result.fetchone()

        if app_row:
            application = db.query(Application).filter(Application.id == application_id).first()
            user = db.query(User).filter(User.id == app_row[1]).first()

            if application and user:
                # Create a new invoice
                # Use invoice_type='replacement' to generate unique idempotency key
                new_invoice_result = create_invoice_for_application(
                    db=db,
                    application=application,
                    user=user,
                    amount=Decimal(str(amount)),
                    description=description or f"CAMP Tuition (Reissued)",
                    created_by=admin_id,
                    invoice_type='replacement'
                )

                if new_invoice_result['success']:
                    # Update application to unpaid
                    db.execute(
                        text("""
                            UPDATE applications
                            SET paid_invoice = false,
                                paid_at = NULL
                            WHERE id = :id
                        """),
                        {'id': str(application_id)}
                    )
                    db.commit()

                    return {
                        'success': True,
                        'new_invoice_id': new_invoice_result['invoice_id'],
                        'new_stripe_invoice_id': new_invoice_result['stripe_invoice_id']
                    }

        db.commit()
        return {'success': True}

    except Exception as e:
        db.rollback()
        return {'success': False, 'error': str(e)}


# =============================================================================
# Scholarship Management
# =============================================================================

def apply_scholarship(
    db: Session,
    application_id: UUID,
    scholarship_amount: Decimal,
    scholarship_note: str,
    admin_id: UUID
) -> Dict[str, Any]:
    """
    Apply a scholarship by voiding the current invoice and creating a new one
    with the reduced amount.

    Args:
        db: Database session
        application_id: Application to apply scholarship to
        scholarship_amount: Amount to discount
        scholarship_note: Note explaining the scholarship
        admin_id: Admin applying the scholarship

    Returns:
        Dict with new invoice details
    """
    # Get current open invoice
    result = db.execute(
        text("""
            SELECT id, stripe_invoice_id, amount
            FROM invoices
            WHERE application_id = :application_id
              AND status = 'open'
            ORDER BY created_at DESC
            LIMIT 1
        """),
        {'application_id': str(application_id)}
    )
    row = result.fetchone()

    if not row:
        return {'success': False, 'error': 'No open invoice found'}

    invoice_id, stripe_invoice_id, current_amount = row
    new_amount = Decimal(str(current_amount)) - scholarship_amount

    if new_amount < 0:
        return {'success': False, 'error': 'Scholarship amount exceeds invoice amount'}

    try:
        # Void the old invoice
        void_result = void_invoice(
            db=db,
            invoice_id=invoice_id,
            reason=f"Scholarship applied: {scholarship_note}",
            admin_id=admin_id
        )

        if not void_result['success']:
            return void_result

        # If scholarship covers full amount, just mark as complete
        if new_amount == 0:
            db.execute(
                text("""
                    UPDATE applications
                    SET paid_invoice = true,
                        paid_at = NOW()
                    WHERE id = :id
                """),
                {'id': str(application_id)}
            )
            db.commit()

            return {
                'success': True,
                'message': 'Full scholarship applied - no payment required',
                'new_amount': 0
            }

        # Get application and user for new invoice
        application = db.query(Application).filter(Application.id == application_id).first()
        user = db.query(User).filter(User.id == application.user_id).first()

        if not application or not user:
            return {'success': False, 'error': 'Application or user not found'}

        camp_year = get_camp_year(db)
        camper_name = f"{application.camper_first_name or ''} {application.camper_last_name or ''}".strip() or "Camper"

        # Create new invoice with reduced amount
        # Use invoice_type='scholarship' to generate unique idempotency key
        new_invoice = create_invoice_for_application(
            db=db,
            application=application,
            user=user,
            amount=new_amount,
            description=f"CAMP {camp_year} Tuition - {camper_name} (Scholarship Applied)",
            created_by=admin_id,
            invoice_type='scholarship'
        )

        if new_invoice['success']:
            # Update the new invoice with scholarship info
            db.execute(
                text("""
                    UPDATE invoices
                    SET scholarship_applied = true,
                        scholarship_note = :note,
                        discount_amount = :discount
                    WHERE id = :id
                """),
                {
                    'id': new_invoice['invoice_id'],
                    'note': scholarship_note,
                    'discount': float(scholarship_amount)
                }
            )
            db.commit()

            new_invoice['scholarship_applied'] = True
            new_invoice['discount_amount'] = float(scholarship_amount)

        return new_invoice

    except Exception as e:
        db.rollback()
        return {'success': False, 'error': str(e)}


# =============================================================================
# Payment Plan Management
# =============================================================================

def create_payment_plan(
    db: Session,
    application_id: UUID,
    payment_amounts: List[Decimal],
    payment_dates: List[datetime],
    admin_id: UUID
) -> Dict[str, Any]:
    """
    Convert an invoice to a payment plan with multiple invoices.
    Voids the existing invoice and creates multiple new ones.

    Args:
        db: Database session
        application_id: Application to create plan for
        payment_amounts: List of amounts for each payment
        payment_dates: List of due dates for each payment
        admin_id: Admin creating the plan

    Returns:
        Dict with list of new invoice IDs
    """
    if len(payment_amounts) != len(payment_dates):
        return {'success': False, 'error': 'Payment amounts and dates must match'}

    if len(payment_amounts) < 2:
        return {'success': False, 'error': 'Payment plan must have at least 2 payments'}

    # Get current open invoice
    result = db.execute(
        text("""
            SELECT id, amount
            FROM invoices
            WHERE application_id = :application_id
              AND status = 'open'
            ORDER BY created_at DESC
            LIMIT 1
        """),
        {'application_id': str(application_id)}
    )
    row = result.fetchone()

    if not row:
        return {'success': False, 'error': 'No open invoice found'}

    invoice_id, current_amount = row

    # Verify total matches
    total_plan_amount = sum(payment_amounts)
    if abs(float(total_plan_amount) - float(current_amount)) > 0.01:
        return {
            'success': False,
            'error': f'Payment plan total ({total_plan_amount}) must equal invoice amount ({current_amount})'
        }

    try:
        # Void the original invoice
        void_result = void_invoice(
            db=db,
            invoice_id=invoice_id,
            reason=f"Converted to {len(payment_amounts)}-payment plan",
            admin_id=admin_id
        )

        if not void_result['success']:
            return void_result

        # Get application and user
        application = db.query(Application).filter(Application.id == application_id).first()
        user = db.query(User).filter(User.id == application.user_id).first()

        if not application or not user:
            return {'success': False, 'error': 'Application or user not found'}

        customer_id = get_or_create_stripe_customer(db, user)
        camp_year = get_camp_year(db)
        camper_name = f"{application.camper_first_name or ''} {application.camper_last_name or ''}".strip() or "Camper"

        total_payments = len(payment_amounts)
        new_invoices = []

        for i, (amount, due_date) in enumerate(zip(payment_amounts, payment_dates)):
            payment_number = i + 1
            days_until_due = max(1, (due_date - datetime.now(timezone.utc)).days)

            description = f"CAMP {camp_year} Tuition - {camper_name} (Payment {payment_number} of {total_payments})"

            # Generate idempotency key for invoice
            amount_cents = int(amount * 100)
            invoice_idempotency_key = generate_idempotency_key(
                'payment_plan_invoice', application_id, payment_number, total_payments
            )

            # IMPORTANT: Create invoice FIRST as a draft, then attach line items
            stripe_invoice = stripe.Invoice.create(
                customer=customer_id,
                collection_method='send_invoice',
                days_until_due=days_until_due,
                auto_advance=False,  # Don't auto-finalize - we'll do it manually
                metadata={
                    'application_id': str(application_id),
                    'payment_number': payment_number,
                    'total_payments': total_payments,
                    'source': 'camp_fasd_app'
                },
                idempotency_key=invoice_idempotency_key
            )

            # Generate item idempotency key (includes invoice ID for uniqueness)
            item_idempotency_key = generate_idempotency_key(
                'payment_plan_item', application_id, stripe_invoice.id, payment_number, amount_cents
            )

            # Create invoice item and attach it directly to this invoice
            stripe.InvoiceItem.create(
                customer=customer_id,
                invoice=stripe_invoice.id,  # CRITICAL: Attach to our specific invoice
                amount=amount_cents,
                currency='usd',
                description=description,
                metadata={
                    'application_id': str(application_id),
                    'payment_number': payment_number,
                    'total_payments': total_payments
                },
                idempotency_key=item_idempotency_key
            )

            # Finalize the invoice to generate the payment link
            stripe_invoice = stripe.Invoice.finalize_invoice(stripe_invoice.id)

            # Store in our database
            result = db.execute(
                text("""
                    INSERT INTO invoices (
                        application_id, stripe_invoice_id, amount, status,
                        due_date, stripe_invoice_url, stripe_hosted_url,
                        description, payment_number, total_payments, created_by
                    ) VALUES (
                        :application_id, :stripe_invoice_id, :amount, :status,
                        :due_date, :stripe_invoice_url, :stripe_hosted_url,
                        :description, :payment_number, :total_payments, :created_by
                    )
                    RETURNING id
                """),
                {
                    'application_id': str(application_id),
                    'stripe_invoice_id': stripe_invoice.id,
                    'amount': float(amount),
                    'status': 'open',
                    'due_date': due_date,
                    'stripe_invoice_url': stripe_invoice.hosted_invoice_url,
                    'stripe_hosted_url': stripe_invoice.hosted_invoice_url,
                    'description': description,
                    'payment_number': payment_number,
                    'total_payments': total_payments,
                    'created_by': str(admin_id)
                }
            )

            new_invoice_id = result.fetchone()[0]
            new_invoices.append({
                'id': str(new_invoice_id),
                'stripe_invoice_id': stripe_invoice.id,
                'amount': float(amount),
                'payment_number': payment_number,
                'due_date': due_date.isoformat(),
                'hosted_invoice_url': stripe_invoice.hosted_invoice_url
            })

        db.commit()

        return {
            'success': True,
            'invoices': new_invoices,
            'total_payments': total_payments
        }

    except stripe.error.StripeError as e:
        db.rollback()
        return {'success': False, 'error': str(e)}
    except Exception as e:
        db.rollback()
        return {'success': False, 'error': str(e)}


# =============================================================================
# Webhook Processing
# =============================================================================

def handle_invoice_paid(stripe_invoice_id: str, db: Session) -> Dict[str, Any]:
    """
    Handle invoice.paid webhook event from Stripe.
    Updates our database when payment is received.

    Uses row-level locking (FOR UPDATE) to prevent race conditions when
    multiple webhooks are processed concurrently for the same application.

    Args:
        stripe_invoice_id: The Stripe invoice ID from webhook
        db: Database session

    Returns:
        Dict with result
    """
    print(f"[handle_invoice_paid] Looking for invoice with stripe_invoice_id: {stripe_invoice_id}")

    # Find invoice in our database with row lock to prevent race conditions
    result = db.execute(
        text("""
            SELECT id, application_id, status
            FROM invoices
            WHERE stripe_invoice_id = :stripe_invoice_id
            FOR UPDATE
        """),
        {'stripe_invoice_id': stripe_invoice_id}
    )
    row = result.fetchone()

    if not row:
        # Debug: show what invoices we DO have
        debug_result = db.execute(text("SELECT stripe_invoice_id FROM invoices ORDER BY created_at DESC LIMIT 5"))
        debug_rows = debug_result.fetchall()
        print(f"[handle_invoice_paid] Invoice NOT FOUND! Recent invoices in DB: {[r[0] for r in debug_rows]}")
        return {'success': False, 'error': 'Invoice not found in database'}

    invoice_id, application_id, current_status = row
    print(f"[handle_invoice_paid] Found invoice: id={invoice_id}, app_id={application_id}, status={current_status}")

    if current_status == 'paid':
        print(f"[handle_invoice_paid] Invoice already paid, skipping")
        return {'success': True, 'message': 'Invoice already marked as paid'}

    # Update invoice status
    print(f"[handle_invoice_paid] Updating invoice {invoice_id} to 'paid'")
    db.execute(
        text("""
            UPDATE invoices
            SET status = 'paid',
                paid_at = NOW()
            WHERE id = :id
        """),
        {'id': str(invoice_id)}
    )

    # Check if there are any remaining unpaid invoices for this application
    # Note: We already have a row lock on this invoice from the SELECT FOR UPDATE above,
    # and we're inside a transaction, so this count is consistent
    check_result = db.execute(
        text("""
            SELECT COUNT(*) as unpaid
            FROM invoices
            WHERE application_id = :application_id
              AND status NOT IN ('paid', 'void')
        """),
        {'application_id': str(application_id)}
    )
    unpaid_count = check_result.fetchone()[0]

    # If all invoices are paid, update application
    if unpaid_count == 0:
        print(f"[handle_invoice_paid] All invoices paid! Updating application {application_id} paid_invoice=true")
        db.execute(
            text("""
                UPDATE applications
                SET paid_invoice = true,
                    paid_at = NOW()
                WHERE id = :id
            """),
            {'id': str(application_id)}
        )
    else:
        print(f"[handle_invoice_paid] {unpaid_count} unpaid invoice(s) remaining")

    print(f"[handle_invoice_paid] Committing transaction...")
    db.commit()
    print(f"[handle_invoice_paid] SUCCESS! Invoice marked as paid")

    return {
        'success': True,
        'all_invoices_paid': unpaid_count == 0
    }


def handle_invoice_payment_failed(stripe_invoice_id: str, db: Session) -> Dict[str, Any]:
    """
    Handle invoice.payment_failed webhook event from Stripe.
    Could trigger reminder emails or admin notifications.

    Args:
        stripe_invoice_id: The Stripe invoice ID from webhook
        db: Database session

    Returns:
        Dict with result
    """
    # Find invoice in our database
    result = db.execute(
        text("""
            SELECT id, application_id
            FROM invoices
            WHERE stripe_invoice_id = :stripe_invoice_id
        """),
        {'stripe_invoice_id': stripe_invoice_id}
    )
    row = result.fetchone()

    if not row:
        return {'success': False, 'error': 'Invoice not found in database'}

    # Could add logic here to:
    # - Send notification email
    # - Log the failure
    # - Update attempt count

    return {'success': True, 'action': 'payment_failed_logged'}


def verify_webhook_signature(payload: bytes, sig_header: str) -> bool:
    """
    Verify the Stripe webhook signature.

    Args:
        payload: Raw request body
        sig_header: Stripe-Signature header

    Returns:
        True if valid, False otherwise
    """
    try:
        stripe.Webhook.construct_event(
            payload, sig_header, settings.STRIPE_WEBHOOK_SECRET
        )
        return True
    except (ValueError, stripe.error.SignatureVerificationError):
        return False


def parse_webhook_event(payload: bytes, sig_header: str) -> Optional[stripe.Event]:
    """
    Parse and verify a Stripe webhook event.

    Args:
        payload: Raw request body
        sig_header: Stripe-Signature header

    Returns:
        Stripe Event object or None if verification fails
    """
    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, settings.STRIPE_WEBHOOK_SECRET
        )
        return event
    except ValueError as e:
        print(f"[Stripe Webhook] Invalid payload: {e}")
        return None
    except stripe.error.SignatureVerificationError as e:
        print(f"[Stripe Webhook] Signature verification FAILED: {e}")
        print(f"[Stripe Webhook] Make sure STRIPE_WEBHOOK_SECRET matches the secret from 'stripe listen'")
        return None
