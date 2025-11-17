# Complete Branch Environment & Custom Domain Setup

## Phase 1: Create Git Branch Structure

### Step 1: Create dev branch locally
```bash
git checkout -b dev
git push -u origin dev
```
This creates a new `dev` branch from your current `master` and pushes it to GitHub.

---

## Phase 2: Configure Vercel Branch Deployments

### Step 2: Backend - Set Production Branch to `dev` (temporarily)
1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click on **camp-fasd-backend** project
3. Go to **Settings** → **Git**
4. Find **"Production Branch"**
5. Change from `master` to `dev`
6. Click **Save**

*Why: This makes the `dev` branch deploy to Production environment where you'll add the custom domain*

### Step 3: Frontend - Set Production Branch to `dev` (temporarily)
1. Click on **camp-fasd-frontend** project
2. Go to **Settings** → **Git**
3. Change **Production Branch** to `dev`
4. Click **Save**

---

## Phase 3: Add Custom Domains in Vercel

### Step 4: Backend - Add api-dev.fasdcamp.org
1. In **camp-fasd-backend** project
2. Go to **Settings** → **Domains**
3. Click **Add**
4. Enter: `api-dev.fasdcamp.org`
5. Click **Add**
6. **Important**: Vercel will show you DNS configuration instructions - **copy these down**:
   - Type: `CNAME`
   - Name: `api-dev`
   - Value: `cname.vercel-dns.com.` (or similar)

### Step 5: Frontend - Add app-dev.fasdcamp.org
1. In **camp-fasd-frontend** project
2. Go to **Settings** → **Domains**
3. Click **Add**
4. Enter: `app-dev.fasdcamp.org`
5. Click **Add**
6. Copy DNS configuration:
   - Type: `CNAME`
   - Name: `app-dev`
   - Value: `cname.vercel-dns.com.`

---

## Phase 4: Configure DNS in Squarespace

### Step 6: Access Squarespace DNS Settings
1. Log into [Squarespace](https://www.squarespace.com)
2. Go to **Settings** → **Domains**
3. Click on `fasdcamp.org`
4. Click **Advanced Settings** → **DNS Settings**

### Step 7: Remove Old Railway DNS Records
1. Find any CNAME or A records pointing to Railway (likely `*.railway.app` or Railway IP addresses)
2. **Delete these old records** by clicking the trash icon next to each

### Step 8: Add Backend DNS Record
1. Click **Add Record**
2. **Record Type**: `CNAME`
3. **Host**: `api-dev`
4. **Data/Value**: `cname.vercel-dns.com` (exact value from Vercel Step 4)
5. **TTL**: Leave default (usually 3600 or Automatic)
6. Click **Save**

### Step 9: Add Frontend DNS Record
1. Click **Add Record**
2. **Record Type**: `CNAME`
3. **Host**: `app-dev`
4. **Data/Value**: `cname.vercel-dns.com` (exact value from Vercel Step 5)
5. **TTL**: Leave default
6. Click **Save**

### Step 10: Wait for DNS Propagation
- DNS changes can take **15 minutes to 48 hours** (usually ~30 minutes)
- Check status in Vercel dashboard - it will show "Valid Configuration" when ready
- Vercel automatically provisions SSL certificates

---

## Phase 5: Update Environment Variables

### Step 11: Backend - Update ALLOWED_ORIGINS
1. In Vercel, go to **camp-fasd-backend** → **Settings** → **Environment Variables**
2. Find `ALLOWED_ORIGINS`
3. Click the **three dots (⋯)** → **Edit**
4. Change value to: `https://app-dev.fasdcamp.org`
5. Ensure it's scoped to **All Environments** (or at least Production)
6. Click **Save**

### Step 12: Frontend - Update NEXT_PUBLIC_API_URL
1. In Vercel, go to **camp-fasd-frontend** → **Settings** → **Environment Variables**
2. Find `NEXT_PUBLIC_API_URL`
3. Click **Edit**
4. Change value to: `https://api-dev.fasdcamp.org`
5. Click **Save**

---

## Phase 6: Redeploy Both Projects

### Step 13: Redeploy Backend
1. In **camp-fasd-backend**, go to **Deployments**
2. Find the latest deployment
3. Click **three dots (⋯)** → **Redeploy**
4. Select **Production** environment
5. Click **Redeploy**
6. Wait for green checkmark

### Step 14: Redeploy Frontend
1. In **camp-fasd-frontend**, go to **Deployments**
2. Redeploy latest to **Production**
3. Wait for green checkmark

---

## Phase 7: Update Google OAuth (Required for login to work)

### Step 15: Update Authorized Redirect URIs
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Select your project
3. Go to **APIs & Services** → **Credentials**
4. Click on your OAuth 2.0 Client ID
5. Under **Authorized JavaScript origins**, add:
   - `https://app-dev.fasdcamp.org`
6. Under **Authorized redirect URIs**, add:
   - `https://app-dev.fasdcamp.org`
   - `https://app-dev.fasdcamp.org/auth/callback/google`
7. Click **Save**

### Step 16: Update Backend GOOGLE_REDIRECT_URI
1. In Vercel **camp-fasd-backend** → **Environment Variables**
2. Add new variable:
   - **Key**: `GOOGLE_REDIRECT_URI`
   - **Value**: `https://app-dev.fasdcamp.org/auth/callback/google`
3. Click **Save**
4. **Redeploy backend again** (Step 13)

---

## Phase 8: Test Dev Environment

### Step 17: Test Backend
1. Visit: `https://api-dev.fasdcamp.org`
2. Should see: `{"status":"healthy","service":"CAMP FASD Application Portal API","version":"1.0.0"}`

### Step 18: Test Frontend
1. Visit: `https://app-dev.fasdcamp.org`
2. Should see your landing page
3. Try logging in with Google OAuth
4. If CORS errors, verify ALLOWED_ORIGINS is correct

---

## Phase 9: Prepare for Production Environment (Future)

### Step 19: When Ready for Production
Later, when you want to set up production:
1. Create `master` as your production branch
2. Add domains `api.fasdcamp.org` and `app.fasdcamp.org`
3. Configure environment-specific variables in Vercel
4. Update Google OAuth with production URLs

---

## Summary Timeline

1. **5 min**: Create dev branch
2. **10 min**: Configure Vercel projects
3. **10 min**: Add domains in Vercel
4. **15 min**: Configure Squarespace DNS
5. **15-30 min**: Wait for DNS propagation
6. **10 min**: Update environment variables
7. **5 min**: Redeploy projects
8. **10 min**: Update Google OAuth
9. **10 min**: Test everything

**Total: ~1.5-2 hours** (mostly waiting for DNS)

---

## Important Notes

- **SSL**: Vercel automatically handles HTTPS certificates
- **DNS TTL**: If propagation is slow, be patient - it's a DNS thing, not Vercel
- **CORS**: Most common issue - always ensure ALLOWED_ORIGINS matches your frontend URL exactly
- **Environment scoping**: You can scope variables to specific environments (Production, Preview, Development) for different configs per branch later

---

## Progress Tracker

- [ ] **Phase 1**: Create dev branch
- [ ] **Phase 2**: Configure Vercel branch settings
- [ ] **Phase 3**: Add custom domains in Vercel
- [ ] **Phase 4**: Configure DNS in Squarespace
- [ ] **Phase 5**: Update environment variables
- [ ] **Phase 6**: Redeploy both projects
- [ ] **Phase 7**: Update Google OAuth
- [ ] **Phase 8**: Test dev environment
- [ ] **Phase 9**: Production setup (future)
