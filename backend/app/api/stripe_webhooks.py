"""
Stripe Webhook Handler
Processes webhook events from Stripe for payment status updates

Webhook Events Handled:
- invoice.paid: When a customer pays an invoice
- invoice.payment_failed: When a payment attempt fails
- invoice.voided: When an invoice is voided in Stripe
- customer.created: When a new customer is created (logging only)
"""

from fastapi import APIRouter, Depends, HTTPException, status, Request, Header
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.services import stripe_service
from app.services.email_events import fire_email_event

router = APIRouter(prefix="/webhooks/stripe", tags=["webhooks"])


@router.post("")
async def stripe_webhook(
    request: Request,
    stripe_signature: str = Header(None, alias="Stripe-Signature"),
    db: Session = Depends(get_db)
):
    """
    Handle incoming Stripe webhook events.

    Stripe sends webhooks for various payment events. We process them
    to keep our database in sync and trigger appropriate actions.

    IMPORTANT: This endpoint must be publicly accessible (no auth).
    Security is verified via Stripe's webhook signature.
    """
    if not stripe_signature:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing Stripe-Signature header"
        )

    # Get raw body for signature verification
    payload = await request.body()

    # Parse and verify the webhook event
    event = stripe_service.parse_webhook_event(payload, stripe_signature)

    if not event:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid webhook signature"
        )

    event_type = event.type
    event_data = event.data.object

    print(f"[Stripe Webhook] ====== WEBHOOK RECEIVED ======")
    print(f"[Stripe Webhook] Event Type: {event_type}")
    print(f"[Stripe Webhook] Event ID: {event.id}")
    if hasattr(event_data, 'id'):
        print(f"[Stripe Webhook] Object ID: {event_data.id}")

    try:
        if event_type == "invoice.paid":
            # Invoice has been paid
            stripe_invoice_id = event_data.id
            print(f"[Stripe Webhook] Processing invoice.paid for: {stripe_invoice_id}")

            result = stripe_service.handle_invoice_paid(stripe_invoice_id, db)
            print(f"[Stripe Webhook] handle_invoice_paid result: {result}")

            if result['success']:
                # Fire email events for payment confirmation
                try:
                    # Get application ID and invoice details from our invoice record
                    from sqlalchemy import text
                    inv_result = db.execute(
                        text("""
                            SELECT i.application_id, i.amount, a.user_id,
                                   a.camper_first_name, a.camper_last_name
                            FROM invoices i
                            JOIN applications a ON i.application_id = a.id
                            WHERE i.stripe_invoice_id = :sid
                        """),
                        {'sid': stripe_invoice_id}
                    )
                    row = inv_result.fetchone()
                    if row:
                        application_id, amount_paid, user_id, camper_first, camper_last = row
                        camper_name = f"{camper_first or ''} {camper_last or ''}".strip() or "Camper"
                        all_paid = result.get('all_invoices_paid', False)

                        # Calculate remaining balance
                        balance_result = db.execute(
                            text("""
                                SELECT COALESCE(SUM(amount), 0)
                                FROM invoices
                                WHERE application_id = :aid AND status = 'open'
                            """),
                            {'aid': str(application_id)}
                        )
                        remaining_balance = float(balance_result.fetchone()[0] or 0)

                        # 1. Fire payment_received event to the family
                        await fire_email_event(
                            db=db,
                            event='payment_received',
                            application_id=application_id,
                            user_id=user_id,
                            extra_context={
                                'amountPaid': float(amount_paid),
                                'remainingBalance': remaining_balance,
                                'allPaid': all_paid
                            }
                        )

                        # 2. Fire admin_payment_received event to notify admins
                        # Note: admin audience is set in the automation's audience_filter
                        await fire_email_event(
                            db=db,
                            event='admin_payment_received',
                            application_id=application_id,
                            user_id=user_id,
                            extra_context={
                                'camperName': camper_name,
                                'amountPaid': float(amount_paid),
                                'remainingBalance': remaining_balance,
                                'allPaid': all_paid,
                                'applicationUrl': f"/admin/applications/{application_id}"
                            }
                        )
                except Exception as e:
                    print(f"[Stripe Webhook] Failed to fire email event: {e}")

            return {"status": "processed", "event": event_type, **result}

        elif event_type == "invoice.payment_failed":
            # Payment failed
            stripe_invoice_id = event_data.id
            result = stripe_service.handle_invoice_payment_failed(stripe_invoice_id, db)

            # Could trigger reminder/notification email here

            return {"status": "processed", "event": event_type, **result}

        elif event_type == "invoice.voided":
            # Invoice was voided in Stripe dashboard
            stripe_invoice_id = event_data.id

            # Update our database if not already voided
            from sqlalchemy import text
            db.execute(
                text("""
                    UPDATE invoices
                    SET status = 'void', voided_at = NOW(), voided_reason = 'Voided via Stripe'
                    WHERE stripe_invoice_id = :sid AND status != 'void'
                """),
                {'sid': stripe_invoice_id}
            )
            db.commit()

            return {"status": "processed", "event": event_type}

        elif event_type == "invoice.finalized":
            # Invoice was finalized (opened)
            stripe_invoice_id = event_data.id
            hosted_url = event_data.hosted_invoice_url

            # Update our database with the hosted URL
            from sqlalchemy import text
            db.execute(
                text("""
                    UPDATE invoices
                    SET status = 'open',
                        stripe_invoice_url = :url,
                        stripe_hosted_url = :url
                    WHERE stripe_invoice_id = :sid
                """),
                {'sid': stripe_invoice_id, 'url': hosted_url}
            )
            db.commit()

            return {"status": "processed", "event": event_type}

        elif event_type == "invoice.marked_uncollectible":
            # Invoice was marked as uncollectible
            stripe_invoice_id = event_data.id

            from sqlalchemy import text
            db.execute(
                text("""
                    UPDATE invoices
                    SET status = 'uncollectible'
                    WHERE stripe_invoice_id = :sid
                """),
                {'sid': stripe_invoice_id}
            )
            db.commit()

            return {"status": "processed", "event": event_type}

        elif event_type == "customer.created":
            # Just log - customer creation is handled in our code
            print(f"[Stripe Webhook] Customer created: {event_data.id}")
            return {"status": "acknowledged", "event": event_type}

        else:
            # Unhandled event type - acknowledge but don't process
            print(f"[Stripe Webhook] Unhandled event type: {event_type}")
            return {"status": "acknowledged", "event": event_type}

    except Exception as e:
        # Rollback any partial database changes to maintain consistency
        db.rollback()

        print(f"[Stripe Webhook] Error processing {event_type}: {e}")
        import traceback
        traceback.print_exc()

        # Return 200 to prevent Stripe from retrying
        # Log the error for investigation
        return {
            "status": "error",
            "event": event_type,
            "error": str(e)
        }


@router.get("/health")
async def webhook_health():
    """Health check endpoint for webhook route"""
    return {"status": "ok", "webhook_path": "/api/webhooks/stripe"}
