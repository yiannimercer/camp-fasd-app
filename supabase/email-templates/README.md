# CAMP FASD Email Templates

This directory contains all email templates used by the CAMP FASD application.

## App Email Templates (Markdown)

Each `.md` file represents an email template with metadata and markdown content that gets converted to styled HTML.

### Family-Facing Emails

| Template | Key | Trigger | Description |
|----------|-----|---------|-------------|
| [Application Started](application_started.md) | `application_started` | `application_created` | Welcome email when a new application begins |
| [Application Complete](application_submitted.md) | `application_submitted` | `applicant_complete` | Confirmation when application is 100% complete |
| [Application Accepted](application_accepted.md) | `application_accepted` | `promoted_to_camper` | Acceptance notification with next steps |
| [Waitlisted](applicant_waitlisted.md) | `applicant_waitlisted` | `applicant_waitlisted` | Waitlist notification with expectations |
| [Incomplete Reminder](incomplete_reminder.md) | `incomplete_reminder` | `incomplete_reminder` | Reminder to complete partial applications |
| [Payment Reminder](payment_reminder.md) | `payment_reminder` | `payment_reminder` | Reminder to submit payment |
| [Payment Received](payment_received.md) | `payment_received` | `payment_received` | Payment confirmation |
| [Payment Plan Created](payment_plan_created.md) | `payment_plan_created` | `payment_plan_created` | Payment plan setup confirmation |
| [Scholarship Awarded](scholarship_awarded.md) | `scholarship_awarded` | `scholarship_awarded` | Scholarship notification |

### Admin Emails

| Template | Key | Trigger | Description |
|----------|-----|---------|-------------|
| [Admin: Payment Received](admin_payment_received.md) | `admin_payment_received` | `payment_received` | Notifies admins of incoming payments |
| [Weekly Digest](admin_digest.md) | `admin_digest` | `admin_digest` | Weekly summary of application stats |

---

## Supabase Auth Templates (HTML)

These are handled by Supabase directly and use HTML format. Apply to **both DEV and PROD** Supabase projects.

**Location:** Supabase Dashboard → Authentication → Email Templates → [Template Name]

| File | Supabase Template | Subject Line |
|------|-------------------|--------------|
| `confirm-signup.html` | Confirm sign up | `Confirm your CAMP FASD account` |
| `invite-user.html` | Invite user | `You've been invited to CAMP FASD` |
| `change-email.html` | Change email address | `Confirm your new email address` |
| `reset-password.html` | Reset password | `Reset your CAMP FASD password` |

### Supabase Template Variables

These are Supabase's Go template variables:

- `{{ .ConfirmationURL }}` - The verification/action link
- `{{ .Token }}` - OTP token (if using OTP instead of magic link)
- `{{ .SiteURL }}` - Your app's base URL
- `{{ .Email }}` - The user's email address

---

## App Template Variables

Templates use `{{variableName}}` syntax for dynamic content:

### Common Variables
- `{{firstName}}` - Recipient's first name
- `{{lastName}}` - Recipient's last name
- `{{camperName}}` - Full camper name
- `{{camperFirstName}}` - Camper's first name
- `{{campYear}}` - Current camp year (e.g., 2025)
- `{{appUrl}}` - Application base URL
- `{{organizationName}}` - Organization name

### Payment Variables
- `{{amountPaid}}` - Amount of payment
- `{{remainingBalance}}` - Outstanding balance
- `{{paymentUrl}}` - Direct link to payment page
- `{{totalAmount}}` - Total registration cost
- `{{scholarshipAmount}}` - Scholarship value

### Application Variables
- `{{completionPercentage}}` - Application progress (0-100)
- `{{status}}` - Application status
- `{{subStatus}}` - Detailed status

---

## Markdown Features

The markdown renderer supports:
- **Headers** (`#`, `##`, `###`)
- **Bold** (`**text**`) and *italic* (`*text*`)
- **Links** (`[text](url)`)
- **Lists** (bullet and numbered)
- **Tables** (for payment details, etc.)
- **Blockquotes** (`>` for callouts)
- **Horizontal rules** (`---`)

---

## Updating App Templates

1. Edit the `.md` file in this directory
2. Copy the content (below the metadata header)
3. In Super Admin → Email Communication → Templates
4. Toggle "Use Markdown" ON
5. Paste the markdown content
6. Preview to verify formatting
7. Save

---

## Brand Colors

Templates automatically apply CAMP brand colors:
- **Forest Green** `#316429` - Headers, accents
- **Orange** `#e26e15` - Links, CTAs
- **Charcoal** `#202020` - Dark text
- **Text** `#333333` - Body copy
