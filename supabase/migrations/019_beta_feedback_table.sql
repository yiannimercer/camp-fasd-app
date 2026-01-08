-- Create beta_feedback table for storing beta tester feedback
-- Captured via React Roast widget with enhanced metadata

CREATE TABLE IF NOT EXISTS beta_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- User Information
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    user_email TEXT,

    -- Feedback Content
    message TEXT NOT NULL,
    page_url TEXT NOT NULL,
    page_pathname TEXT,

    -- Screenshots (stored in Supabase Storage)
    full_screenshot_url TEXT,
    element_screenshot_url TEXT,

    -- Browser & Device Metadata
    browser_info JSONB DEFAULT '{}'::jsonb,
    -- Example: {"userAgent": "...", "language": "en-US", "platform": "MacIntel"}

    viewport_size JSONB DEFAULT '{}'::jsonb,
    -- Example: {"width": 1920, "height": 1080, "screenWidth": 1920, "screenHeight": 1080}

    device_info JSONB DEFAULT '{}'::jsonb,
    -- Example: {"isMobile": false, "isDesktop": true, "osName": "Mac OS", "browserName": "Chrome"}

    -- Console Logs (last 50 logs before feedback submission)
    console_logs JSONB DEFAULT '[]'::jsonb,
    -- Example: [{"type": "error", "message": "...", "timestamp": "..."}]

    -- Selected Element Information
    selected_element JSONB DEFAULT '{}'::jsonb,
    -- Example: {"tagName": "button", "className": "...", "id": "...", "innerText": "..."}

    -- Performance Metrics
    performance_metrics JSONB DEFAULT '{}'::jsonb,
    -- Example: {"loadTime": 1234, "domReady": 567}

    -- Status & Admin Notes
    status TEXT DEFAULT 'new' CHECK (status IN ('new', 'reviewing', 'resolved', 'closed')),
    admin_notes TEXT,
    resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    resolved_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_beta_feedback_user_id ON beta_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_beta_feedback_status ON beta_feedback(status);
CREATE INDEX IF NOT EXISTS idx_beta_feedback_created_at ON beta_feedback(created_at DESC);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_beta_feedback_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER beta_feedback_updated_at
    BEFORE UPDATE ON beta_feedback
    FOR EACH ROW
    EXECUTE FUNCTION update_beta_feedback_updated_at();

-- Add RLS policies
ALTER TABLE beta_feedback ENABLE ROW LEVEL SECURITY;

-- Users can insert their own feedback
CREATE POLICY "Users can insert their own feedback"
    ON beta_feedback
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- Users can view their own feedback
CREATE POLICY "Users can view their own feedback"
    ON beta_feedback
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- Admins can view all feedback
CREATE POLICY "Admins can view all feedback"
    ON beta_feedback
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role IN ('admin', 'super_admin')
        )
    );

-- Admins can update feedback (status, notes, etc.)
CREATE POLICY "Admins can update feedback"
    ON beta_feedback
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role IN ('admin', 'super_admin')
        )
    );

-- Create storage bucket for feedback screenshots (if not exists)
-- Note: This needs to be run via Supabase Dashboard or supabase CLI
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('beta-feedback-screenshots', 'beta-feedback-screenshots', false)
-- ON CONFLICT (id) DO NOTHING;

COMMENT ON TABLE beta_feedback IS 'Stores beta tester feedback with screenshots, console logs, and browser metadata';
COMMENT ON COLUMN beta_feedback.console_logs IS 'Array of last 50 console logs before feedback submission';
COMMENT ON COLUMN beta_feedback.browser_info IS 'User agent, language, platform information';
COMMENT ON COLUMN beta_feedback.viewport_size IS 'Browser window and screen dimensions';
COMMENT ON COLUMN beta_feedback.device_info IS 'Device type, OS, and browser detection';
