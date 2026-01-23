# CAMP FASD Security Remediation Plan

> **Created:** January 19, 2026
> **Last Updated:** January 19, 2026
> **Status:** In Progress

## Executive Summary

This document tracks **26 security vulnerabilities** discovered in the CAMP FASD application, which handles sensitive children's medical information (prescriptions, allergies, behavioral health data). Given the sensitivity of this data and potential FERPA/HIPAA compliance requirements, these issues must be addressed before production deployment.

---

## Risk Classification Summary

| Severity | Count | Status |
| -------- | ----- | ------ |
| **CRITICAL** | 6 | 0/6 Complete |
| **HIGH** | 8 | 0/8 Complete |
| **MEDIUM** | 12 | 0/12 Complete |

---

## Phase 1: CRITICAL Fixes (Must Complete Before Production)

### 1.1 Secure Cron Endpoints

- [ ] **INCOMPLETE**

**File:** `backend/app/api/cron.py:30-38`

**Issue:** The `verify_cron_secret()` function always returns `True`, meaning anyone can trigger email sending, admin digests, and payment reminders by simply calling the endpoints.

**Current Code:**

```python
def verify_cron_secret(authorization: Optional[str] = Header(None)):
    # For now, we allow all requests (can be secured later with CRON_SECRET env var)
    return True
```

**Required Fix:**

1. Add `CRON_SECRET` environment variable to `backend/app/core/config.py`
2. Implement actual secret verification in `verify_cron_secret()`
3. Configure Vercel cron jobs to send `Authorization: Bearer <secret>` header
4. Add `CRON_SECRET` to production environment variables

**Affected Endpoints:**

- `POST /api/cron/process-queue`
- `POST /api/cron/weekly-emails`
- `POST /api/cron/admin-digest`
- `POST /api/cron/payment-reminders`
- `POST /api/cron/incomplete-reminders`

**Verification:** `curl -X POST https://api.../api/cron/process-queue` should return 401 (not 200)

---

### 1.2 Remove Auto-Admin Role Assignment

- [ ] **INCOMPLETE**

**File:** `backend/app/api/auth_google.py:72-73`

**Issue:** Any Google account with `@fasdcamp.org` email automatically gets admin role. If an attacker creates a Google account with that domain (or compromises one), they gain full admin access to children's medical data.

**Current Code:**

```python
is_fasdcamp_staff = email.endswith('@fasdcamp.org')
user_role = "admin" if is_fasdcamp_staff else "user"
```

**Required Fix:**

1. Default ALL new OAuth users to "user" role
2. Require manual promotion by existing super_admin via `/api/super-admin/users/{id}/role`
3. Optional: Create admin email allowlist in `system_configuration` table

**Verification:** Create new Google account with @fasdcamp.org domain, verify role is "user"

---

### 1.3 Path Traversal Prevention

- [ ] **INCOMPLETE**

**File:** `backend/app/services/storage_service.py:136`

**Issue:** Filename is used directly in storage path without sanitization. An attacker could upload a file named `../../../sensitive/data.pdf` to potentially escape the intended directory.

**Current Code:**

```python
file_path = f"applications/{application_id}/{question_id}/{filename}"
```

**Required Fix:**

1. Create `backend/app/core/security_utils.py` with filename sanitization utilities
2. Add `sanitize_filename()` function using `os.path.basename()` + regex cleaning
3. Generate UUID-prefixed filenames to prevent collisions and path guessing
4. Update `upload_file()` to use the sanitization function

**Example Fix:**

```python
import re
import uuid
import os

def sanitize_filename(filename: str) -> str:
    """Remove path traversal attempts and dangerous characters"""
    filename = os.path.basename(filename)
    filename = re.sub(r'[/\\]', '', filename)
    filename = re.sub(r'[^a-zA-Z0-9._-]', '_', filename)
    if not filename or filename in ['.', '..']:
        filename = 'unnamed_file'
    return filename

def generate_safe_path(application_id: str, question_id: str, original_filename: str) -> str:
    safe_filename = sanitize_filename(original_filename)
    unique_id = uuid.uuid4().hex[:8]
    return f"applications/{application_id}/{question_id}/{unique_id}_{safe_filename}"
```

**Verification:** Upload file named `../../../test.pdf` - should be sanitized to safe name

---

### 1.4 XSS Prevention (Markdown Sanitization)

- [ ] **INCOMPLETE**

**File:** `frontend/app/dashboard/application/[id]/page.tsx:1185-1187`

**Issue:** `ReactMarkdown` renders database content (question descriptions) without sanitization. An admin-injected XSS payload would execute in all users' browsers with their authentication tokens.

**Current Code:**

```tsx
<ReactMarkdown remarkPlugins={[remarkGfm]}>
    {question.description}
</ReactMarkdown>
```

**Required Fix:**

1. Install `rehype-sanitize` package: `npm install rehype-sanitize`
2. Configure ReactMarkdown with sanitization schema
3. Apply sanitization to ALL ReactMarkdown usages throughout the application

**Example Fix:**

```tsx
import rehypeSanitize from 'rehype-sanitize'

<ReactMarkdown
  remarkPlugins={[remarkGfm]}
  rehypePlugins={[rehypeSanitize]}
>
  {question.description}
</ReactMarkdown>
```

**Other Files to Check:**

- `frontend/components/email/MarkdownEmailEditor.tsx`
- Any other files using `ReactMarkdown` or `dangerouslySetInnerHTML`

**Verification:** Store `<script>alert('xss')</script>` in question description - should render as text, not execute

---

### 1.5 CSRF Protection

- [ ] **INCOMPLETE**

**File:** `backend/app/main.py:19-26`

**Issue:** CORS allows credentials but there's no CSRF protection. State-changing requests (creating applications, approving, uploading files) are unprotected.

**Current Code:**

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

**Required Fix:**

1. Add CSRF middleware requiring `X-Requested-With: XMLHttpRequest` header for state-changing requests
2. Update frontend API client (`frontend/lib/api.ts`) to include this header on all requests
3. Restrict CORS methods and headers to specific list (remove `["*"]`)

**Backend Middleware Example:**

```python
class CSRFMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        if request.method in ["POST", "PUT", "DELETE", "PATCH"]:
            if not request.url.path.startswith("/api/webhooks"):
                if request.headers.get("X-Requested-With") != "XMLHttpRequest":
                    return JSONResponse(status_code=403, content={"detail": "CSRF validation failed"})
        return await call_next(request)
```

**Frontend Change:**

```typescript
// In api.ts - add to all fetch calls
headers: {
  'X-Requested-With': 'XMLHttpRequest',
  // ... existing headers
}
```

**Verification:** POST request without `X-Requested-With` header should fail with 403

---

### 1.6 File Content Validation (Basic Malware Prevention)

- [ ] **INCOMPLETE**

**Files:** `backend/app/api/files.py`, `backend/app/services/storage_service.py`

**Issue:** Only file extension and declared MIME type are checked. No validation that file content actually matches. Malicious files (PDF exploits, trojans in documents) could be uploaded and accessed by families.

**Required Fix:**

1. Install `python-magic` library: `pip install python-magic`
2. Validate file magic bytes match declared extension
3. Consider future integration with ClamAV or cloud scanning service for enhanced protection

**Example Implementation:**

```python
import magic

ALLOWED_MIMES = {
    '.pdf': 'application/pdf',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
}

def validate_file_content(file_bytes: bytes, filename: str) -> bool:
    extension = Path(filename).suffix.lower()
    if extension not in ALLOWED_MIMES:
        return False
    actual_mime = magic.from_buffer(file_bytes, mime=True)
    return actual_mime == ALLOWED_MIMES[extension]
```

**Verification:** Upload EICAR test file - should be rejected

---

## Phase 2: HIGH Severity Fixes

### 2.1 Reduce Token Expiration

- [ ] **INCOMPLETE**

**File:** `backend/app/core/config.py:21`

**Issue:** Access tokens are valid for 24 hours, which is too long for an application handling children's medical data. If a token is stolen, the attacker has 24-hour access.

**Current:** `ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24`

**Required Fix:**

1. Reduce to 2 hours: `ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 2`
2. Implement refresh token rotation for better UX

---

### 2.2 Error Message Sanitization

- [ ] **INCOMPLETE**

**Files:** Multiple files in `backend/app/api/`

**Issue:** Error messages expose internal details like stack traces, database information, and system paths.

**Examples Found:**

- `backend/app/api/files.py:96` - `detail=f"Upload failed: {str(e)}"`
- `backend/app/api/admin.py:238` - `detail=f"Error getting approval status: {str(e)}"`
- `backend/app/api/auth_google.py:122` - `detail=f"Invalid Google token: {str(e)}"`

**Required Fix:**

1. Create `backend/app/core/exceptions.py` with standardized error handler
2. Log full errors server-side with correlation ID
3. Return only correlation ID to client in production
4. Replace all `detail=f"Error: {str(e)}"` patterns

**Example:**

```python
def handle_error(e: Exception, operation: str) -> dict:
    error_id = str(uuid4())[:8]
    logger.error(f"[{error_id}] {operation}: {type(e).__name__}: {str(e)}", exc_info=True)

    if settings.DEBUG:
        return {"detail": f"Error: {str(e)}", "error_id": error_id}
    else:
        return {"detail": f"An error occurred. Reference: {error_id}"}
```

---

### 2.3 Restrict CORS Configuration

- [ ] **INCOMPLETE**

**File:** `backend/app/main.py:20-26`

**Required Fix:**

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Requested-With", "Accept"],
    expose_headers=["Content-Disposition"],
    max_age=600,
)
```

---

### 2.4 Reduce Signed URL Expiration

- [ ] **INCOMPLETE**

**File:** `backend/app/services/storage_service.py:163`

**Issue:** Signed URLs for sensitive children's files are valid for 1 year. If a URL is leaked or compromised, the attacker has year-long access.

**Current:** `expires_in=31536000  # 1 year in seconds`

**Required Fix:** Reduce to 1 hour: `expires_in=3600`

---

### 2.5 Fix User Enumeration

- [ ] **INCOMPLETE**

**File:** `backend/app/api/auth.py:159-236`

**Issue:** The `/check-legacy-user` endpoint reveals whether an email exists in the system, enabling attackers to enumerate valid user accounts.

**Required Fix:**

1. Add rate limiting (5 requests per minute per IP)
2. Add random delay (0.1-0.3 seconds) to prevent timing attacks
3. Consider returning same response structure regardless of email existence

---

### 2.6 Disable DEBUG Mode Default

- [ ] **INCOMPLETE**

**File:** `backend/app/core/config.py:15`

**Current:** `DEBUG: bool = True`

**Required Fix:** `DEBUG: bool = os.getenv("DEBUG", "false").lower() == "true"`

---

### 2.7 Remove Sensitive Print Statements

- [ ] **INCOMPLETE**

**Files:**

- `backend/app/core/deps.py:40, 51, 64, 71-73, 129`
- `backend/app/api/applications.py:128, 198, 309, 553`
- `backend/app/api/admin.py:235, 309`
- `backend/app/api/cron.py:213, 253, 295`

**Issue:** Print statements and `traceback.print_exc()` calls log sensitive information like user IDs, authentication details, and full stack traces.

**Required Fix:**

1. Replace all `print()` statements with proper structured logging
2. Remove all `traceback.print_exc()` calls - use `logger.exception()` instead
3. Configure logging to NOT log sensitive fields (passwords, tokens, medical data)

---

### 2.8 MIME Type Validation Enhancement

- [ ] **INCOMPLETE**

**File:** `backend/app/api/files.py:52-53, 146-147`

**Issue:** Only validates file extension, not actual content type. Client could send `.pdf` extension with malicious JavaScript content.

**Required Fix:** Validate magic bytes match extension (see 1.6 implementation)

---

## Phase 3: MEDIUM Severity Fixes

### 3.1 Add Rate Limiting

- [ ] **INCOMPLETE**

**Required:** Install `slowapi` and configure rate limits

**Recommended Limits:**

| Endpoint Type | Limit |
| ------------- | ----- |
| Login | 5/minute |
| Registration | 3/minute |
| Password reset | 3/minute |
| File upload | 10/minute per user |
| General API | 60/minute |

---

### 3.2 Enable Email Verification

- [ ] **INCOMPLETE**

**File:** `backend/app/core/deps.py:163-169`

**Issue:** Email verification check is commented out - unverified users can access/modify sensitive data.

**Required Fix:** Uncomment verification check, use `get_current_active_user` for sensitive operations

---

### 3.3 Server-Side Token Revocation

- [ ] **INCOMPLETE**

**Issue:** Logout is client-side only. Stolen tokens remain valid until expiration.

**Required Fix:**

1. Create `token_blocklist` database table
2. Add JTI (JWT ID) claim to tokens
3. Check blocklist on each request in `get_current_user`
4. Add to blocklist on logout

---

### 3.4 Enable Build-Time Type Checking

- [ ] **INCOMPLETE**

**File:** `frontend/next.config.js:8-13`

**Issue:** TypeScript and ESLint errors are ignored during builds, potentially hiding security issues.

**Current:**

```javascript
typescript: { ignoreBuildErrors: true },
eslint: { ignoreDuringBuilds: true },
```

**Required Fix:**

1. Fix all existing TypeScript errors
2. Fix all existing ESLint errors
3. Set both to `false`

---

### 3.5 Add Content Security Policy Headers

- [ ] **INCOMPLETE**

**File:** `frontend/next.config.js` or `frontend/middleware.ts`

**Required Fix:** Add CSP headers to prevent inline script execution and other XSS vectors

---

### 3.6 Audit Logging Enhancement

- [ ] **INCOMPLETE**

**Existing File:** `backend/app/core/audit.py`

**Required Fix:** Ensure ALL medical data access (medications, allergies, application responses) is logged to immutable audit table for compliance

---

## Critical Files Reference

| File | Issues Found |
| ---- | ------------ |
| `backend/app/api/cron.py` | Unprotected cron endpoints (1.1) |
| `backend/app/api/auth_google.py` | Auto-admin assignment (1.2), error leakage (2.2) |
| `backend/app/services/storage_service.py` | Path traversal (1.3), 1-year URLs (2.4) |
| `backend/app/main.py` | CORS too permissive (2.3), no CSRF (1.5) |
| `backend/app/core/config.py` | DEBUG mode (2.6), long token expiration (2.1) |
| `backend/app/core/deps.py` | Print statements (2.7), email verification (3.2) |
| `backend/app/api/files.py` | MIME validation (2.8), error leakage (2.2) |
| `backend/app/api/auth.py` | User enumeration (2.5) |
| `frontend/app/dashboard/application/[id]/page.tsx` | XSS via markdown (1.4) |
| `frontend/lib/api.ts` | Missing CSRF header (1.5) |
| `frontend/next.config.js` | Build errors ignored (3.4) |

---

## Dependencies to Add

**Backend (`requirements.txt`):**

```
slowapi>=0.1.9
python-magic>=0.4.27
```

**Frontend (`package.json`):**

```json
{
  "rehype-sanitize": "^6.0.0"
}
```

---

## Implementation Timeline

### Week 1 (Critical - Must Complete)

- [ ] 1.1 Cron endpoint protection
- [ ] 1.2 Remove auto-admin assignment
- [ ] 1.3 Path traversal prevention
- [ ] 1.4 XSS prevention
- [ ] 1.5 CSRF protection

### Week 2 (High Priority)

- [ ] 2.1 Token expiration
- [ ] 2.2 Error sanitization
- [ ] 2.3 CORS restriction
- [ ] 2.4 Signed URL expiration
- [ ] 2.6 DEBUG mode fix

### Week 3 (Medium Priority)

- [ ] 3.1 Rate limiting
- [ ] 3.2 Email verification
- [ ] 2.7 Logging cleanup
- [ ] 2.8 MIME validation

### Week 4 (Cleanup & Testing)

- [ ] 1.6 File content validation
- [ ] 3.3 Token revocation
- [ ] 3.4 Build-time checks
- [ ] 3.5 CSP headers
- [ ] Security testing / penetration testing

---

## Verification Checklist

After all implementations, verify:

- [ ] Cron endpoints return 401 without proper auth
- [ ] New @fasdcamp.org user gets "user" role
- [ ] Path traversal filenames are sanitized
- [ ] XSS payloads render as text
- [ ] Requests without CSRF header fail
- [ ] Production errors show only reference IDs
- [ ] Rate limiting blocks excessive requests
- [ ] Signed URLs expire in 1 hour

---

## Compliance Notes

This application handles children's medical information and may be subject to:

- **FERPA** (Family Educational Rights and Privacy Act) - if data relates to educational records
- **HIPAA** (Health Insurance Portability and Accountability Act) - if data includes protected health information
- **State privacy laws** - varies by jurisdiction

Consider consulting with a compliance specialist before production deployment.

---

## Change Log

| Date | Changes | Author |
| ---- | ------- | ------ |
| 2026-01-19 | Initial security audit completed, plan created | Claude Code |
