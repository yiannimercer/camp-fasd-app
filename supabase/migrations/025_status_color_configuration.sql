-- Migration: Add Status Color Configuration
-- Purpose: Allow super admins to customize status/stage colors across the application
-- Date: 2026-01-05

-- Insert default status color configuration into system_configuration table
-- This follows the existing pattern for system settings (JSONB storage)
INSERT INTO system_configuration (key, value, description, data_type, category, is_public)
VALUES (
    'status_colors',
    '{
        "applicant_not_started": {"bg": "#F3F4F6", "text": "#1F2937", "label": "Not Started"},
        "applicant_incomplete": {"bg": "#DBEAFE", "text": "#1E40AF", "label": "Incomplete"},
        "applicant_complete": {"bg": "#E0E7FF", "text": "#3730A3", "label": "Complete"},
        "applicant_under_review": {"bg": "#FEF3C7", "text": "#92400E", "label": "Under Review"},
        "applicant_waitlist": {"bg": "#FFEDD5", "text": "#9A3412", "label": "Waitlist"},
        "camper_incomplete": {"bg": "#CFFAFE", "text": "#0E7490", "label": "Incomplete"},
        "camper_complete": {"bg": "#D1FAE5", "text": "#065F46", "label": "Complete"},
        "inactive_withdrawn": {"bg": "#FFEDD5", "text": "#C2410C", "label": "Withdrawn"},
        "inactive_deferred": {"bg": "#FEF3C7", "text": "#B45309", "label": "Deferred"},
        "inactive_inactive": {"bg": "#F3F4F6", "text": "#4B5563", "label": "Deactivated"},
        "category_applicant": {"bg": "#EFF6FF", "text": "#1D4ED8", "label": "Applicant"},
        "category_camper": {"bg": "#F3E8FF", "text": "#7C3AED", "label": "Camper"},
        "category_inactive": {"bg": "#F3F4F6", "text": "#4B5563", "label": "Inactive"}
    }'::jsonb,
    'Customizable colors for application statuses and stages. Keys follow pattern: {status}_{sub_status} or category_{status}. Each value contains bg (background hex), text (text hex), and label (display name).',
    'json',
    'appearance',
    true  -- Public so frontend can fetch without authentication for initial render
)
ON CONFLICT (key) DO UPDATE SET
    value = EXCLUDED.value,
    description = EXCLUDED.description,
    is_public = EXCLUDED.is_public,
    updated_at = NOW()
WHERE system_configuration.key = 'status_colors';

-- Verify the insertion
SELECT key, category, is_public, jsonb_pretty(value) as colors
FROM system_configuration
WHERE key = 'status_colors';
