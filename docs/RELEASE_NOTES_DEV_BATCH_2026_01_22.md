# CAMP FASD - Release Notes: Dev Batch January 22, 2026

> **Branch:** `dev`
> **Status:** Ready for Review
> **Date:** January 22, 2026

This document summarizes all unstaged changes currently in the development branch, organized by initiative. Review this document before merging to `master`.

---v

## Table of Contents

1. [Initiative 1: Security Hardening](#initiative-1-security-hardening)
2. [Initiative 2: Scheduled Email Automations](#initiative-2-scheduled-email-automations)
3. [Initiative 3: Bug Fixes & Minor Improvements](#initiative-3-bug-fixes--minor-improvements)
4. [Initiative 4: Admin Dashboard & UI Fixes](#initiative-4-admin-dashboard--ui-fixes)
5. [Pre-Deployment Checklist](#pre-deployment-checklist)
6. [Testing Plan](#testing-plan)
7. [Rollback Plan](#rollback-plan)

---

## Initiative 1: Security Hardening

### Overview

Comprehensive security improvements addressing 26 vulnerabilities identified in the security audit. This initiative implements multiple layers of defense for an application handling sensitive children's medical information.

### Files Added

| File | Purpose |
|------|---------|
| `backend/app/core/csrf.py` | CSRF protection middleware requiring `X-Requested-With` header |
| `backend/app/core/exceptions.py` | Standardized error handling with correlation IDs, prevents info leakage |
| `backend/app/core/logging_config.py` | Structured logging configuration |
| `backend/app/core/rate_limit.py` | Rate limiting configuration using slowapi |
| `backend/app/core/security_utils.py` | Input sanitization utilities (filename, path traversal prevention) |
| `docs/SECURITY_REMEDIATION.md` | Full security audit findings and remediation plan |

### Files Modified

| File | Changes |
|------|---------|
| `backend/app/main.py` | Added CSRF middleware, error handling middleware, rate limiter, restricted CORS |
| `backend/app/core/config.py` | Added `CRON_SECRET` config, changed `DEBUG` default handling |
| `backend/app/core/deps.py` | Cleaned up print statements, improved auth handling |
| `backend/app/api/auth_google.py` | **Removed auto-admin assignment** for @fasdcamp.org emails |
| `backend/app/api/files.py` | Added file content validation, path sanitization |
| `backend/app/api/cron.py` | **Implemented cron secret verification** (was always returning true) |
| `backend/app/services/storage_service.py` | Path traversal prevention, reduced signed URL expiration |
| `backend/requirements.txt` | Added `slowapi>=0.1.9`, `python-magic>=0.4.27` |
| `frontend/lib/api.ts` | Added CSRF header (`X-Requested-With: XMLHttpRequest`) to all requests |
| `frontend/lib/api-*.ts` (all 9 files) | Added CSRF headers to all API calls |
| `frontend/next.config.js` | Added Content Security Policy (CSP), security headers |
| `frontend/package.json` | Added `rehype-sanitize` for XSS prevention |
| `frontend/app/dashboard/application/[id]/page.tsx` | Added `rehype-sanitize` to ReactMarkdown |

### Security Changes Summary

#### 1. CSRF Protection (Critical)
- **Backend:** New `CSRFProtectionMiddleware` requires `X-Requested-With: XMLHttpRequest` header for all POST/PUT/DELETE/PATCH requests
- **Frontend:** All API client files now include this header
- **Exempt paths:** OAuth callbacks, webhooks, cron endpoints (have their own auth)

#### 2. Cron Endpoint Protection (Critical)
- Previously: `verify_cron_secret()` always returned `True`
- Now: Validates `Authorization: Bearer <CRON_SECRET>` header
- Requires `CRON_SECRET` environment variable in production

#### 3. Auto-Admin Removal (Critical)
- Previously: Any `@fasdcamp.org` email got automatic admin role
- Now: All new users get `user` role, require manual promotion

#### 4. Path Traversal Prevention (Critical)
- New `sanitize_filename()` function prevents `../../../etc/passwd` attacks
- New `generate_safe_storage_path()` adds UUID prefixes
- File magic byte validation confirms content matches extension

#### 5. XSS Prevention (Critical)
- Added `rehype-sanitize` to ReactMarkdown components
- Prevents stored XSS via admin-injected markdown

#### 6. CORS Restrictions (High)
- Changed from `allow_methods=["*"]` to explicit list
- Changed from `allow_headers=["*"]` to explicit list

#### 7. Content Security Policy (Medium)
- New CSP header restricts script/style/image sources
- Prevents inline script injection
- X-Frame-Options: DENY (clickjacking prevention)

#### 8. Error Sanitization (High)
- New `ErrorHandlingMiddleware` catches unhandled exceptions
- Returns correlation IDs instead of stack traces
- Full details logged server-side only

#### 9. Rate Limiting (Medium)
- Configured rate limits for auth endpoints (5/min login)
- General API limit: 60/minute
- File uploads: 10/minute

### Dependencies Added

**Backend (`requirements.txt`):**
```
slowapi>=0.1.9          # Rate limiting
python-magic>=0.4.27    # File type validation via magic bytes
```

**Frontend (`package.json`):**
```json
"rehype-sanitize": "^6.0.0"
```

---

## Initiative 2: Scheduled Email Automations

### Overview

The super admin UI allows creating scheduled email automations (e.g., "Send payment reminder every Tuesday at 9 AM"), but they never executed. The backend `cron.py` had hardcoded logic for 3 specific email types that only ran Monday 9 AM UTC, completely ignoring the `email_automations` table.

This initiative makes scheduled automations **data-driven** - they now read from the database and can be configured via the UI.

### Files Added

| File | Purpose |
|------|---------|
| `backend/app/services/scheduled_emails.py` | New service for processing scheduled automations |
| `supabase/migrations/036_scheduled_automation_tracking.sql` | Adds `last_sent_at` column to `email_automations` |
| `supabase/migrations/037_seed_default_scheduled_automations.sql` | Seeds default automations with schedule settings |

### Files Modified

| File | Changes |
|------|---------|
| `backend/app/api/cron.py` | Added new `/api/cron/scheduled-automations` endpoint |
| `backend/app/models/super_admin.py` | Added `last_sent_at` column to `EmailAutomation` model |
| `backend/vercel.json` | Changed cron from weekly (`0 9 * * 1`) to hourly (`0 * * * *`) |
| `frontend/lib/api-super-admin.ts` | Added `last_sent_at` to `EmailAutomation` interface |
| `frontend/app/super-admin/email-communication/page.tsx` | Shows last sent time for scheduled automations, Central time note |

### How It Works

1. **Hourly Cron:** Vercel calls `/api/cron/scheduled-automations` every hour
2. **Query Due Automations:** Service queries `email_automations` where:
   - `trigger_type = 'scheduled'`
   - `is_active = true`
   - `schedule_day` matches current **Chicago time** day (0=Sunday, 6=Saturday)
   - `schedule_hour` matches current **Chicago time** hour (0-23)
   - `last_sent_at` is null OR > 7 days ago
3. **Send Emails:** For each automation, get recipients via `audience_filter`, send template emails
4. **Update Tracking:** Set `last_sent_at` to prevent duplicate sends

### Timezone Configuration

**All scheduled automations use America/Chicago (Central Time).** This means:
- 9 AM in the UI = 9 AM Central, regardless of whether Chicago is in CST or CDT
- The backend uses Python's `zoneinfo.ZoneInfo("America/Chicago")` which handles DST automatically
- No user action required during daylight saving transitions

### Day of Week Mapping

| Database Value | Day |
|----------------|-----|
| 0 | Sunday |
| 1 | Monday |
| 2 | Tuesday |
| 3 | Wednesday |
| 4 | Thursday |
| 5 | Friday |
| 6 | Saturday |

**Note:** Python's `datetime.weekday()` uses Monday=0, so the service converts: `db_day = (python_weekday + 1) % 7`

### Migration Details

**036: Add tracking column**
```sql
ALTER TABLE email_automations ADD COLUMN IF NOT EXISTS last_sent_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_email_automations_scheduled
ON email_automations(trigger_type, schedule_day, schedule_hour, is_active)
WHERE trigger_type = 'scheduled' AND is_active = true;
```

**037: Seed defaults**
- Updates existing scheduled automations with `schedule_day=1` (Monday), `schedule_hour=9` (9 AM Central)
- Creates automations if they don't exist (for fresh installs)
- Adds documentation comments to columns

---

## Initiative 3: Bug Fixes & Minor Improvements

### Email Queue Fix

| File | Purpose |
|------|---------|
| `supabase/migrations/035_fix_email_queue_updated_at.sql` | Adds missing `updated_at` column to `email_queue` table |

The email queue table was created without the `updated_at` column that triggers expected. This migration adds it.

---

## Initiative 4: Admin Dashboard & UI Fixes

### Files Modified

| File | Change |
|------|--------|
| `frontend/app/admin/page.tsx` | Changed "Total Applications" to "Active Families" (applicants + campers only) |
| `frontend/app/admin/layout.tsx` | Fixed sidebar visibility: admin nav now hidden until `lg` breakpoint |
| `frontend/app/admin/applications/[id]/page.tsx` | Section sidebar now shows at `md` breakpoint (was `lg`) |
| `frontend/app/super-admin/email-communication/page.tsx` | Updated timezone labels from "UTC" to "Central" |
| `backend/app/services/scheduled_emails.py` | Changed timezone from UTC to America/Chicago |

### 1. Admin Dashboard Metric Fix

**Problem:** "Total Applications" count included all statuses, which was misleading.

**Solution:**
- Renamed to **"Active Families"**
- Now only counts applications with status `applicant` or `camper`
- Excludes inactive statuses (withdrawn, rejected, etc.)
- Added subtitle "Applicants & Campers" for clarity

### 2. Responsive Sidebar Priority Fix

**Problem:** On medium-width screens (tablets/small laptops), the admin navigation sidebar competed with the application sections sidebar, causing layout issues.

**Solution:**
- **Admin nav sidebar:** Now `hidden lg:block` (only shows on large screens 1024px+)
- **Sections sidebar:** Now `hidden md:block` (shows on medium screens 768px+)
- This ensures sections sidebar takes priority when space is limited

### 3. Scheduled Email Timezone Fix

**Problem:** Scheduled email times were in UTC, which was confusing for Chicago-based camp staff.

**Solution:**
- Backend now uses `America/Chicago` timezone (Central Time)
- Python's `zoneinfo` module handles CST/CDT transitions automatically
- UI labels updated from "(UTC)" to "(Central)"
- No changes needed for existing automations - times will now be interpreted as Central

---

## Pre-Deployment Checklist

### Environment Variables

These must be set in Vercel/your hosting provider BEFORE deploying:

#### Backend (Vercel API Project)

| Variable | Required | Description |
|----------|----------|-------------|
| `CRON_SECRET` | **YES** | Secret for authenticating cron job requests. Generate with: `openssl rand -hex 32` |
| `DEBUG` | NO | Set to `false` for production (defaults to checking env) |

**How to set CRON_SECRET in Vercel:**
1. Go to Vercel Dashboard → Your Backend Project → Settings → Environment Variables
2. Add `CRON_SECRET` with your generated secret
3. The secret is automatically sent by Vercel cron jobs via the `Authorization` header

#### Frontend (Vercel Frontend Project)

No new environment variables required.

### Database Migrations (Supabase)

Run these migrations on **DEV database FIRST**, then PROD after testing:

```bash
# From project root
node run-migration.js
```

**Or manually via Supabase SQL Editor:**

1. **035_fix_email_queue_updated_at.sql** - Fixes email queue table
2. **036_scheduled_automation_tracking.sql** - Adds `last_sent_at` column
3. **037_seed_default_scheduled_automations.sql** - Seeds default automations

**Order matters!** Run in numeric order.

### Dependencies Installation

#### Backend
```bash
cd backend
pip install slowapi>=0.1.9 python-magic>=0.4.27
# Or if using pip freeze:
pip install -r requirements.txt
```

**Note for Mac users:** `python-magic` requires libmagic:
```bash
brew install libmagic
```

**Note for Ubuntu/Debian:**
```bash
apt-get install libmagic1
```

#### Frontend
```bash
cd frontend
npm install
# This will install rehype-sanitize
```

### Vercel Configuration

The `backend/vercel.json` changes the cron schedule. After deployment:
1. Go to Vercel Dashboard → Your Backend Project → Settings → Cron Jobs
2. Verify two cron jobs exist:
   - `/api/cron/process-queue` - Every 5 minutes
   - `/api/cron/scheduled-automations` - Every hour at :00

---

## Testing Plan

### Initiative 1: Security Testing

#### CSRF Protection Tests

| Test | Steps | Expected Result |
|------|-------|-----------------|
| Request without CSRF header | `curl -X POST https://api.../api/applications -H "Authorization: Bearer TOKEN"` | 403 Forbidden |
| Request with CSRF header | `curl -X POST https://api.../api/applications -H "Authorization: Bearer TOKEN" -H "X-Requested-With: XMLHttpRequest"` | Normal response |
| Exempt paths work | `curl -X POST https://api.../api/auth/login -d '{"email":"...","password":"..."}'` | Works without CSRF header |

#### Cron Security Tests

| Test | Steps | Expected Result |
|------|-------|-----------------|
| Cron without auth | `curl -X POST https://api.../api/cron/process-queue` | 401 Unauthorized |
| Cron with wrong secret | `curl -X POST https://api.../api/cron/process-queue -H "Authorization: Bearer wrong"` | 401 Unauthorized |
| Cron with correct secret | `curl -X POST https://api.../api/cron/process-queue -H "Authorization: Bearer $CRON_SECRET"` | 200 OK |

#### Auto-Admin Removal Tests

| Test | Steps | Expected Result |
|------|-------|-----------------|
| New @fasdcamp.org user | Sign up with new @fasdcamp.org Google account | Role is `user` (not `admin`) |
| Existing admins unaffected | Log in as existing admin | Still has `admin` role |

#### Path Traversal Tests

| Test | Steps | Expected Result |
|------|-------|-----------------|
| Upload file named `../../../etc/passwd` | Try via file upload UI | Filename sanitized to `etc_passwd` or similar |
| Upload file with null bytes | Upload `test\x00.pdf` | Null bytes removed |

#### XSS Prevention Tests

| Test | Steps | Expected Result |
|------|-------|-----------------|
| Markdown XSS | Store `<script>alert('xss')</script>` in question description | Renders as text, no popup |
| Markdown link XSS | Store `[link](javascript:alert('xss'))` | Link disabled or sanitized |

#### CSP Header Tests

| Test | Steps | Expected Result |
|------|-------|-----------------|
| Check headers | Open DevTools → Network → Look at response headers | CSP header present |
| Inline script blocked | Try injecting inline `<script>` | Blocked by CSP |

#### Rate Limiting Tests

| Test | Steps | Expected Result |
|------|-------|-----------------|
| Login rate limit | Try 10 rapid login attempts | After 5, get 429 Too Many Requests |
| General rate limit | Make 70 rapid API calls | After 60, get 429 |

### Initiative 2: Scheduled Email Automation Testing

#### Basic Functionality

| Test | Steps | Expected Result |
|------|-------|-----------------|
| View automations | Go to Super Admin → Email Communication → Automations tab | See list of automations with "Last sent" column |
| Create scheduled automation | Create new automation, select "Scheduled", pick day/hour | Saves successfully |
| Edit automation schedule | Edit existing automation, change day/hour | Saves successfully |

#### Cron Execution Tests

| Test | Steps | Expected Result |
|------|-------|-----------------|
| Manual trigger | `curl -X POST https://api.../api/cron/scheduled-automations -H "Authorization: Bearer $CRON_SECRET"` | Returns JSON with `automations_processed` |
| Emails sent | After trigger, check email_logs table | New log entries for recipients |
| last_sent_at updated | Check `email_automations` table | `last_sent_at` timestamp updated |
| No duplicates | Trigger again immediately | Returns `automations_found: 0` (already ran) |

#### End-to-End Test

1. Create new scheduled automation:
   - Name: "Test Automation"
   - Template: Any active template
   - Type: Scheduled
   - Day: (current day)
   - Hour: (current hour)
   - Audience: "All Admins"
   - Active: Yes
2. Manually call the cron endpoint
3. Verify:
   - Email sent to admins
   - `last_sent_at` populated
   - Shows in UI

### Initiative 3: Bug Fix Testing

#### Email Queue Tests

| Test | Steps | Expected Result |
|------|-------|-----------------|
| Queue email | Trigger any email action | Email queued successfully |
| Process queue | Wait for cron or manual trigger | Email sent, `updated_at` column works |

---

## Rollback Plan

If critical issues are discovered after deployment:

### Security Rollback

1. **CSRF issues:** Set `debug=True` in `CSRFProtectionMiddleware` to bypass (temporary)
2. **Rate limiting issues:** Remove limiter from `main.py`
3. **Cron issues:** Set `CRON_SECRET=""` in env vars to bypass auth (temporary!)

### Scheduled Emails Rollback

1. Revert `backend/vercel.json` to weekly schedule:
   ```json
   {"path": "/api/cron/weekly-emails", "schedule": "0 9 * * 1"}
   ```
2. The old `/api/cron/weekly-emails` endpoint still exists and works
3. `last_sent_at` column is additive - no data loss

### Full Rollback

If needed, revert the entire branch:
```bash
git checkout master
git branch -D dev  # Delete corrupted dev
git checkout -b dev  # Fresh dev from master
```

---

## Questions / Notes

### For Review

1. **CRON_SECRET:** Who should have access? Store in password manager?
2. **Rate limits:** Are the configured limits appropriate for expected traffic?
3. **CSP:** Any third-party scripts/styles we need to allow?
4. **Scheduled automations:** Should we test with a specific time zone conversion helper in the UI?

### Known Limitations

1. **Rate limiting uses in-memory storage:** For high-availability production, consider Redis backend
2. **CSP may block legitimate scripts:** Watch for console errors after deployment
3. **python-magic requires libmagic:** Ensure server has it installed

### Future Improvements

See `docs/SECURITY_REMEDIATION.md` for remaining security items:
- Token revocation (server-side logout)
- Email verification enforcement
- Build-time type checking (fix existing TS errors)

---

## Change Statistics

```
28 files changed, ~500 insertions(+), ~120 deletions(-)
```

**New Files:** 9
**Modified Files:** 19
**Migrations:** 3
