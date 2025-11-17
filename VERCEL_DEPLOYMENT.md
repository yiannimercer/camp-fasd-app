# CAMP FASD - Vercel Deployment Guide

Deploy both your FastAPI backend and Next.js frontend to Vercel.

## Prerequisites

- Vercel Pro account (you have this)
- Git repository pushed to GitHub
- Supabase project configured
- Stripe account with API keys
- SendGrid account with verified sender

---

## Step 1: Deploy Backend (FastAPI)

### 1.1 Create New Vercel Project

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click **"Add New..."** → **"Project"**
3. Import your GitHub repository
4. **Configure Project Settings**:
   - **Root Directory**: `backend`
   - **Framework Preset**: `Other`
   - **Build Command**: Leave empty
   - **Output Directory**: Leave empty
   - **Install Command**: `pip install -r requirements.txt`

### 1.2 Add Environment Variables

In Vercel Project Settings → Environment Variables, add:

| Variable | Value | Notes |
|----------|-------|-------|
| `JWT_SECRET` | `your-secure-random-string-32+ chars` | Generate with `openssl rand -hex 32` |
| `DATABASE_URL` | `postgresql://...` | Your Supabase PostgreSQL connection string |
| `SUPABASE_URL` | `https://xxx.supabase.co` | From Supabase dashboard |
| `SUPABASE_KEY` | `your-service-role-key` | Service role key (not anon key) |
| `GOOGLE_CLIENT_ID` | `xxx.apps.googleusercontent.com` | From Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | `your-google-secret` | From Google Cloud Console |
| `GOOGLE_REDIRECT_URI` | `https://your-frontend.vercel.app/auth/callback/google` | Update after frontend deploy |
| `STRIPE_SECRET_KEY` | `sk_live_xxx` | From Stripe Dashboard |
| `STRIPE_PUBLISHABLE_KEY` | `pk_live_xxx` | From Stripe Dashboard |
| `STRIPE_WEBHOOK_SECRET` | `whsec_xxx` | From Stripe Webhooks |
| `SENDGRID_API_KEY` | `SG.xxx` | From SendGrid |
| `SENDGRID_FROM_EMAIL` | `noreply@campfasd.org` | Must be verified in SendGrid |
| `ALLOWED_ORIGINS` | `https://your-frontend.vercel.app` | Update after frontend deploy |

### 1.3 Deploy

Click **"Deploy"** and wait for build to complete.

Your API URL will be: `https://your-backend-project.vercel.app`

### 1.4 Verify Deployment

Visit these URLs:
- `https://your-backend.vercel.app/` - Should return health check JSON
- `https://your-backend.vercel.app/api/docs` - Swagger documentation

---

## Step 2: Deploy Frontend (Next.js)

### 2.1 Create New Vercel Project

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click **"Add New..."** → **"Project"**
3. Import the **same** GitHub repository
4. **Configure Project Settings**:
   - **Root Directory**: `frontend`
   - **Framework Preset**: `Next.js` (auto-detected)
   - **Build Command**: `npm run build`
   - **Output Directory**: `.next`
   - **Install Command**: `npm install`

### 2.2 Add Environment Variables

| Variable | Value | Notes |
|----------|-------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxx.supabase.co` | From Supabase dashboard |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `your-anon-key` | Anon key (not service role) |
| `NEXT_PUBLIC_API_URL` | `https://your-backend.vercel.app` | Your backend URL from Step 1 |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `pk_live_xxx` | Stripe publishable key |

### 2.3 Deploy

Click **"Deploy"** and wait for build.

Your frontend URL: `https://your-frontend-project.vercel.app`

---

## Step 3: Connect Everything

### 3.1 Update Backend CORS

Go back to your **backend** project's Environment Variables and update:

```
ALLOWED_ORIGINS=https://your-frontend-project.vercel.app
```

Then **redeploy** the backend.

### 3.2 Update Google OAuth

In Google Cloud Console → Credentials:
1. Add **Authorized redirect URI**: `https://your-frontend.vercel.app/auth/callback/google`
2. Update backend's `GOOGLE_REDIRECT_URI` to match

### 3.3 Update Stripe Webhook

In Stripe Dashboard → Webhooks:
1. Add endpoint: `https://your-backend.vercel.app/api/webhooks/stripe`
2. Update backend's `STRIPE_WEBHOOK_SECRET` with new signing secret

---

## Step 4: Custom Domains (Optional)

### Backend API Domain
1. Backend Project → Settings → Domains
2. Add `api.campfasd.org`
3. Update DNS CNAME record
4. Update frontend's `NEXT_PUBLIC_API_URL`
5. Update backend's `ALLOWED_ORIGINS` to include frontend domain

### Frontend Domain
1. Frontend Project → Settings → Domains
2. Add `apply.campfasd.org` or `campfasd.org`
3. Update DNS records as instructed

---

## Configuration Files Created

### backend/vercel.json
```json
{
  "builds": [
    {
      "src": "app/main.py",
      "use": "@vercel/python"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "app/main.py"
    }
  ]
}
```

### backend/.vercelignore
Excludes development files, tests, virtual environments to keep deployment size small.

---

## Important Vercel Pro Limits

✅ **60 second timeout** - Most operations will complete in time
✅ **250MB package size** - Your backend is ~30MB with dependencies
✅ **Automatic scaling** - Handles traffic spikes
⚠️ **Cold starts** - First request after idle may take 2-5 seconds
⚠️ **4.5MB request body** - File uploads need to go direct to Supabase

---

## File Upload Consideration

Your current setup sends files through FastAPI to Supabase. This works but is limited to 4.5MB per request.

**Option A: Keep as-is**
- Works for files under 4.5MB
- Your 10MB limit in config won't be reachable
- May need to lower `MAX_FILE_SIZE` to 4MB

**Option B: Direct-to-Supabase uploads (recommended for production)**
- Frontend uploads directly to Supabase Storage
- API only registers metadata (file_id, path, size)
- No size limit
- Better performance

For now, proceed with Option A. You can implement Option B later if needed.

---

## Troubleshooting

### Build Fails
- Check `requirements.txt` for incompatible packages
- Review build logs in Vercel dashboard
- Ensure all required environment variables are set

### 500 Errors on API
- Check Function Logs in Vercel dashboard
- Verify environment variables are set correctly
- Check database connection string

### CORS Errors
- Verify `ALLOWED_ORIGINS` includes your frontend URL
- Must match exactly (with https://, no trailing slash)
- Redeploy backend after changing

### Slow First Request
- Normal for serverless (cold start)
- Consider implementing loading states
- Warm up critical endpoints with scheduled calls

### Database Connection Issues
- Ensure Supabase allows connections from Vercel IPs
- In Supabase: Settings → Database → Connection Pooling may help
- Check if pooler connection string is needed

---

## Monitoring

Vercel provides:
- **Function Logs**: Real-time logs for each request
- **Analytics**: Request counts, response times, errors
- **Deployments**: Preview deployments for PRs

Access via: Project Dashboard → Analytics/Logs

---

## Cost Estimate (Vercel Pro)

- Base Pro plan: $20/month per member
- Function invocations: Included up to limits
- Bandwidth: 1TB included
- Build minutes: 1000/month included

Your app's autosave (every 3 seconds per user) will be your highest invocation cost. Monitor usage in Vercel dashboard.

---

## Next Steps After Deployment

1. ✅ Verify health check endpoints
2. ✅ Test user registration
3. ✅ Test Google OAuth login
4. ✅ Test application form saves
5. ✅ Test file uploads (keep under 4MB initially)
6. ✅ Test admin dashboard
7. ✅ Set up custom domains
8. ✅ Configure monitoring/alerts
9. ⏳ Continue Phase 6 (Payments & Notifications)

---

## Commit These Files

```bash
git add backend/vercel.json
git add backend/.vercelignore
git add VERCEL_DEPLOYMENT.md
git commit -m "Add Vercel deployment configuration for FastAPI backend"
git push
```

Then import projects in Vercel as described above.
