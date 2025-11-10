# HubSpot & Mapbox API Setup Guide

This guide will walk you through connecting your MSF Field Sales application to HubSpot and Mapbox.

## Part 1: HubSpot Integration Setup

### Step 1: Create a HubSpot Private App

1. **Log into HubSpot**
   - Go to your HubSpot account at https://app.hubspot.com/

2. **Navigate to Settings**
   - Click the **Settings** icon (⚙️) in the top navigation bar

3. **Access Private Apps**
   - In the left sidebar, go to: **Integrations** → **Private Apps**
   - Click **Create a private app**

4. **Configure Basic Info**
   - **Name:** `MSF Field Sales Integration` (or any name you prefer)
   - **Description:** `Field sales route planning and check-in tracking`
   - **Logo:** Optional - upload your company logo

5. **Configure Scopes (Critical Step)**
   
   Click on the **Scopes** tab and enable these permissions:

   **Required Scopes:**
   - ✅ `crm.objects.companies.read` - Read company data
   - ✅ `crm.objects.custom.read` - Read custom objects (for field visits)
   - ✅ `crm.objects.custom.write` - Write field visits to HubSpot
   
   **Recommended Scopes:**
   - ✅ `crm.objects.owners.read` - Map sales reps to HubSpot owners
   - ✅ `crm.schemas.custom.read` - Inspect custom object schemas

6. **Create the App**
   - Click **Create app** at the top right
   - Review the warning about API limits
   - Click **Continue creating**

7. **Copy Your Access Token**
   - You'll see a screen with your access token
   - **IMPORTANT:** Copy this token immediately - you can't see it again!
   - It will look like: `pat-na1-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`
   - Store it somewhere secure temporarily

### Step 2: Add HubSpot API Key to Your Environment

**For Local/Replit Development:**

1. In your project, look for the **Secrets** panel (🔒 lock icon in sidebar)
2. Click **Add Secret** or **Add new secret**
3. Enter:
   - **Key:** `HUBSPOT_API_KEY`
   - **Value:** Paste your Private App access token
4. Click **Add Secret** or **Save**

**For Production/GCP Deployment:**

Add as an environment variable:
```bash
HUBSPOT_API_KEY=pat-na1-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

### Step 3: Set Up Custom Object (Optional but Recommended)

For detailed instructions on creating the "Field Visits" custom object in HubSpot, see the file:
**`HUBSPOT_CUSTOM_OBJECT_SETUP.md`**

If you skip this step, the app will automatically fall back to creating Notes instead of custom object records.

---

## Part 2: Mapbox Integration Setup

### Step 1: Create a Mapbox Account

1. **Sign Up**
   - Go to https://account.mapbox.com/
   - Click **Sign up** (top right)
   - Create a free account (no credit card required!)

2. **Free Tier Benefits**
   - 100,000 geocoding requests per month
   - 50,000 map loads per month
   - More than enough for most field sales teams!

### Step 2: Get Your Access Token

1. **After signing in**, you'll be on the **Account** page
2. Look for the **Access tokens** section
3. You'll see a **Default public token** already created
   - It starts with `pk.` (public key)
   - Example: `pk.eyJ1IjoieW91cnVzZXJuYW1lIiwiYSI6ImNrXXXXXXXXXXXXXXXXXXX`

4. **Copy this token** - you'll need it in two places!

### Step 3: Create a New Token (Optional - More Secure)

If you want more control, create a dedicated token:

1. Click **Create a token**
2. **Token name:** `MSF Field Sales App`
3. **Scopes:** Keep all default scopes selected (they're all needed)
4. **URL restrictions:** Leave blank (or add your production domain later)
5. Click **Create token**
6. **Copy the token immediately** - you can't see it again!

### Step 4: Add Mapbox Tokens to Your Environment

**IMPORTANT:** You need to add the **same token twice** with different names!

**For Local/Replit Development:**

1. Open the **Secrets** panel (🔒)
2. Add **first secret:**
   - **Key:** `MAPBOX_TOKEN`
   - **Value:** Paste your Mapbox token
   - Click **Add Secret**

3. Add **second secret:**
   - **Key:** `VITE_MAPBOX_TOKEN`
   - **Value:** Paste the **same** Mapbox token
   - Click **Add Secret**

**Why twice?**
- `MAPBOX_TOKEN` - Used by server for geocoding
- `VITE_MAPBOX_TOKEN` - Used by browser for map display

**For Production/GCP Deployment:**

Add both as environment variables:
```bash
MAPBOX_TOKEN=pk.eyJ1IjoieW91cnVzZXJuYW1lIiwiYSI6ImNrXXXXXXXXXXXXXXXXXXX
VITE_MAPBOX_TOKEN=pk.eyJ1IjoieW91cnVzZXJuYW1lIiwiYSI6ImNrXXXXXXXXXXXXXXXXXXX
```

---

## Part 3: Verify the Integration

### After Adding All Secrets

1. **Restart your application** (if it doesn't auto-restart)
   - In Replit, the workflow should restart automatically
   - Locally, stop and restart `npm run dev`

2. **Check the logs** for success messages:
   ```
   ✅ Created demo user (username: demo, password: demo123)
   [Seed] ✅ Added 10 demo companies in Memphis, TN
   [Sync] Starting company sync (all companies)...
   [Sync] ✅ Synced X companies from HubSpot
   ```

3. **No more warnings:**
   - No "MAPBOX_TOKEN not set" warning
   - No "HUBSPOT_API_KEY not set" error

### Test the Integration

1. **Login to the app:**
   - Username: `demo`
   - Password: `demo123`

2. **Check if HubSpot companies appear:**
   - If the sync worked, you'll see your actual HubSpot companies
   - If not yet synced, wait 15 minutes for the first automatic sync
   - Or manually trigger: `POST /api/sync` endpoint

3. **Check if maps work:**
   - You should see an interactive Mapbox map
   - Companies should appear as pins on the map
   - You can zoom, pan, and interact with the map

---

## Complete Environment Variables Checklist

Make sure you have all of these configured:

### Required (Already Set by Replit)
- ✅ `DATABASE_URL` - PostgreSQL connection
- ✅ `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE` - Auto-set
- ✅ `SESSION_SECRET` - Session encryption

### You Need to Add
- ⏳ `HUBSPOT_API_KEY` - HubSpot Private App token
- ⏳ `MAPBOX_TOKEN` - Mapbox access token
- ⏳ `VITE_MAPBOX_TOKEN` - Same Mapbox token (for frontend)

### Optional
- `HUBSPOT_FIELD_VISIT_ASSOCIATION_TYPE_ID` - Custom object association
- `NODE_ENV` - Set to `production` when deploying

---

## Troubleshooting

### HubSpot Issues

**Error: "HUBSPOT_API_KEY not set"**
- Make sure you added the secret exactly as `HUBSPOT_API_KEY`
- No spaces before/after the key name or value
- Restart the application after adding

**Error: "401 Unauthorized"**
- Your API key is incorrect or expired
- Regenerate the Private App token in HubSpot
- Make sure you copied the full token (starts with `pat-`)

**Error: "403 Forbidden - Insufficient scopes"**
- Go back to your Private App settings
- Make sure all required scopes are checked
- Save the app (this won't change your token)

**No companies syncing**
- Check you have companies in your HubSpot account
- Wait 15 minutes for the first automatic sync
- Check server logs for specific errors

### Mapbox Issues

**Error: "MAPBOX_TOKEN not set"**
- Make sure you added **both** secrets: `MAPBOX_TOKEN` and `VITE_MAPBOX_TOKEN`
- They should have the **exact same value**
- Restart the application

**Maps not loading**
- Check browser console for errors
- Make sure token starts with `pk.`
- Verify you're on Mapbox free tier (not rate limited)

**Error: "401: Invalid token"**
- Token is incorrect or deleted
- Create a new token in Mapbox dashboard
- Update both environment variables

---

## Security Best Practices

### Never Commit Secrets to Git
```bash
# These should NEVER be in your code:
❌ const HUBSPOT_KEY = "pat-na1-xxxxx"  # BAD
❌ const MAPBOX_KEY = "pk.eyJ..."        # BAD

# Always use environment variables:
✅ process.env.HUBSPOT_API_KEY           # GOOD
✅ process.env.MAPBOX_TOKEN              # GOOD
```

### Rotate Keys Regularly
- HubSpot: Can regenerate in Private App settings
- Mapbox: Can delete and create new tokens
- Update your environment variables after rotation

### Use Production vs Development Tokens
- Consider using different Mapbox tokens for dev/prod
- HubSpot: Use test portal for development if possible

---

## Cost Monitoring

### HubSpot Private Apps
- **Free** with any HubSpot account
- Rate limit: 100 requests per 10 seconds
- Your app is well within limits (syncs every 15 minutes)

### Mapbox Free Tier
- **100,000** geocoding requests/month
- **50,000** map loads/month
- Current usage: ~1700 companies geocoded once, then cached
- Estimated monthly: <1,000 requests (well under limit)

**Check usage:**
- HubSpot: Settings → Integrations → Private Apps → View usage
- Mapbox: https://account.mapbox.com/ → Statistics

---

## Need Help?

### Documentation
- **HubSpot API:** https://developers.hubspot.com/docs/api/overview
- **Mapbox GL JS:** https://docs.mapbox.com/mapbox-gl-js/
- **Mapbox Geocoding:** https://docs.mapbox.com/api/search/geocoding/

### Project Files
- `HUBSPOT_CUSTOM_OBJECT_SETUP.md` - Custom object setup
- `SETUP_COMPLETE.md` - General setup guide
- `GCP_DEPLOYMENT_GUIDE.md` - Deployment instructions
- `replit.md` - Complete project documentation

### Support
- HubSpot: https://help.hubspot.com/
- Mapbox: https://support.mapbox.com/

---

**You're all set!** Once you add the API keys, your MSF Field Sales application will have full HubSpot integration and interactive maps! 🚀
