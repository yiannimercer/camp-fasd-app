# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CAMP FASD Camper Application Portal - Full-stack web application for managing camper registrations.
- **Frontend**: Next.js 14 + TypeScript + TailwindCSS + shadcn/ui (`frontend/`)
- **Backend**: FastAPI (Python 3.11+) + PostgreSQL via Supabase (`backend/`)
- **Key Integrations**: Supabase (Auth + Storage), Stripe (TODO), SendGrid (TODO)

Both frontend and backend are independent apps in a monorepo structure with separate dependencies.

---

## Development Commands

### Frontend (Next.js)
```bash
cd frontend
npm install                    # Install dependencies
npm run dev                    # Start dev server (localhost:3000)
npm run build                  # Production build
npm run lint                   # ESLint
npm run type-check             # TypeScript checking (npx tsc --noEmit)
```

### Backend (FastAPI)
```bash
cd backend
source .venv/bin/activate      # Activate venv (Windows: .venv\Scripts\activate)
pip install -r requirements.txt

uvicorn app.main:app --reload  # Start dev server (localhost:8000)

# Testing
pytest                         # Run all tests
pytest tests/test_auth.py      # Run single test file
pytest -k "test_login"         # Run tests matching pattern
pytest -v                      # Verbose output

# Code formatting
black .                        # Format Python code
isort .                        # Sort imports
flake8                         # Lint
```

### Database
```bash
# Direct PostgreSQL access (use env var for password, not inline)
PGPASSWORD="$DB_PASSWORD" psql "$DATABASE_URL"

# Migrations
cd supabase && supabase migration up
# OR
node run-migration.js          # Custom migration runner in project root
```

---

## Architecture

### Application Status Flow
```
in_progress → under_review (auto at 100%) → [3 team approvals] → accepted → paid
```
Status changes trigger conditional section visibility (`show_when_status` field).

### Database Patterns
- **Direct SQL** with `psycopg2` (NOT SQLAlchemy ORM for queries)
- All queries use parameterized statements
- Connection managed in `backend/app/core/database.py`

### Authentication Chain
```
Frontend → Bearer token → backend/app/core/deps.py → JWT validation → User model
```
Role dependencies in `deps.py`:
- `get_current_user` - any authenticated user
- `get_current_admin_user` - admin or super_admin
- `get_current_super_admin_user` - super_admin only

### API Client Pattern (Frontend)
All API calls go through `frontend/lib/api-*.ts` files:
- `api.ts` - base config, auth functions
- `api-applications.ts` - application CRUD
- `api-admin.ts` - admin endpoints
- `api-files.ts` - file operations
- `api-application-builder.ts` - super admin form builder
- `api-medications.ts` - medications/allergies CRUD

### Dynamic Form System
Questions are stored in `application_questions` with:
- `question_type`: text, textarea, dropdown, multiple_choice, file_upload, profile_picture, checkbox, date, email, phone, signature
- `show_if_question_id` + `show_if_answer`: conditional visibility
- `detail_prompt_trigger` + `detail_prompt_text`: follow-up prompts (JSONB array for multiple triggers)
- `template_file_id`: downloadable template attachments

---

## Key Database Tables

```sql
applications (id, user_id, status, completion_percentage, ...)
application_sections (id, title, order_index, show_when_status)
application_questions (id, section_id, question_type, show_if_question_id, show_if_answer, ...)
application_responses (id, application_id, question_id, response_value, file_id)
camper_medications (id, application_id, medication_name, dosage, frequency, ...)
camper_allergies (id, application_id, allergy_name, reaction, severity, ...)
files (id, application_id, question_id, storage_path, ...)
users (id, email, role, team, ...)
```

---

## Critical File Locations

### Backend Core
- `app/main.py` - FastAPI app, CORS, router registration
- `app/core/config.py` - Pydantic settings
- `app/core/deps.py` - Auth dependencies (role checking)
- `app/core/database.py` - DB connection

### Backend API Routes
- `app/api/applications.py` - Application CRUD, autosave
- `app/api/admin.py` - Review, approval workflow
- `app/api/application_builder.py` - Super admin form builder
- `app/api/files.py` - File upload/download with Supabase Storage
- `app/api/medications.py` - Medications/allergies CRUD

### Frontend Pages
- `app/dashboard/application/[id]/page.tsx` - Application wizard
- `app/admin/applications/page.tsx` - Admin review
- `app/super-admin/` - Super admin panel (application-builder, users, etc.)

### Frontend State
- `lib/contexts/AuthContext.tsx` - Auth state
- Components use `react-hook-form` + Zod validation
- Some state with Zustand

---

## Multi-Team Approval Workflow

Three teams must approve before an application can be accepted:
1. Operations
2. Medical
3. Behavioral Health

Each has separate approval endpoint in `app/api/admin.py`. Records `{team}_approved_by` and `{team}_approved_at` timestamps.

---

## File Upload Architecture

1. Frontend uploads via multipart/form-data to `/api/applications/{id}/files`
2. Backend validates size/type, stores in Supabase Storage
3. Metadata saved in `files` table with `storage_path`
4. Download uses pre-signed URLs (1-year expiration)
5. **Batch loading**: Wizard loads all file metadata at once, fetches signed URLs in parallel

---

## Environment Variables

### Frontend (.env.local)
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### Backend (.env)
```
SUPABASE_URL=
SUPABASE_KEY=              # Service role key (private)
DATABASE_URL=
JWT_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
ALLOWED_ORIGINS=           # Comma-separated CORS origins
```

---

## Adding New Features

### New API Endpoint
1. Add route function in `backend/app/api/*.py`
2. Use appropriate auth dependency: `current_user: User = Depends(get_current_user)`
3. Return Pydantic schema for type safety
4. Register router in `app/main.py` if new file

### New Frontend Page
1. Create directory in `frontend/app/` with `page.tsx`
2. Import API functions from `lib/api-*.ts`
3. Use shadcn/ui components for UI consistency

### Database Migration
1. Create SQL file in `supabase/migrations/` with numeric prefix (e.g., `014_feature_name.sql`)
2. Run with `supabase migration up` or `node run-migration.js`

---

## Remaining Work

See `TODO.md` for the complete, up-to-date task list.

**Key remaining areas:**
- Stripe payment integration (invoices, scholarships, payment tracking)
- User settings UI (profile management)
- Email template fixes and testing
- Super admin settings cleanup
- Production domain setup (api.fasdcamp.org, app.fasdcamp.org)

**Recently completed:**
- Supabase Auth integration (Email/Password + Google OAuth)
- Super Admin backend APIs (fully implemented)
- Email system backend (fully implemented)
- Custom SMTP with Resend for branded emails

---

## Deployment

**Target**: Vercel Pro (frontend and backend as separate projects)

See `VERCEL_DEPLOYMENT.md` for complete instructions.

Key constraints:
- 60s timeout, 4.5MB request body limit
- Backend uses `@vercel/python` runtime (see `backend/vercel.json`)

---

## Brand Colors

- Forest Green: `#316429`
- Orange: `#e26e15`
- White: `#ffffff`
- Charcoal: `#202020`
