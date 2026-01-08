-- Stripe Integration Migration
-- Adds fields for payment plans, invoice tracking, and Stripe customer management

-- Add stripe_customer_id to users table for Stripe Customer linkage
ALTER TABLE users
ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255) UNIQUE;

CREATE INDEX IF NOT EXISTS idx_users_stripe_customer ON users(stripe_customer_id);

-- Add payment plan and tracking fields to invoices table
ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS payment_number INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS total_payments INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS due_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS stripe_invoice_url TEXT,
ADD COLUMN IF NOT EXISTS stripe_hosted_url TEXT,
ADD COLUMN IF NOT EXISTS voided_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS voided_reason TEXT,
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id),
ADD COLUMN IF NOT EXISTS description TEXT;

-- Add comment for documentation
COMMENT ON COLUMN invoices.payment_number IS 'For payment plans: which payment this is (1, 2, 3...)';
COMMENT ON COLUMN invoices.total_payments IS 'For payment plans: total number of payments in the plan';
COMMENT ON COLUMN invoices.due_date IS 'When payment is due';
COMMENT ON COLUMN invoices.stripe_invoice_url IS 'Stripe hosted invoice page URL for payment';
COMMENT ON COLUMN invoices.stripe_hosted_url IS 'Stripe hosted invoice URL (alternative format)';
COMMENT ON COLUMN invoices.voided_at IS 'When the invoice was voided';
COMMENT ON COLUMN invoices.voided_reason IS 'Reason for voiding (e.g., scholarship adjustment, refund)';
COMMENT ON COLUMN invoices.created_by IS 'Admin who created/modified the invoice';
COMMENT ON COLUMN invoices.description IS 'Invoice description/line item text';

-- Add uncollectible status to the check constraint
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_status_check;
ALTER TABLE invoices ADD CONSTRAINT invoices_status_check
  CHECK (status IN ('draft', 'open', 'paid', 'void', 'uncollectible'));

-- Create index for payment plan queries
CREATE INDEX IF NOT EXISTS idx_invoices_payment_plan ON invoices(application_id, payment_number);

-- Create index for due date queries (for reminders)
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON invoices(due_date) WHERE status = 'open';

-- Add Stripe-related fields to applications table if not exists
-- (stripe_invoice_id and paid_invoice should already exist)
ALTER TABLE applications
ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255);

COMMENT ON COLUMN applications.stripe_customer_id IS 'Cached Stripe customer ID from the user';
