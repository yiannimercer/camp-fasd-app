-- Migration: Add Super Admin Features
-- Description: System configuration, audit logs, email templates, and teams management
-- Date: 2025-10-20

-- ============================================================================
-- 1. SYSTEM CONFIGURATION TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS system_configuration (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key VARCHAR(100) UNIQUE NOT NULL,
    value JSONB NOT NULL,
    description TEXT,
    data_type VARCHAR(20) NOT NULL, -- 'string', 'number', 'boolean', 'date', 'json'
    category VARCHAR(50) DEFAULT 'general', -- 'camp', 'workflow', 'files', 'email', 'contact'
    is_public BOOLEAN DEFAULT false, -- Can non-admins see this setting?
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID REFERENCES users(id)
);

-- Index for fast lookups by key
CREATE INDEX idx_system_config_key ON system_configuration(key);
CREATE INDEX idx_system_config_category ON system_configuration(category);

-- Seed initial configuration values
INSERT INTO system_configuration (key, value, description, data_type, category) VALUES
-- Camp Settings
('camp_fee', '500.00', 'Application fee charged upon acceptance (USD)', 'number', 'camp'),
('camp_year', '2025', 'Current camp season year', 'number', 'camp'),
('application_season_start', '"2025-01-01"', 'Date when applications open', 'date', 'camp'),
('application_season_end', '"2025-06-30"', 'Date when applications close', 'date', 'camp'),
('camp_start_date', '"2025-07-15"', 'Camp start date', 'date', 'camp'),
('camp_end_date', '"2025-07-22"', 'Camp end date', 'date', 'camp'),
('max_campers', '50', 'Maximum number of campers accepted per season', 'number', 'camp'),

-- Workflow Settings
('auto_submit_enabled', 'true', 'Automatically submit applications when 100% complete', 'boolean', 'workflow'),
('approval_required_count', '3', 'Number of approvals needed to enable Accept button', 'number', 'workflow'),
('allow_family_edits_under_review', 'true', 'Allow families to edit applications in under_review status', 'boolean', 'workflow'),

-- File Upload Settings
('max_file_size_mb', '10', 'Maximum file size in megabytes', 'number', 'files'),
('allowed_file_types', '[".pdf", ".docx", ".doc", ".jpg", ".jpeg", ".png"]', 'Allowed file extensions', 'json', 'files'),

-- Email Settings
('email_enabled', 'true', 'Enable email notifications', 'boolean', 'email'),
('email_from_name', '"CAMP FASD"', 'Email sender name', 'string', 'email'),
('email_from_address', '"noreply@fasdcamp.org"', 'Email sender address', 'string', 'email'),

-- Contact Information
('contact_email', '"info@fasdcamp.org"', 'Public contact email', 'string', 'contact'),
('contact_phone', '"(555) 123-4567"', 'Public contact phone', 'string', 'contact'),
('contact_address_street', '"123 Camp Road"', 'Contact address street', 'string', 'contact'),
('contact_address_city', '"Portland"', 'Contact address city', 'string', 'contact'),
('contact_address_state', '"OR"', 'Contact address state', 'string', 'contact'),
('contact_address_zip', '"97201"', 'Contact address zip', 'string', 'contact')

ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- 2. AUDIT LOGS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_type VARCHAR(50) NOT NULL, -- 'application', 'user', 'section', 'question', 'configuration', etc.
    entity_id UUID, -- Can be null for system-wide events
    action VARCHAR(50) NOT NULL, -- 'created', 'updated', 'deleted', 'status_changed', 'login', 'logout', etc.
    actor_id UUID REFERENCES users(id), -- Who performed the action
    details JSONB, -- Old values, new values, reason, etc.
    ip_address VARCHAR(45), -- IPv4 or IPv6
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for filtering and searching
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_actor ON audit_logs(actor_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- ============================================================================
-- 3. EMAIL TEMPLATES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS email_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key VARCHAR(100) UNIQUE NOT NULL, -- 'application_submitted', 'application_accepted', etc.
    name VARCHAR(255) NOT NULL, -- Human-readable name
    subject VARCHAR(255) NOT NULL, -- Email subject with variable support: "Welcome, {user_name}!"
    html_content TEXT NOT NULL, -- HTML email body
    text_content TEXT, -- Plain text fallback
    variables JSONB, -- Array of available variables: ["user_name", "camp_year", etc.]
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID REFERENCES users(id)
);

-- Index for fast lookups by key
CREATE INDEX idx_email_templates_key ON email_templates(key);
CREATE INDEX idx_email_templates_active ON email_templates(is_active);

-- Seed default email templates
INSERT INTO email_templates (key, name, subject, html_content, text_content, variables) VALUES
(
    'welcome_new_user',
    'Welcome New User',
    'Welcome to CAMP FASD, {user_name}!',
    '<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #316429; color: white; padding: 30px 20px; text-align: center; }
        .content { padding: 30px 20px; background: #f9f9f9; }
        .button { display: inline-block; padding: 12px 24px; background: #e26e15; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Welcome to CAMP FASD!</h1>
        </div>
        <div class="content">
            <p>Dear {user_name},</p>
            <p>Thank you for creating an account with CAMP FASD! We''re excited to help you through the application process.</p>

            <h3>What to Expect:</h3>
            <ul>
                <li><strong>17 Application Sections</strong> - Complete information about your camper</li>
                <li><strong>Document Uploads</strong> - Medical forms, IEP/504 plans, and authorizations</li>
                <li><strong>Auto-Save</strong> - Your progress is saved automatically</li>
                <li><strong>Review Process</strong> - Our team reviews applications within 2-3 weeks</li>
            </ul>

            <p style="text-align: center;">
                <a href="{dashboard_url}" class="button">Start Your Application</a>
            </p>

            <h3>Need Help?</h3>
            <p>If you have any questions, please contact us:</p>
            <ul>
                <li>Email: info@fasdcamp.org</li>
                <li>Phone: (555) 123-4567</li>
            </ul>

            <p>We look forward to welcoming your camper to CAMP FASD {camp_year}!</p>
            <p><strong>The CAMP FASD Team</strong></p>
        </div>
        <div class="footer">
            <p>This email was sent from CAMP FASD Application Portal</p>
        </div>
    </div>
</body>
</html>',
    'Dear {user_name},

Thank you for creating an account with CAMP FASD! We''re excited to help you through the application process.

What to Expect:
- 17 Application Sections - Complete information about your camper
- Document Uploads - Medical forms, IEP/504 plans, and authorizations
- Auto-Save - Your progress is saved automatically
- Review Process - Our team reviews applications within 2-3 weeks

Get started: {dashboard_url}

Need Help?
Email: info@fasdcamp.org
Phone: (555) 123-4567

We look forward to welcoming your camper to CAMP FASD {camp_year}!

The CAMP FASD Team',
    '["user_name", "dashboard_url", "camp_year"]'::jsonb
),
(
    'application_submitted',
    'Application Submitted',
    'Your CAMP FASD Application Has Been Submitted',
    '<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #316429; color: white; padding: 30px 20px; text-align: center; }
        .content { padding: 30px 20px; background: #f9f9f9; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Application Submitted!</h1>
        </div>
        <div class="content">
            <p>Dear {family_name},</p>
            <p>Thank you for completing the application for <strong>{camper_name}</strong>.</p>
            <p>Our team will review your application and you can expect to hear from us within 2-3 weeks.</p>
            <p>Application ID: {application_id}<br>Submitted: {submission_date}</p>
            <p><strong>The CAMP FASD Team</strong></p>
        </div>
    </div>
</body>
</html>',
    'Dear {family_name},

Thank you for completing the application for {camper_name}.

Our team will review your application and you can expect to hear from us within 2-3 weeks.

Application ID: {application_id}
Submitted: {submission_date}

The CAMP FASD Team',
    '["family_name", "camper_name", "application_id", "submission_date"]'::jsonb
),
(
    'application_accepted',
    'Application Accepted',
    '🎉 Congratulations! You''ve Been Accepted to CAMP FASD',
    '<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #316429; color: white; padding: 30px 20px; text-align: center; }
        .content { padding: 30px 20px; background: #f9f9f9; }
        .button { display: inline-block; padding: 12px 24px; background: #e26e15; color: white; text-decoration: none; border-radius: 5px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎉 Congratulations!</h1>
        </div>
        <div class="content">
            <h2>Your application has been accepted!</h2>
            <p>Dear {family_name},</p>
            <p>We''re excited to welcome <strong>{camper_name}</strong> to CAMP FASD {camp_year}!</p>
            <p>We need a few more details to complete your registration. Please log in to complete:</p>
            <ul>
                <li>Travel arrangements</li>
                <li>T-shirt size and dietary information</li>
                <li>Emergency contact details</li>
            </ul>
            <p style="text-align: center; margin: 30px 0;">
                <a href="{dashboard_url}" class="button">Complete Registration</a>
            </p>
            <p>Payment of ${payment_amount} will be required to reserve your spot.</p>
            <p><strong>The CAMP FASD Team</strong></p>
        </div>
    </div>
</body>
</html>',
    'Congratulations!

Dear {family_name},

We''re excited to welcome {camper_name} to CAMP FASD {camp_year}!

Complete your registration: {dashboard_url}

Payment of ${payment_amount} will be required to reserve your spot.

The CAMP FASD Team',
    '["family_name", "camper_name", "camp_year", "dashboard_url", "payment_amount"]'::jsonb
)

ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- 4. TEAMS TABLE (Make teams configurable instead of hardcoded)
-- ============================================================================
CREATE TABLE IF NOT EXISTS teams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key VARCHAR(50) UNIQUE NOT NULL, -- 'ops', 'med', 'behavioral', 'lit'
    name VARCHAR(100) NOT NULL, -- 'Operations', 'Medical', etc.
    description TEXT,
    color VARCHAR(7) DEFAULT '#3B82F6', -- Hex color for badges
    is_active BOOLEAN DEFAULT true,
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for ordering
CREATE INDEX idx_teams_order ON teams(order_index);
CREATE INDEX idx_teams_active ON teams(is_active);

-- Seed default teams
INSERT INTO teams (key, name, description, color, order_index) VALUES
('ops', 'Operations', 'Operational review and logistics', '#3B82F6', 1),
('med', 'Medical', 'Medical review and health assessment', '#10B981', 2),
('behavioral', 'Behavioral', 'Behavioral and psychological review', '#8B5CF6', 3),
('lit', 'Literacy', 'Educational and literacy assessment', '#F59E0B', 4)

ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- 5. ADD STATUS FIELD TO USERS TABLE (for suspend/activate)
-- ============================================================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active';
ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended_by UUID REFERENCES users(id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS suspension_reason TEXT;

-- Add check constraint for valid statuses
ALTER TABLE users ADD CONSTRAINT check_user_status
    CHECK (status IN ('active', 'inactive', 'suspended'));

-- Index for filtering by status
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

-- ============================================================================
-- 6. UPDATE TIMESTAMP TRIGGERS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_system_configuration_updated_at ON system_configuration;
CREATE TRIGGER update_system_configuration_updated_at
    BEFORE UPDATE ON system_configuration
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_email_templates_updated_at ON email_templates;
CREATE TRIGGER update_email_templates_updated_at
    BEFORE UPDATE ON email_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_teams_updated_at ON teams;
CREATE TRIGGER update_teams_updated_at
    BEFORE UPDATE ON teams
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE system_configuration IS 'System-wide configuration settings manageable by super admin';
COMMENT ON TABLE audit_logs IS 'Complete audit trail of all system actions';
COMMENT ON TABLE email_templates IS 'Email templates with variable substitution support';
COMMENT ON TABLE teams IS 'Admin teams for approval workflow';
COMMENT ON COLUMN users.status IS 'User account status: active, inactive, or suspended';
