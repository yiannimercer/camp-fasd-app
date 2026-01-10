-- ============================================================================
-- Billing Email Templates
-- Adds email templates for payment confirmations, scholarships, and admin notifications
-- Note: Simple {{variable}} substitution only - no conditional logic supported
-- ============================================================================

-- 1. Payment Received - Sent to family when they pay an invoice via Stripe
INSERT INTO email_templates (key, name, subject, html_content, trigger_event, is_active, created_at, updated_at)
VALUES (
  'payment_received',
  'Payment Received Confirmation',
  'Payment Received - CAMP {{campYear}} Registration',
  '<h2>Thank You for Your Payment!</h2>
<p>Dear {{firstName}},</p>
<p>We have successfully received your payment for <strong>{{camperName}}</strong>''s CAMP {{campYear}} registration.</p>

<div style="background-color: #f0f9f0; border: 1px solid #316429; border-radius: 8px; padding: 16px; margin: 20px 0;">
  <h3 style="color: #316429; margin-top: 0;">Payment Details</h3>
  <p style="margin: 8px 0;"><strong>Amount Paid:</strong> ${{amountPaid}}</p>
  <p style="margin: 8px 0;"><strong>Remaining Balance:</strong> ${{remainingBalance}}</p>
</div>

<p>If you have any questions about your balance or payment, please don''t hesitate to contact us.</p>

<p>Thank you for being part of the CAMP FASD family!</p>

<p>Warm regards,<br>
The CAMP FASD Team</p>',
  'payment_received',
  true,
  NOW(),
  NOW()
)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  subject = EXCLUDED.subject,
  html_content = EXCLUDED.html_content,
  trigger_event = EXCLUDED.trigger_event,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();


-- 2. Scholarship Awarded - Sent to family when admin applies a scholarship
INSERT INTO email_templates (key, name, subject, html_content, trigger_event, is_active, created_at, updated_at)
VALUES (
  'scholarship_awarded',
  'Scholarship Awarded',
  'Great News! Scholarship Awarded for {{camperName}} - CAMP {{campYear}}',
  '<h2>Scholarship Awarded!</h2>
<p>Dear {{firstName}},</p>
<p>We are pleased to inform you that a scholarship has been applied to <strong>{{camperName}}</strong>''s CAMP {{campYear}} registration!</p>

<div style="background-color: #fff8e6; border: 1px solid #e26e15; border-radius: 8px; padding: 16px; margin: 20px 0;">
  <h3 style="color: #e26e15; margin-top: 0;">Scholarship Details</h3>
  <p style="margin: 8px 0;"><strong>Scholarship Amount:</strong> ${{scholarshipAmount}}</p>
  <p style="margin: 8px 0;"><strong>Original Tuition:</strong> ${{originalAmount}}</p>
  <p style="margin: 8px 0; font-size: 1.2em;"><strong>Your New Balance:</strong> <span style="color: #316429;">${{newAmount}}</span></p>
</div>

<p>Please complete your remaining payment at your earliest convenience. You can pay online through your application dashboard.</p>

<p>If you have any questions, please don''t hesitate to reach out.</p>

<p>Warm regards,<br>
The CAMP FASD Team</p>',
  'scholarship_awarded',
  true,
  NOW(),
  NOW()
)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  subject = EXCLUDED.subject,
  html_content = EXCLUDED.html_content,
  trigger_event = EXCLUDED.trigger_event,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();


-- 3. Admin Payment Received - Sent to admins when a camper pays
INSERT INTO email_templates (key, name, subject, html_content, trigger_event, is_active, created_at, updated_at)
VALUES (
  'admin_payment_received',
  'Admin: Payment Received Notification',
  'Payment Received: {{camperName}} paid ${{amountPaid}}',
  '<h2>Payment Received</h2>
<p>A payment has been received for a CAMP {{campYear}} registration.</p>

<div style="background-color: #f5f5f5; border: 1px solid #ddd; border-radius: 8px; padding: 16px; margin: 20px 0;">
  <h3 style="margin-top: 0;">Payment Details</h3>
  <p style="margin: 8px 0;"><strong>Camper:</strong> {{camperName}}</p>
  <p style="margin: 8px 0;"><strong>Amount Paid:</strong> ${{amountPaid}}</p>
  <p style="margin: 8px 0;"><strong>Remaining Balance:</strong> ${{remainingBalance}}</p>
</div>

<p style="text-align: center; margin: 24px 0;">
  <a href="{{appUrl}}{{applicationUrl}}" style="background-color: #316429; color: white; padding: 10px 24px; text-decoration: none; border-radius: 6px;">View Application</a>
</p>

<p style="color: #666; font-size: 0.9em;">This is an automated notification from the CAMP FASD application system.</p>',
  'admin_payment_received',
  true,
  NOW(),
  NOW()
)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  subject = EXCLUDED.subject,
  html_content = EXCLUDED.html_content,
  trigger_event = EXCLUDED.trigger_event,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();


-- 4. Create email automations for the new templates
-- Note: These automations use 'event' trigger_type (default) and link via template_key

-- Automation for payment_received - send to the applicant (empty audience = trigger context user)
INSERT INTO email_automations (template_key, name, trigger_event, trigger_type, audience_filter, is_active, created_at, updated_at)
VALUES (
  'payment_received',
  'Send payment confirmation to family',
  'payment_received',
  'event',
  '{}',
  true,
  NOW(),
  NOW()
)
ON CONFLICT DO NOTHING;

-- Automation for scholarship_awarded - send to the applicant (empty audience = trigger context user)
INSERT INTO email_automations (template_key, name, trigger_event, trigger_type, audience_filter, is_active, created_at, updated_at)
VALUES (
  'scholarship_awarded',
  'Send scholarship notification to family',
  'scholarship_awarded',
  'event',
  '{}',
  true,
  NOW(),
  NOW()
)
ON CONFLICT DO NOTHING;

-- Automation for admin_payment_received - send to admins
-- Note: audience_filter uses "role": "admin" which the code interprets as both admin and super_admin
INSERT INTO email_automations (template_key, name, trigger_event, trigger_type, audience_filter, is_active, created_at, updated_at)
VALUES (
  'admin_payment_received',
  'Notify admins of payment received',
  'admin_payment_received',
  'event',
  '{"role": "admin"}',
  true,
  NOW(),
  NOW()
)
ON CONFLICT DO NOTHING;


-- 5. Payment Plan Created - Sent to family when admin creates a payment plan
INSERT INTO email_templates (key, name, subject, html_content, trigger_event, is_active, created_at, updated_at)
VALUES (
  'payment_plan_created',
  'Payment Plan Created',
  'Payment Plan Created for {{camperName}} - CAMP {{campYear}}',
  '<h2>Your Payment Plan is Ready!</h2>
<p>Dear {{firstName}},</p>
<p>A payment plan has been created for <strong>{{camperName}}</strong>''s CAMP {{campYear}} registration to help make payments more manageable.</p>

<div style="background-color: #f3e8ff; border: 1px solid #9333ea; border-radius: 8px; padding: 16px; margin: 20px 0;">
  <h3 style="color: #9333ea; margin-top: 0;">Payment Plan Details</h3>
  <p style="margin: 8px 0;"><strong>Total Amount:</strong> ${{totalAmount}}</p>
  <p style="margin: 8px 0;"><strong>Number of Payments:</strong> {{numberOfPayments}}</p>
  <p style="margin: 8px 0;"><strong>Payment Breakdown:</strong></p>
  <div style="background-color: white; padding: 12px; border-radius: 4px; margin-top: 8px;">
    {{paymentBreakdown}}
  </div>
</div>

<p>You can view your payment schedule and make payments through your application dashboard.</p>

<p style="text-align: center; margin: 24px 0;">
  <a href="{{appUrl}}/dashboard" style="display: inline-block; background-color: #316429; color: white; padding: 12px 32px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">View Payment Plan</a>
</p>

<p>If you have any questions about your payment plan, please don''t hesitate to reach out.</p>

<p>Warm regards,<br>
The CAMP FASD Team</p>',
  'payment_plan_created',
  true,
  NOW(),
  NOW()
)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  subject = EXCLUDED.subject,
  html_content = EXCLUDED.html_content,
  trigger_event = EXCLUDED.trigger_event,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();


-- Automation for payment_plan_created - send to the applicant
INSERT INTO email_automations (template_key, name, trigger_event, trigger_type, audience_filter, is_active, created_at, updated_at)
VALUES (
  'payment_plan_created',
  'Send payment plan notification to family',
  'payment_plan_created',
  'event',
  '{}',
  true,
  NOW(),
  NOW()
)
ON CONFLICT DO NOTHING;
