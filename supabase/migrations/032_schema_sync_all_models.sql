-- Migration: Schema Sync - Ensure ALL SQLAlchemy model columns exist
-- Purpose: Prevent schema drift by ensuring all model columns exist in the database
-- This migration is IDEMPOTENT - safe to run multiple times
-- Date: 2026-01-10

-- ============================================================================
-- USERS TABLE
-- ============================================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS team VARCHAR(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS supabase_auth_id UUID UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active';
ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended_by UUID REFERENCES users(id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS suspension_reason TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS receive_emails BOOLEAN DEFAULT true NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_deliverability_confirmed BOOLEAN DEFAULT false NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_test_sent_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_deliverability_confirmed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255) UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS legacy_wp_user_id INTEGER;
ALTER TABLE users ADD COLUMN IF NOT EXISTS needs_password_setup BOOLEAN DEFAULT false;

-- Indexes for users
CREATE INDEX IF NOT EXISTS idx_users_supabase_auth_id ON users(supabase_auth_id);
CREATE INDEX IF NOT EXISTS idx_users_stripe_customer ON users(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_users_legacy_wp_id ON users(legacy_wp_user_id);

-- ============================================================================
-- APPLICATIONS TABLE
-- ============================================================================

ALTER TABLE applications ADD COLUMN IF NOT EXISTS sub_status VARCHAR(50) DEFAULT 'not_started';
ALTER TABLE applications ADD COLUMN IF NOT EXISTS paid_invoice BOOLEAN;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS stripe_invoice_id VARCHAR(255);
ALTER TABLE applications ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255);
ALTER TABLE applications ADD COLUMN IF NOT EXISTS camper_age INTEGER;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS camper_gender VARCHAR(50);
ALTER TABLE applications ADD COLUMN IF NOT EXISTS tuition_status VARCHAR(50);
ALTER TABLE applications ADD COLUMN IF NOT EXISTS fasd_best_score INTEGER;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS legacy_wp_camper_id INTEGER;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS under_review_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS promoted_to_camper_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS waitlisted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS deferred_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS withdrawn_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS reactivated_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP WITH TIME ZONE;

-- Indexes for applications
CREATE INDEX IF NOT EXISTS idx_applications_sub_status ON applications(sub_status);
CREATE INDEX IF NOT EXISTS idx_applications_paid_invoice ON applications(paid_invoice);
CREATE INDEX IF NOT EXISTS idx_applications_camper_age ON applications(camper_age);
CREATE INDEX IF NOT EXISTS idx_applications_camper_gender ON applications(camper_gender);
CREATE INDEX IF NOT EXISTS idx_applications_tuition_status ON applications(tuition_status);
CREATE INDEX IF NOT EXISTS idx_applications_fasd_best_score ON applications(fasd_best_score);
CREATE INDEX IF NOT EXISTS idx_applications_legacy_wp_id ON applications(legacy_wp_camper_id);

-- ============================================================================
-- APPLICATION_SECTIONS TABLE
-- ============================================================================

ALTER TABLE application_sections ADD COLUMN IF NOT EXISTS required_status VARCHAR(50);
ALTER TABLE application_sections ADD COLUMN IF NOT EXISTS score_calculation_type VARCHAR(50);

-- Indexes for sections
CREATE INDEX IF NOT EXISTS idx_sections_required_status ON application_sections(required_status);

-- ============================================================================
-- APPLICATION_QUESTIONS TABLE
-- ============================================================================

ALTER TABLE application_questions ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE application_questions ADD COLUMN IF NOT EXISTS persist_annually BOOLEAN DEFAULT false;
ALTER TABLE application_questions ADD COLUMN IF NOT EXISTS template_file_id UUID REFERENCES files(id) ON DELETE SET NULL;
ALTER TABLE application_questions ADD COLUMN IF NOT EXISTS show_if_question_id UUID REFERENCES application_questions(id) ON DELETE CASCADE;
ALTER TABLE application_questions ADD COLUMN IF NOT EXISTS show_if_answer TEXT;
ALTER TABLE application_questions ADD COLUMN IF NOT EXISTS detail_prompt_trigger JSONB;
ALTER TABLE application_questions ADD COLUMN IF NOT EXISTS detail_prompt_text TEXT;

-- Indexes for questions
CREATE INDEX IF NOT EXISTS idx_questions_persist_annually ON application_questions(persist_annually);
CREATE INDEX IF NOT EXISTS idx_questions_template_file ON application_questions(template_file_id);
CREATE INDEX IF NOT EXISTS idx_questions_show_if ON application_questions(show_if_question_id);

-- ============================================================================
-- APPLICATION_HEADERS TABLE (create if not exists)
-- ============================================================================

CREATE TABLE IF NOT EXISTS application_headers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    section_id UUID NOT NULL REFERENCES application_sections(id) ON DELETE CASCADE,
    header_text VARCHAR(255) NOT NULL,
    order_index INTEGER NOT NULL,
    is_active BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_application_headers_section_id ON application_headers(section_id);
CREATE INDEX IF NOT EXISTS idx_application_headers_order ON application_headers(section_id, order_index);

-- ============================================================================
-- INVOICES TABLE
-- ============================================================================

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_number INTEGER DEFAULT 1;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS total_payments INTEGER DEFAULT 1;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS due_date TIMESTAMP WITH TIME ZONE;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS stripe_invoice_url TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS stripe_hosted_url TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS voided_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS voided_reason TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS description TEXT;

-- Indexes for invoices
CREATE INDEX IF NOT EXISTS idx_invoices_payment_plan ON invoices(application_id, payment_number);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON invoices(due_date);

-- ============================================================================
-- APPLICATION_APPROVALS TABLE (create if not exists)
-- ============================================================================

CREATE TABLE IF NOT EXISTS application_approvals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    admin_id UUID NOT NULL REFERENCES users(id),
    approved BOOLEAN NOT NULL,
    note TEXT,
    admin_name VARCHAR(255),
    admin_team VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_application_approvals_app ON application_approvals(application_id);
CREATE INDEX IF NOT EXISTS idx_application_approvals_admin ON application_approvals(admin_id);

-- Add columns if table already existed without them
ALTER TABLE application_approvals ADD COLUMN IF NOT EXISTS admin_name VARCHAR(255);
ALTER TABLE application_approvals ADD COLUMN IF NOT EXISTS admin_team VARCHAR(50);

-- ============================================================================
-- MEDICATIONS TABLE (create if not exists)
-- ============================================================================

CREATE TABLE IF NOT EXISTS medications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES application_questions(id) ON DELETE CASCADE,
    medication_name TEXT NOT NULL,
    strength TEXT,
    dose_amount TEXT,
    dose_form TEXT,
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_medications_application ON medications(application_id);
CREATE INDEX IF NOT EXISTS idx_medications_question ON medications(question_id);

-- ============================================================================
-- MEDICATION_DOSES TABLE (create if not exists)
-- ============================================================================

CREATE TABLE IF NOT EXISTS medication_doses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    medication_id UUID NOT NULL REFERENCES medications(id) ON DELETE CASCADE,
    given_type TEXT NOT NULL,
    time TEXT,
    notes TEXT,
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_medication_doses_medication ON medication_doses(medication_id);

-- ============================================================================
-- ALLERGIES TABLE (create if not exists)
-- ============================================================================

CREATE TABLE IF NOT EXISTS allergies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES application_questions(id) ON DELETE CASCADE,
    allergen TEXT NOT NULL,
    reaction TEXT,
    severity TEXT,
    notes TEXT,
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_allergies_application ON allergies(application_id);
CREATE INDEX IF NOT EXISTS idx_allergies_question ON allergies(question_id);

-- ============================================================================
-- SUPER ADMIN TABLES (create if not exists)
-- ============================================================================

-- System Configuration
CREATE TABLE IF NOT EXISTS system_configuration (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key VARCHAR(100) UNIQUE NOT NULL,
    value JSONB NOT NULL,
    description TEXT,
    data_type VARCHAR(20) NOT NULL,
    category VARCHAR(50) DEFAULT 'general',
    is_public BOOLEAN DEFAULT false,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_by UUID REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_system_config_key ON system_configuration(key);

-- Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID,
    action VARCHAR(50) NOT NULL,
    actor_id UUID REFERENCES users(id),
    details JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);

-- Teams
CREATE TABLE IF NOT EXISTS teams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    color VARCHAR(7) DEFAULT '#3B82F6',
    is_active BOOLEAN DEFAULT true,
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_teams_key ON teams(key);
CREATE INDEX IF NOT EXISTS idx_teams_active ON teams(is_active);

-- Email Documents
CREATE TABLE IF NOT EXISTS email_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    file_name VARCHAR(255) NOT NULL,
    storage_path VARCHAR(500) NOT NULL,
    file_size INTEGER NOT NULL,
    file_type VARCHAR(100) NOT NULL,
    uploaded_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- EMAIL TABLES (ensure columns exist)
-- ============================================================================

-- Ensure email_templates has markdown columns
ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS key VARCHAR(100) UNIQUE;
ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS name VARCHAR(255);
ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS html_content TEXT;
ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS text_content TEXT;
ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS markdown_content TEXT;
ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS use_markdown BOOLEAN DEFAULT false;
ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES users(id);

-- Email Automations
CREATE TABLE IF NOT EXISTS email_automations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    template_key VARCHAR(100) REFERENCES email_templates(key) ON DELETE CASCADE,
    trigger_type VARCHAR(50) NOT NULL,
    trigger_event VARCHAR(100),
    schedule_day INTEGER,
    schedule_hour INTEGER,
    audience_filter JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_email_automations_template ON email_automations(template_key);
CREATE INDEX IF NOT EXISTS idx_email_automations_trigger ON email_automations(trigger_event);
CREATE INDEX IF NOT EXISTS idx_email_automations_active ON email_automations(is_active);

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- After running, verify key columns exist:
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'team';
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'applications' AND column_name = 'sub_status';
-- SELECT table_name FROM information_schema.tables WHERE table_name = 'application_headers';
