# CAMP FASD Camper Application Portal

A modern, secure web application for managing camper applications for CAMP – A FASD Community.

## Overview

This application streamlines the camper registration process with role-based access for families, administrators, and super admins. It includes multi-step application forms, file management, payment processing, and comprehensive admin tools.

## Tech Stack

### Frontend
- **Framework**: Next.js 14 (React)
- **Styling**: TailwindCSS
- **State Management**: React Context + Hooks
- **Forms**: React Hook Form + Zod validation
- **UI Components**: shadcn/ui
- **Authentication**: Supabase Auth

### Backend
- **Framework**: FastAPI (Python 3.11+)
- **Database**: PostgreSQL via Supabase
- **Authentication**: JWT + Supabase Auth
- **File Storage**: Supabase Storage
- **Payments**: Stripe (TODO)
- **Email**: SendGrid (TODO)
- **API Documentation**: OpenAPI/Swagger (auto-generated)

### Infrastructure
- **Database**: Supabase (PostgreSQL)
- **Storage**: Supabase Storage
- **Hosting**: Vercel Pro (both frontend and backend)

## Documentation

- **[CLAUDE.md](CLAUDE.md)** - Comprehensive development guide with current status, architecture, and next steps
- **[VERCEL_DEPLOYMENT.md](VERCEL_DEPLOYMENT.md)** - Complete Vercel deployment instructions for both frontend and backend

## Brand Colors

- **Forest Green**: `#316429`
- **Orange**: `#e26e15`
- **White**: `#ffffff`
- **Charcoal**: `#202020`

## Project Structure

```
camp-fasd-app/
├── frontend/                 # Next.js application
│   ├── app/                 # App router pages
│   ├── components/          # React components
│   ├── lib/                # Utilities and configurations
│   ├── hooks/              # Custom React hooks
│   ├── styles/             # Global styles
│   └── public/             # Static assets
├── backend/                 # FastAPI application
│   ├── app/
│   │   ├── api/            # API routes
│   │   ├── core/           # Core configurations
│   │   ├── models/         # Database models
│   │   ├── schemas/        # Pydantic schemas
│   │   ├── services/       # Business logic
│   │   └── utils/          # Utility functions
│   ├── migrations/         # Database migrations
│   └── tests/              # Backend tests
├── supabase/               # Supabase configurations
│   ├── migrations/         # SQL migrations
│   └── seed.sql           # Seed data
└── docs/                   # Documentation
```

## Key Features

### User Roles
- **User (Family)**: Submit and manage camper applications
- **Admin**: Review applications (Ops, Behavioral Health, Medical teams)
- **Super Admin**: Configure system settings, manage users, reset applications

### Application Flow
1. Family creates account and starts application
2. Multi-step wizard with autosave and progress tracking
3. File uploads for medical records, IEP, insurance, etc.
4. Automatic email reminders based on completion percentage
5. Admin teams review and approve/decline applications
6. Upon acceptance: Stripe invoice generated and sent
7. Payment confirmation triggers final status update

### Admin Dashboard
- View all applications with filtering by status, cabin assignment
- Review uploaded files and application details
- Leave internal notes visible to other admins
- Three-team approval workflow (Ops, Behavioral, Medical)
- Track returning vs new campers

### Super Admin Tools
- **Application Builder**: Dynamically create, edit, and delete application sections and questions
- **Question Configuration**: Support for 10+ question types (text, dropdown, multiple choice, file upload, signature, etc.)
- **Conditional Visibility**: Control when sections/questions appear (always, after acceptance, after payment)
- **Template Files**: Attach downloadable template files to questions (e.g., doctor forms)
- **Teams Management**: Create and manage teams with granular permissions
- **User Management**: View, edit, suspend users, assign roles and teams
- **System Settings**: Configure application window, email notifications, file upload limits, security policies
- **Email Templates**: Create and edit email templates with variable insertion
- **Audit Logs**: View system activity with filtering and CSV export
- **Dashboard**: Overview of system stats, recent activity, and quick actions

## Application Sections

1. Overview
2. Camper Information
3. Applicant Background
4. FASD Screener
5. Medical History
6. Medical Details (daily medications)
7. Insurance (file upload)
8. Healthcare Providers
9. IEP (file upload)
10. COVID-19 Acknowledgment (file upload)
11. Medical History Form (download & upload)
12. Immunizations (file upload)
13. Letter to My Counselor (download & upload)
14. Authorizations (e-signature)
15. Additional Camper Information
16. Emergency Contact Information
17. Authorization Release

## Getting Started

### Prerequisites
- Node.js 18+
- Python 3.11+
- PostgreSQL (via Supabase)
- Supabase account
- Stripe account
- SendGrid account

### Environment Variables

Create `.env.local` in the `frontend/` directory:
```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_API_URL=http://localhost:8000
```

Create `.env` in the `backend/` directory:
```bash
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_service_role_key
DATABASE_URL=your_postgres_connection_string
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret
SENDGRID_API_KEY=your_sendgrid_api_key
SENDGRID_FROM_EMAIL=noreply@campfasd.org
JWT_SECRET=your_jwt_secret
GOOGLE_CLIENT_ID=your_google_oauth_client_id
GOOGLE_CLIENT_SECRET=your_google_oauth_client_secret
```

### Installation

#### Frontend
```bash
cd frontend
npm install
npm run dev
```

#### Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### Database Setup

```bash
# Run migrations
cd supabase
supabase migration up

# Seed initial data (super admin, question templates)
psql $DATABASE_URL < seed.sql
```

## Development

### Running Tests
```bash
# Frontend
cd frontend
npm test

# Backend
cd backend
pytest
```

### Code Style
- Frontend: ESLint + Prettier
- Backend: Black + isort + flake8

## Security Features

- JWT-based authentication
- Role-based access control (RBAC)
- Encrypted storage for sensitive fields
- File access control per user
- HTTPS only in production
- CSRF protection
- Rate limiting on API endpoints
- Input validation and sanitization

## Accessibility

- WCAG 2.1 AA compliant
- Keyboard navigation support
- Screen reader friendly
- High contrast mode support
- Mobile-first responsive design

## Deployment

**Target**: Vercel Pro (both frontend and backend)

See [VERCEL_DEPLOYMENT.md](VERCEL_DEPLOYMENT.md) for complete deployment instructions.

Quick overview:
1. Create TWO Vercel projects (backend + frontend)
2. Configure environment variables in Vercel dashboard
3. Backend uses `@vercel/python` runtime (serverless functions)
4. Frontend uses standard Next.js deployment

**Important Vercel constraints:**
- 60s timeout (Pro plan)
- 4.5MB request body limit (affects file uploads)

## Future Enhancements (Stretch Features)

- Electronic Medical Record (EMR) for medication tracking
- "At CAMP Dashboard" with real-time camper information
- In-app chat between families and admins
- AI-assisted form filling based on previous year
- PDF export of completed applications

## Support

For issues or questions, contact: [camp@fasdcamp.org](mailto:camp@fasdcamp.org)

## License

Proprietary - CAMP – A FASD Community
