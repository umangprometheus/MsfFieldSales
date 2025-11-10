# GCP Deployment Guide for MSF Field Sales Application

This guide will help you deploy your MSF Field Sales application to Google Cloud Platform.

## Prerequisites

1. Google Cloud Platform account
2. `gcloud` CLI installed and configured
3. Your API keys (HubSpot, Mapbox) ready
4. Billing enabled on your GCP project

## Option 1: Cloud Run (Recommended - Serverless)

Cloud Run is ideal for this application because it:
- Auto-scales based on traffic (0 to N instances)
- Only charges when requests are being handled
- Handles SSL certificates automatically
- Supports custom domains

### Step 1: Set Up Cloud SQL (PostgreSQL)

```bash
# Create PostgreSQL instance
gcloud sql instances create msf-sales-db \
  --database-version=POSTGRES_15 \
  --tier=db-f1-micro \
  --region=us-central1

# Create database
gcloud sql databases create msf_sales \
  --instance=msf-sales-db

# Set postgres user password
gcloud sql users set-password postgres \
  --instance=msf-sales-db \
  --password=YOUR_SECURE_PASSWORD
```

### Step 2: Enable Required APIs

```bash
gcloud services enable \
  run.googleapis.com \
  sqladmin.googleapis.com \
  secretmanager.googleapis.com \
  cloudbuild.googleapis.com
```

### Step 3: Store Secrets in Secret Manager

```bash
# Store HubSpot API key
echo -n "YOUR_HUBSPOT_API_KEY" | gcloud secrets create hubspot-api-key --data-file=-

# Store Mapbox token
echo -n "YOUR_MAPBOX_TOKEN" | gcloud secrets create mapbox-token --data-file=-

# Store session secret
echo -n "$(openssl rand -hex 32)" | gcloud secrets create session-secret --data-file=-
```

### Step 4: Build and Deploy to Cloud Run

```bash
# Build the application
npm run build

# Deploy to Cloud Run with Cloud SQL connection
gcloud run deploy msf-field-sales \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --add-cloudsql-instances YOUR_PROJECT_ID:us-central1:msf-sales-db \
  --set-env-vars NODE_ENV=production \
  --set-secrets DATABASE_URL=database-url:latest,HUBSPOT_API_KEY=hubspot-api-key:latest,MAPBOX_TOKEN=mapbox-token:latest,VITE_MAPBOX_TOKEN=mapbox-token:latest,SESSION_SECRET=session-secret:latest
```

### Step 5: Get Database Connection String

For Cloud Run with Cloud SQL, use the Unix socket connection:

```
postgresql://postgres:YOUR_PASSWORD@/msf_sales?host=/cloudsql/YOUR_PROJECT_ID:us-central1:msf-sales-db
```

Store this as a secret:
```bash
echo -n "postgresql://postgres:YOUR_PASSWORD@/msf_sales?host=/cloudsql/YOUR_PROJECT_ID:us-central1:msf-sales-db" | \
  gcloud secrets create database-url --data-file=-
```

### Step 6: Run Database Migrations

After first deployment, run migrations:

```bash
# SSH into Cloud Run instance (or use Cloud Shell)
gcloud run services update-traffic msf-field-sales --to-latest

# Connect to the service and run migrations
gcloud run jobs create db-migration \
  --image gcr.io/YOUR_PROJECT_ID/msf-field-sales \
  --command npm \
  --args "run,db:push,--force" \
  --add-cloudsql-instances YOUR_PROJECT_ID:us-central1:msf-sales-db \
  --set-secrets DATABASE_URL=database-url:latest

gcloud run jobs execute db-migration
```

## Option 2: App Engine (Managed Platform)

App Engine provides a fully managed platform with automatic scaling.

### Step 1: Create `app.yaml`

Create an `app.yaml` file in your project root:

```yaml
runtime: nodejs20
env: standard
instance_class: F1

env_variables:
  NODE_ENV: production

automatic_scaling:
  target_cpu_utilization: 0.65
  min_instances: 0
  max_instances: 10
```

### Step 2: Deploy

```bash
# Deploy to App Engine
gcloud app deploy

# Run database migrations
gcloud app deploy --quiet && npm run db:push --force
```

## Option 3: Compute Engine (Full Control)

For maximum control, deploy to a VM instance.

### Step 1: Create VM Instance

```bash
gcloud compute instances create msf-sales-vm \
  --zone=us-central1-a \
  --machine-type=e2-micro \
  --image-family=ubuntu-2204-lts \
  --image-project=ubuntu-os-cloud \
  --boot-disk-size=10GB
```

### Step 2: SSH and Install Dependencies

```bash
gcloud compute ssh msf-sales-vm --zone=us-central1-a

# On the VM:
sudo apt update
sudo apt install -y nodejs npm postgresql-client
git clone YOUR_REPO_URL
cd msf-field-sales
npm install
npm run build
```

### Step 3: Set Up Environment Variables

```bash
# Create .env file (on VM)
cat > .env << EOF
DATABASE_URL=postgresql://postgres:PASSWORD@CLOUD_SQL_IP:5432/msf_sales
HUBSPOT_API_KEY=your-hubspot-key
MAPBOX_TOKEN=your-mapbox-token
VITE_MAPBOX_TOKEN=your-mapbox-token
SESSION_SECRET=$(openssl rand -hex 32)
NODE_ENV=production
EOF
```

### Step 4: Run with PM2 (Process Manager)

```bash
sudo npm install -g pm2
pm2 start dist/index.js --name msf-sales
pm2 startup
pm2 save
```

## Cost Estimation

### Cloud Run (Most Cost-Effective)
- **Cloud SQL (db-f1-micro)**: ~$7-10/month
- **Cloud Run**: Pay per request
  - First 2 million requests free
  - Then $0.40 per million requests
  - Typical cost: $5-15/month for small team
- **Secret Manager**: Free tier
- **Total**: ~$12-25/month

### App Engine
- **F1 Instance**: ~$30-50/month (always running)
- **Cloud SQL**: ~$7-10/month
- **Total**: ~$37-60/month

### Compute Engine
- **e2-micro**: ~$6-8/month
- **Cloud SQL**: ~$7-10/month
- **Total**: ~$13-18/month

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ Yes | PostgreSQL connection string |
| `HUBSPOT_API_KEY` | ✅ Yes | HubSpot Private App access token |
| `MAPBOX_TOKEN` | ✅ Yes | Mapbox access token (server) |
| `VITE_MAPBOX_TOKEN` | ✅ Yes | Mapbox access token (client) |
| `SESSION_SECRET` | ✅ Yes | Session encryption key |
| `NODE_ENV` | ✅ Yes | Set to `production` |
| `PORT` | No | Auto-set by Cloud Run/App Engine |
| `HUBSPOT_FIELD_VISIT_ASSOCIATION_TYPE_ID` | No | Optional custom object association |

## Post-Deployment Checklist

- [ ] Database migrations completed successfully
- [ ] Demo user login works (`demo` / `demo123`)
- [ ] HubSpot sync running (check logs)
- [ ] Maps displaying correctly
- [ ] Create production users with HubSpot owner IDs
- [ ] Set up custom domain (optional)
- [ ] Configure SSL certificate (auto with Cloud Run)
- [ ] Set up monitoring and alerting
- [ ] Configure backup schedule for Cloud SQL

## Monitoring and Logging

### View Logs
```bash
# Cloud Run logs
gcloud run services logs read msf-field-sales --limit 50

# App Engine logs
gcloud app logs tail
```

### Set Up Monitoring
```bash
# Create uptime check
gcloud monitoring uptime-checks create https \
  --display-name="MSF Sales Health Check" \
  --resource-type=uptime-url \
  --host=YOUR_CLOUD_RUN_URL \
  --path=/api/auth/me
```

## Troubleshooting

### Database Connection Issues
1. Verify Cloud SQL instance is running
2. Check connection string format
3. Ensure Cloud SQL instance is in same region
4. Verify service account has Cloud SQL Client role

### HubSpot Sync Failing
1. Check HUBSPOT_API_KEY is correct
2. Verify HubSpot Private App scopes
3. Check rate limits (100 requests per 10 seconds)

### Mapbox Not Loading
1. Ensure VITE_MAPBOX_TOKEN is set (client-side)
2. Verify token starts with `pk.`
3. Check Mapbox account quota

## Security Best Practices

1. **Use Secret Manager** - Never hardcode secrets
2. **Enable VPC** - Restrict database access
3. **Use IAM** - Grant minimum required permissions
4. **Enable audit logs** - Track all admin actions
5. **Regular backups** - Enable automated Cloud SQL backups
6. **Update dependencies** - Keep packages up to date

## Next Steps

1. Deploy using your preferred method above
2. Run database migrations
3. Test with demo user
4. Create production user accounts
5. Map users to HubSpot owner IDs
6. Configure custom domain (optional)
7. Set up monitoring and alerts

---

**Support:**
- GCP Documentation: https://cloud.google.com/docs
- Cloud Run Pricing: https://cloud.google.com/run/pricing
- Cloud SQL Pricing: https://cloud.google.com/sql/pricing
