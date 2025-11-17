# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CAMP FASD Camper Application Portal is a full-stack web application for managing camper registrations. It consists of:
- **Frontend**: Next.js 14 with TypeScript, TailwindCSS, and shadcn/ui components
- **Backend**: FastAPI (Python 3.11+) with PostgreSQL via Supabase
- **Key Integrations**: Supabase (Auth + Storage), Stripe (Payments - TODO), SendGrid (Email - TODO)

---

## Current Project Status

**Last Updated**: November 2025

### Completed Features (100% Working)

#### Core Application System
- Dynamic multi-step application wizard with autosave every 3 seconds
- 11 question types: text, textarea, dropdown, multiple_choice, file_upload, profile_picture, checkbox, date, email, phone, signature
- Conditional question logic (show question if previous answer matches condition)
- Smart completion percentage calculation that respects conditional requirements
- File uploads to Supabase Storage with signed URLs (batch loading optimization - 1-year expiration)
- Template file attachments for downloadable forms (e.g., doctor's forms)
- Detail prompts with multiple trigger answers (JSONB array storage)

#### Admin Features
- Multi-team approval workflow (Operations, Medical, Behavioral Health)
- Application status flow: `in_progress` → `under_review` → `accepted` → `paid`
- Admin notes and file viewing
- Per-team approval tracking with timestamps
- Progress sidebar showing section completion

#### Super Admin Panel (/super-admin)
- **Application Builder** - Full CRUD for sections and questions (FULLY WORKING)
- **User Management UI** - View/edit users (mock data, needs backend API)
- **Teams Management UI** - Configure teams (mock data, needs backend API)
- **System Settings UI** - Configure app settings (mock data, needs backend API)
- **Email Templates UI** - Create/edit templates (mock data, needs backend API)
- **Audit Logs UI** - View system events (mock data, needs backend API)

#### Medications & Allergies System
- Separate `camper_medications` and `camper_allergies` tables
- "Add More" button pattern for multiple entries
- Dedicated API endpoints for CRUD operations

#### Authentication
- Supabase Auth for user management
- Google OAuth backend configured (`backend/app/api/auth_google.py`)
- JWT token validation
- Role-based access control (user, admin, super_admin)

---

## Next Steps (Priority Order)

### IMMEDIATE: Vercel Deployment

**See [VERCEL_DEPLOYMENT.md](VERCEL_DEPLOYMENT.md) for complete deployment guide.**

Backend configuration files already created:
- `backend/vercel.json` - Vercel Python runtime config
- `backend/.vercelignore` - Excludes dev files from deployment

Key steps:
1. Create TWO Vercel projects (backend + frontend)
2. Set environment variables in Vercel dashboard
3. Update CORS origins after deployment
4. Consider lowering `MAX_FILE_SIZE` to 4MB due to Vercel's 4.5MB request body limit

### Phase 6: Payments & Notifications (NEXT FEATURES)

1. **Email Notification System** (5-8 hours)
   - Create `email_templates` and `email_logs` tables
   - Build SendGrid integration service
   - Implement triggers: submission, acceptance, payment receipt
   - Connect super admin Email Templates UI to backend

2. **Stripe Payment Integration** (8-12 hours)
   - Invoice generation on application acceptance
   - Stripe checkout flow for families
   - Webhook handler for payment confirmation
   - Update application status to `paid` after successful payment

3. **Super Admin Backend APIs** (8-10 hours)
   - User management endpoints (CRUD, role assignment, team assignment)
   - System configuration table and endpoints
   - Audit log collection and querying
   - Connect existing super admin UIs to real data

4. **Google OAuth Frontend** (2-3 hours)
   - Install `@react-oauth/google` package
   - Add Google Sign-In button to login page
   - Wrap app with GoogleOAuthProvider
   - Backend already handles @fasdcamp.org domain restriction

---

## Essential Development Commands

### Frontend (Next.js)
```bash
cd frontend
npm install                    # Install dependencies
npm run dev                    # Start dev server (http://localhost:3000)
npm run build                  # Production build
npm run lint                   # Run ESLint
npm run type-check             # TypeScript type checking
```

### Backend (FastAPI)
```bash
cd backend
python -m venv .venv           # Create virtual environment
source .venv/bin/activate      # Activate venv (Windows: .venv\Scripts\activate)
pip install -r requirements.txt  # Install dependencies
uvicorn app.main:app --reload  # Start dev server (http://localhost:8000)
pytest                         # Run tests
black .                        # Format code
```

### Database
```bash
# Direct PostgreSQL access
PGPASSWORD='$Recrem0509' psql "postgresql://postgres@db.mtxjtriqduylfakqeiod.supabase.co:5432/postgres"

# Run migrations
cd supabase && supabase migration up
# OR
node run-migration.js          # Custom migration runner
```

---

## Architecture Key Points

### Dual Repository Structure
This is a **monorepo** with two distinct applications:
- `frontend/` - Independent Next.js app
- `backend/` - Independent FastAPI app
- Both have separate dependencies and can be deployed separately

### Application Status Flow
```
in_progress (< 100%)
  → under_review (auto-transition at 100% complete)
  → [3 approvals from 3 teams]
  → Accept button ENABLED
  → accepted (admin clicks Accept)
  → [new conditional sections may appear]
  → paid (after Stripe payment - TODO)
```

### Key Database Tables

```sql
-- Core application data
applications (id, user_id, status, completion_percentage, submitted_at, ...)
application_sections (id, title, description, order_index, is_active, show_when_status)
application_questions (
  id, section_id, question_text, question_type, is_required,
  validation_rules, options, template_file_id,
  show_if_question_id, show_if_answer,  -- Conditional logic
  detail_prompt_trigger, detail_prompt_text  -- Follow-up prompts
)
application_responses (id, application_id, question_id, response_value, file_id)

-- Medical data (separate tables for better querying)
camper_medications (id, application_id, medication_name, dosage, frequency, ...)
camper_allergies (id, application_id, allergy_name, reaction, severity, ...)

-- User management
users (id, email, password_hash, google_id, role, team, first_name, last_name, ...)

-- File storage metadata
files (id, application_id, question_id, file_name, file_type, file_size, storage_path, ...)
```

### Authentication Flow
1. Frontend uses Supabase Auth for client-side auth
2. Backend validates JWTs in `app/core/deps.py` (`get_current_user` dependency)
3. Google OAuth: `@react-oauth/google` → `app/api/auth_google.py`
4. RBAC: `user`, `admin`, `super_admin` roles enforced via dependencies

### Database Interaction
- **Direct SQL queries** with `psycopg2` (NOT SQLAlchemy ORM)
- Parameterized statements for SQL injection prevention
- Connection via `app/core/database.py`

### File Upload Architecture
- Upload through FastAPI → Supabase Storage
- Metadata in `files` table with `storage_path`
- **Batch loading**: Wizard loads all file metadata at once, downloads signed URLs in parallel
- 1-year signed URL expiration
- Validation: size limits, allowed types (PDF, DOC, DOCX, JPG, PNG)

---

## Critical Backend Files

### Core Configuration
- `app/main.py` - FastAPI app, CORS, router registration
- `app/core/config.py` - Pydantic settings from environment
- `app/core/deps.py` - Auth dependencies, role checking
- `app/core/security.py` - JWT validation, password hashing
- `app/core/database.py` - Database connection

### API Routes (`app/api/`)
- `auth.py` - Email/password authentication
- `auth_google.py` - Google OAuth flow
- `applications.py` - Application CRUD, progress tracking, autosave
- `files.py` - File upload/download with Supabase Storage
- `admin.py` - Review, approval, notes, cabin assignment
- `application_builder.py` - Super admin form builder
- `medications.py` - Medications and allergies CRUD
- `super_admin.py` - User management, system config

---

## Critical Frontend Files

### App Router Structure
- `app/page.tsx` - Landing page
- `app/login/` - Login page
- `app/register/` - Registration
- `app/dashboard/` - User dashboard, application wizard
- `app/admin/` - Admin application review
- `app/super-admin/` - Super admin panel

### API Client Files (`frontend/lib/`)
- `api.ts` - Base configuration and auth headers
- `api-applications.ts` - Application CRUD
- `api-admin.ts` - Admin endpoints
- `api-application-builder.ts` - Form builder
- `api-medications.ts` - Medications/allergies
- `api-files.ts` - File operations

### UI Components
- `frontend/components/` - shadcn/ui components (Radix + Tailwind)
- Form handling: `react-hook-form` + Zod validation
- State management: React Context + Hooks, some Zustand

---

## Environment Variables

### Frontend (.env.local)
```bash
NEXT_PUBLIC_SUPABASE_URL=         # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=    # Supabase anon public key
NEXT_PUBLIC_API_URL=              # Backend API URL (http://localhost:8000)
```

### Backend (.env)
```bash
SUPABASE_URL=                     # Supabase project URL
SUPABASE_KEY=                     # Supabase service role key (private)
DATABASE_URL=                     # PostgreSQL connection string
JWT_SECRET=                       # JWT signing secret (32+ chars)
GOOGLE_CLIENT_ID=                 # Google OAuth client ID
GOOGLE_CLIENT_SECRET=             # Google OAuth client secret
ALLOWED_ORIGINS=                  # Comma-separated CORS origins
STRIPE_SECRET_KEY=                # Stripe secret key (TODO)
STRIPE_WEBHOOK_SECRET=            # Stripe webhook secret (TODO)
SENDGRID_API_KEY=                 # SendGrid API key (TODO)
SENDGRID_FROM_EMAIL=              # Sender email address (TODO)
```

---

## Important Workflows

### Application Lifecycle
1. User registers → creates account in `users` table
2. User starts application → creates `applications` record with `status='in_progress'`
3. User fills form → autosave every 3s updates `application_responses`
4. 100% complete → auto-transitions to `status='under_review'`
5. Admins review → each team (Ops, Medical, Behavioral) approves separately
6. All 3 approved → `status='accepted'` (admin clicks Accept button)
7. New conditional sections may appear (e.g., "show after acceptance")
8. Payment received → `status='paid'` (TODO: Stripe integration)

### Dynamic Form Rendering
1. Super admin configures sections/questions in Application Builder
2. Frontend fetches from `/api/application-builder/sections`
3. `question_type` determines UI component
4. `show_when_status` controls visibility (e.g., only after acceptance)
5. `show_if_question_id` + `show_if_answer` for conditional logic
6. Responses saved to `application_responses` table

### File Upload Flow
1. Frontend uploads via `/api/applications/{id}/files` (multipart/form-data)
2. Backend validates (size, type, ownership)
3. File stored in Supabase Storage bucket
4. Metadata saved in `files` table
5. Download uses pre-signed URL (1-year expiration)

### Multi-Team Approval
- Teams: Operations, Medical, Behavioral Health
- Each has separate endpoint in `app/api/admin.py`
- Application only "accepted" when ALL teams approve
- Records `{team}_approved_by` and `{team}_approved_at`

---

## Common Development Patterns

### Adding a New API Endpoint
1. Add route function in `app/api/*.py`
2. Use `@router.get/post/put/delete` decorator
3. Add `current_user: User = Depends(get_current_user)` for auth
4. Return Pydantic schema for type safety
5. Register router in `app/main.py` if new file

### Adding a New Frontend Page
1. Create directory in `app/` with `page.tsx`
2. Use App Router conventions (layout.tsx for shared layout)
3. Import API functions from `lib/api-*.ts`
4. Use shadcn/ui components for consistency
5. Handle loading/error states

### Database Migrations
1. Create SQL file in `supabase/migrations/` with timestamp prefix
2. Include both UP and DOWN migrations
3. Test locally, then run with `supabase migration up`

---

## Deployment

**Target Platform**: Vercel Pro (both frontend and backend)

### Configuration Files
- `backend/vercel.json` - Python serverless function config
- `backend/.vercelignore` - Excludes dev files
- `VERCEL_DEPLOYMENT.md` - Complete deployment guide

### Important Vercel Constraints
- **60s timeout** (Pro plan) - sufficient for most operations
- **4.5MB request body limit** - may need to lower file upload max to 4MB
- **Cold starts** (2-5 seconds after idle)
- **No background tasks** - email sending must be synchronous

---

## Technical Debt / TODOs

1. **Super Admin Backend APIs** - UI built, needs backend integration for:
   - User management CRUD
   - Team management CRUD
   - System configuration storage
   - Email template storage
   - Audit log collection

2. **Google OAuth Frontend** - Backend ready, frontend needs:
   - Install `@react-oauth/google`
   - Add Google Sign-In button
   - Wrap app with GoogleOAuthProvider

3. **Email System** - Not implemented yet

4. **Payment System** - Not implemented yet

5. **Headers in Application Builder** - Requested feature to add visual headers between questions (not yet implemented)

---

## Brand Guidelines

- **Colors**: Forest Green `#316429`, Orange `#e26e15`, White `#ffffff`, Charcoal `#202020`
- **Typography**: Tailwind default font stack
- **Accessibility**: WCAG 2.1 AA compliance target

---

## Key Files to Reference

### Application Builder
- `backend/app/api/application_builder.py`
- `frontend/app/super-admin/application-builder/page.tsx`
- `frontend/lib/api-application-builder.ts`

### Application Wizard
- `backend/app/api/applications.py`
- `frontend/app/dashboard/application/[id]/page.tsx`
- `frontend/lib/api-applications.ts`

### Admin Features
- `backend/app/api/admin.py`
- `frontend/app/admin/applications/page.tsx`
- `frontend/lib/api-admin.ts`

### Authentication
- `backend/app/api/auth_google.py`
- `backend/app/core/deps.py`
- `frontend/lib/contexts/AuthContext.tsx`
