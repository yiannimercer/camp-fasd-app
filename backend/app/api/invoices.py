"""
Invoice API routes for payment management
Handles invoice viewing, management, and payment plan administration
"""

from typing import List, Optional
from datetime import datetime, timezone
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, status, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from uuid import UUID

from app.core.database import get_db
from app.core.deps import get_current_user, get_current_admin_user
from app.core.audit import log_application_event
from app.models.user import User
from app.models.application import Application, Invoice
from app.services import stripe_service
from app.services.email_events import fire_email_event

router = APIRouter(prefix="/invoices", tags=["invoices"])


# =============================================================================
# Pydantic Schemas
# =============================================================================

class InvoiceResponse(BaseModel):
    """Invoice response schema"""
    id: str
    application_id: str
    stripe_invoice_id: Optional[str] = None
    amount: float
    discount_amount: float = 0
    scholarship_applied: bool = False
    scholarship_note: Optional[str] = None
    status: str
    paid_at: Optional[str] = None
    payment_number: int = 1
    total_payments: int = 1
    due_date: Optional[str] = None
    stripe_invoice_url: Optional[str] = None
    voided_at: Optional[str] = None
    voided_reason: Optional[str] = None
    description: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class ApplyScholarshipRequest(BaseModel):
    """Request to apply a scholarship"""
    scholarship_amount: Decimal = Field(..., gt=0, description="Amount to discount", decimal_places=2)
    scholarship_note: str = Field(..., min_length=3, description="Explanation for scholarship")


class PaymentPlanPayment(BaseModel):
    """Individual payment in a payment plan - uses Decimal for financial precision"""
    amount: Decimal = Field(..., gt=0, decimal_places=2, description="Payment amount in dollars")
    due_date: str = Field(..., description="Due date in ISO format (YYYY-MM-DD)")


class CreatePaymentPlanRequest(BaseModel):
    """Request to create a payment plan"""
    payments: List[PaymentPlanPayment] = Field(..., min_items=2, max_items=12)


class MarkPaidRequest(BaseModel):
    """Request to mark invoice as paid"""
    note: Optional[str] = None


class MarkUnpaidRequest(BaseModel):
    """Request to mark invoice as unpaid (refund)"""
    reason: str = Field(..., min_length=3, description="Reason for reverting payment")


class VoidInvoiceRequest(BaseModel):
    """Request to void an invoice"""
    reason: str = Field(..., min_length=3, description="Reason for voiding")


# =============================================================================
# User Endpoints - View own invoices
# =============================================================================

@router.get("/my-invoices", response_model=List[InvoiceResponse])
async def get_my_invoices(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get all invoices for the current user's applications.
    Returns invoices across all of the user's applications.
    """
    # Get all applications for this user
    applications = db.query(Application).filter(
        Application.user_id == current_user.id
    ).all()

    all_invoices = []
    for app in applications:
        invoices = stripe_service.get_invoices_for_application(db, app.id)
        for inv in invoices:
            inv['application_id'] = str(app.id)
            all_invoices.append(inv)

    return all_invoices


@router.get("/application/{application_id}", response_model=List[InvoiceResponse])
async def get_invoices_for_application(
    application_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get all invoices for a specific application.
    Users can only view their own applications. Admins can view any.

    Security: Returns 404 for both "not found" and "not authorized" cases
    to prevent application ID enumeration attacks.
    """
    # Authorization-aware query to prevent information disclosure
    # For regular users, only return their own applications
    # For admins, return any application
    if current_user.role in ['admin', 'super_admin']:
        application = db.query(Application).filter(
            Application.id == application_id
        ).first()
    else:
        # Regular users can only see their own applications
        application = db.query(Application).filter(
            Application.id == application_id,
            Application.user_id == current_user.id
        ).first()

    # Return 404 for both "not found" and "not authorized" to prevent enumeration
    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Application not found"
        )

    invoices = stripe_service.get_invoices_for_application(db, UUID(application_id))
    return invoices


# =============================================================================
# Admin Endpoints - Invoice Management
# =============================================================================

@router.get("/admin/application/{application_id}", response_model=List[InvoiceResponse])
async def admin_get_invoices(
    application_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """
    Admin endpoint to get all invoices for an application.
    """
    application = db.query(Application).filter(
        Application.id == application_id
    ).first()

    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Application not found"
        )

    invoices = stripe_service.get_invoices_for_application(db, UUID(application_id))
    return invoices


@router.post("/admin/application/{application_id}/create")
async def admin_create_invoice(
    application_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """
    Manually create an invoice for an application.
    Typically invoices are auto-created on acceptance, but this allows manual creation.
    """
    application = db.query(Application).filter(
        Application.id == application_id
    ).first()

    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Application not found"
        )

    if application.status != 'camper':
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Can only create invoices for accepted campers"
        )

    user = db.query(User).filter(User.id == application.user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Application user not found"
        )

    result = stripe_service.create_invoice_for_application(
        db=db,
        application=application,
        user=user,
        created_by=current_user.id
    )

    if not result['success']:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=result.get('error', 'Failed to create invoice')
        )

    # Log audit event
    log_application_event(
        db=db,
        action='invoice_created',
        application_id=UUID(application_id),
        actor_id=current_user.id,
        details={
            'invoice_id': result['invoice_id'],
            'amount': result['amount']
        },
        request=request
    )

    return result


@router.post("/admin/{invoice_id}/apply-scholarship")
async def admin_apply_scholarship(
    invoice_id: str,
    scholarship_request: ApplyScholarshipRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """
    Apply a scholarship to an application.
    Voids the current invoice and creates a new one with reduced amount.
    """
    # Get the invoice to find the application
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invoice not found"
        )

    # Store values before any commits - invoice object may become detached after apply_scholarship
    application_id = invoice.application_id
    original_amount = float(invoice.amount)

    print(f"[Scholarship] Starting - invoice_id={invoice_id}, application_id={application_id}, original_amount={original_amount}")

    result = stripe_service.apply_scholarship(
        db=db,
        application_id=application_id,  # Use stored value
        scholarship_amount=Decimal(str(scholarship_request.scholarship_amount)),
        scholarship_note=scholarship_request.scholarship_note,
        admin_id=current_user.id
    )

    print(f"[Scholarship] apply_scholarship returned: success={result.get('success')}, error={result.get('error')}")

    if not result['success']:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result.get('error', 'Failed to apply scholarship')
        )

    # Log audit event - use stored application_id
    log_application_event(
        db=db,
        action='scholarship_applied',
        application_id=application_id,  # Use stored value
        actor_id=current_user.id,
        details={
            'scholarship_amount': float(scholarship_request.scholarship_amount),
            'note': scholarship_request.scholarship_note
        },
        request=request
    )

    print(f"[Scholarship] Audit event logged, firing email event")

    # Fire scholarship_awarded email event
    # Get application for user_id context - use stored application_id
    application = db.query(Application).filter(
        Application.id == application_id  # Use stored value
    ).first()

    if application:
        try:
            await fire_email_event(
                db=db,
                event='scholarship_awarded',
                application_id=application_id,  # Use stored value
                user_id=application.user_id,
                extra_context={
                    'scholarshipAmount': float(scholarship_request.scholarship_amount),
                    'originalAmount': original_amount,  # Use stored value
                    'newAmount': result.get('amount', 0),
                    'scholarshipNote': scholarship_request.scholarship_note,
                    'paymentUrl': result.get('hosted_invoice_url', ''),
                    'allPaid': result.get('new_amount', 1) == 0  # True if full scholarship
                }
            )
            print(f"[Scholarship] Email event fired successfully")
        except Exception as e:
            # Log but don't fail the request - scholarship was applied successfully
            print(f"[Scholarship] Failed to fire email event: {e}")
            import traceback
            traceback.print_exc()

    print(f"[Scholarship] Returning result")
    return result


@router.post("/admin/{invoice_id}/mark-paid")
async def admin_mark_paid(
    invoice_id: str,
    paid_request: MarkPaidRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """
    Mark an invoice as paid (for offline/manual payments).
    """
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invoice not found"
        )

    result = stripe_service.mark_invoice_paid(
        db=db,
        invoice_id=UUID(invoice_id),
        admin_id=current_user.id,
        note=paid_request.note
    )

    if not result['success']:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result.get('error', 'Failed to mark invoice as paid')
        )

    # Log audit event
    log_application_event(
        db=db,
        action='invoice_marked_paid',
        application_id=invoice.application_id,
        actor_id=current_user.id,
        details={
            'invoice_id': invoice_id,
            'note': paid_request.note,
            'all_invoices_paid': result.get('all_invoices_paid', False)
        },
        request=request
    )

    return result


@router.post("/admin/{invoice_id}/mark-unpaid")
async def admin_mark_unpaid(
    invoice_id: str,
    unpaid_request: MarkUnpaidRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """
    Mark a paid invoice as unpaid (for refunds/corrections).
    Creates a new open invoice with the same amount.
    """
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invoice not found"
        )

    result = stripe_service.mark_invoice_unpaid(
        db=db,
        invoice_id=UUID(invoice_id),
        admin_id=current_user.id,
        reason=unpaid_request.reason
    )

    if not result['success']:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result.get('error', 'Failed to mark invoice as unpaid')
        )

    # Log audit event
    log_application_event(
        db=db,
        action='invoice_marked_unpaid',
        application_id=invoice.application_id,
        actor_id=current_user.id,
        details={
            'original_invoice_id': invoice_id,
            'reason': unpaid_request.reason,
            'new_invoice_id': result.get('new_invoice_id')
        },
        request=request
    )

    return result


@router.post("/admin/{invoice_id}/void")
async def admin_void_invoice(
    invoice_id: str,
    void_request: VoidInvoiceRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """
    Void an invoice (cannot be undone).
    Used when canceling or when scholarship covers full amount.
    """
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invoice not found"
        )

    result = stripe_service.void_invoice(
        db=db,
        invoice_id=UUID(invoice_id),
        reason=void_request.reason,
        admin_id=current_user.id
    )

    if not result['success']:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result.get('error', 'Failed to void invoice')
        )

    # Log audit event
    log_application_event(
        db=db,
        action='invoice_voided',
        application_id=invoice.application_id,
        actor_id=current_user.id,
        details={
            'invoice_id': invoice_id,
            'reason': void_request.reason
        },
        request=request
    )

    return result


@router.post("/admin/application/{application_id}/payment-plan")
async def admin_create_payment_plan(
    application_id: str,
    plan_request: CreatePaymentPlanRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """
    Convert an existing invoice to a payment plan with multiple invoices.
    Voids the current invoice and creates new ones based on the plan.
    """
    application = db.query(Application).filter(
        Application.id == application_id
    ).first()

    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Application not found"
        )

    # Extract payment plan from validated Pydantic model
    # Amounts are already Decimal from PaymentPlanPayment model
    try:
        payment_amounts = [p.amount for p in plan_request.payments]
        payment_dates = [
            datetime.fromisoformat(p.due_date.replace('Z', '+00:00'))
            for p in plan_request.payments
        ]
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid date format: {e}"
        )

    result = stripe_service.create_payment_plan(
        db=db,
        application_id=UUID(application_id),
        payment_amounts=payment_amounts,
        payment_dates=payment_dates,
        admin_id=current_user.id
    )

    if not result['success']:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result.get('error', 'Failed to create payment plan')
        )

    # Log audit event
    log_application_event(
        db=db,
        action='payment_plan_created',
        application_id=UUID(application_id),
        actor_id=current_user.id,
        details={
            'total_payments': result['total_payments'],
            'payment_amounts': [float(a) for a in payment_amounts]
        },
        request=request
    )

    # Fire payment_plan_created email event
    try:
        # Build payment breakdown HTML for the email
        payment_breakdown_lines = []
        for i, amount in enumerate(payment_amounts, 1):
            payment_breakdown_lines.append(f"Payment {i}: ${float(amount):,.2f}")
        payment_breakdown_html = "<br>".join(payment_breakdown_lines)

        total_amount = sum(float(a) for a in payment_amounts)

        await fire_email_event(
            db=db,
            event='payment_plan_created',
            application_id=UUID(application_id),
            user_id=application.user_id,
            extra_context={
                'totalAmount': f"{total_amount:,.2f}",
                'numberOfPayments': result['total_payments'],
                'paymentBreakdown': payment_breakdown_html
            }
        )
        print(f"[PaymentPlan] Email event fired successfully")
    except Exception as e:
        # Log but don't fail - payment plan was created successfully
        print(f"[PaymentPlan] Failed to fire email event: {e}")
        import traceback
        traceback.print_exc()

    return result


# =============================================================================
# Payment Summary Endpoint
# =============================================================================

@router.get("/admin/application/{application_id}/summary")
async def get_payment_summary(
    application_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """
    Get payment summary for an application including:
    - Total amount owed
    - Total paid
    - Outstanding balance
    - Invoice breakdown
    """
    application = db.query(Application).filter(
        Application.id == application_id
    ).first()

    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Application not found"
        )

    invoices = stripe_service.get_invoices_for_application(db, UUID(application_id))

    total_amount = sum(inv['amount'] for inv in invoices if inv['status'] != 'void')
    total_paid = sum(inv['amount'] for inv in invoices if inv['status'] == 'paid')
    total_discount = sum(inv.get('discount_amount', 0) for inv in invoices)
    outstanding = total_amount - total_paid

    open_invoices = [inv for inv in invoices if inv['status'] == 'open']
    paid_invoices = [inv for inv in invoices if inv['status'] == 'paid']
    voided_invoices = [inv for inv in invoices if inv['status'] == 'void']

    # Check if there's a payment plan
    has_payment_plan = any(inv['total_payments'] > 1 for inv in invoices)

    return {
        'application_id': application_id,
        'total_amount': total_amount,
        'total_paid': total_paid,
        'total_discount': total_discount,
        'outstanding_balance': outstanding,
        'all_paid': outstanding == 0 and len(open_invoices) == 0,
        'has_payment_plan': has_payment_plan,
        'invoice_counts': {
            'open': len(open_invoices),
            'paid': len(paid_invoices),
            'voided': len(voided_invoices),
            'total': len(invoices)
        },
        'invoices': invoices
    }
