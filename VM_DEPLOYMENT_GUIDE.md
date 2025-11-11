# Deploying MSP Field Sales App to Your Own VM

This guide explains how to deploy the Field Sales Route App to your own Virtual Machine (VM) or server.

## Prerequisites

1. **VM Requirements:**
   - Ubuntu 20.04+ or similar Linux distribution
   - Node.js 20.x installed
   - PostgreSQL 14+ installed
   - At least 2GB RAM
   - Public IP address (for accessing the app)

2. **Required API Keys:**
   - HubSpot Private App API Key
   - Mapbox Access Token (get from https://account.mapbox.com/)
   - Generate a random SESSION_SECRET

## Step 1: Set Up PostgreSQL Database

### Install PostgreSQL (if not already installed)
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### Create Database and User
```bash
# Switch to postgres user
sudo -u postgres psql

# In PostgreSQL shell, run:
CREATE DATABASE fieldsales;
CREATE USER fielduser WITH PASSWORD 'your-secure-password';
GRANT ALL PRIVILEGES ON DATABASE fieldales TO fielduser;
\q
```

### Get Database Connection String
Your `DATABASE_URL` should be in this format:
```
postgresql://fielduser:your-secure-password@localhost:5432/fieldales
```

## Step 2: Clone and Set Up Application

```bash
# Clone your repository or copy files to VM
cd /opt
git clone <your-repo-url> fieldales-app
cd fieldales-app

# Install dependencies
npm install

# Install PM2 for process management (optional but recommended)
npm install -g pm2
```

## Step 3: Configure Environment Variables

Create a `.env` file in the project root:

```bash
nano .env
```

Add the following environment variables:

```bash
# Database Connection
DATABASE_URL=postgresql://fielduser:your-secure-password@localhost:5432/fieldales

# HubSpot Integration
HUBSPOT_API_KEY=pat-na1-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx

# Mapbox Integration (both required!)
MAPBOX_TOKEN=pk.eyJ1IjoieW91ci11c2VybmFtZSIsImEiOiJjbHh4eHh4eHgifQ.xxxxxxxxxxxxxxxxx
VITE_MAPBOX_TOKEN=pk.eyJ1IjoieW91ci11c2VybmFtZSIsImEiOiJjbHh4eHh4eHgifQ.xxxxxxxxxxxxxxxxx

# Session Security
SESSION_SECRET=generate-a-random-64-character-string-here

# Optional: HubSpot Custom Object Association
HUBSPOT_FIELD_VISIT_ASSOCIATION_TYPE_ID=your-association-id

# Node Environment
NODE_ENV=production
```

**Important Notes:**
- `MAPBOX_TOKEN` = Backend geocoding API calls
- `VITE_MAPBOX_TOKEN` = Frontend map display (must be the same value!)
- Generate SESSION_SECRET with: `openssl rand -hex 32`

## Step 4: Initialize Database Schema

Run database migrations to create all required tables:

```bash
# Push schema to database
npm run db:push
```

If you see data-loss warnings:
```bash
npm run db:push --force
```

## Step 5: Build the Application

```bash
# Build frontend and backend
npm run build
```

**Note:** If build fails with "Could not resolve ./db" error, you need to update package.json first (see troubleshooting below).

## Step 6: Start the Application

### Option A: Using PM2 (Recommended for Production)

```bash
# Start the app with PM2
pm2 start npm --name "fieldales-app" -- start

# Save PM2 process list
pm2 save

# Configure PM2 to start on system boot
pm2 startup
# Follow the instructions PM2 provides

# View logs
pm2 logs fieldales-app

# Restart app
pm2 restart fieldales-app

# Stop app
pm2 stop fieldales-app
```

### Option B: Direct Node.js

```bash
# Start in production mode
npm start

# Or run in background with nohup
nohup npm start > app.log 2>&1 &
```

## Step 7: Configure Firewall

Allow traffic on port 5000 (or your chosen port):

```bash
# For Ubuntu/Debian with ufw
sudo ufw allow 5000/tcp
sudo ufw reload

# For CentOS/RHEL with firewalld
sudo firewall-cmd --permanent --add-port=5000/tcp
sudo firewall-cmd --reload
```

## Step 8: Access Your Application

Your app should now be running at:
```
http://your-vm-ip:5000
```

**Default Login:**
- Username: `demo`
- Password: `demo123`

## Step 9: Set Up Nginx Reverse Proxy (Optional but Recommended)

### Install Nginx
```bash
sudo apt install nginx
```

### Configure Nginx
```bash
sudo nano /etc/nginx/sites-available/fieldales
```

Add this configuration:
```nginx
server {
    listen 80;
    server_name your-domain.com;  # Or your VM IP

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/fieldales /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

Now access at: `http://your-domain.com` (port 80)

## Step 10: Set Up SSL with Let's Encrypt (Optional)

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

## Troubleshooting

### Issue: Build Fails with "Could not resolve ./db"

**Solution:** Update the build script in `package.json`:

Change line 8 from:
```json
"build": "vite build && esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist",
```

To:
```json
"build": "vite build && node esbuild.config.js",
```

The `esbuild.config.js` file should already exist in your project root.

### Issue: Database Connection Fails

**Check:**
1. Is PostgreSQL running? `sudo systemctl status postgresql`
2. Can you connect manually? `psql -U fielduser -d fieldales -h localhost`
3. Is DATABASE_URL format correct? Must be: `postgresql://user:pass@host:port/dbname`
4. Check PostgreSQL logs: `sudo tail -f /var/log/postgresql/postgresql-14-main.log`

### Issue: Maps Not Showing

**Check:**
1. Both `MAPBOX_TOKEN` and `VITE_MAPBOX_TOKEN` are set in `.env`
2. Both have the **exact same value**
3. The token starts with `pk.` (public token)
4. Hard refresh browser: `Ctrl + Shift + R` (Windows/Linux) or `Cmd + Shift + R` (Mac)
5. Check browser console for errors (F12 → Console tab)

### Issue: No HubSpot Data

**Check:**
1. `HUBSPOT_API_KEY` is set correctly (starts with `pat-na1-`)
2. HubSpot Private App has correct scopes:
   - `crm.objects.companies.read`
   - `crm.objects.custom.read`
   - `crm.objects.custom.write`
3. Check server logs for sync errors:
   - If using PM2: `pm2 logs fieldales-app`
   - If direct: check `app.log` or terminal output
4. Manually trigger sync: `curl -X POST http://localhost:5000/api/sync`

### Issue: Environment Variables Not Loading

When running with `npm start`, environment variables from `.env` are **not** automatically loaded.

**Solution 1: Use dotenv package**
```bash
npm install dotenv
```

Update `server/index.ts` (first line):
```typescript
import 'dotenv/config';
```

**Solution 2: Load env vars manually**
```bash
export $(cat .env | xargs) && npm start
```

**Solution 3: Use PM2 ecosystem file**
Create `ecosystem.config.js`:
```javascript
module.exports = {
  apps: [{
    name: 'fieldales-app',
    script: 'npm',
    args: 'start',
    env_file: '.env'
  }]
}
```

Then start with: `pm2 start ecosystem.config.js`

## Creating Production Users

The demo user is only for testing. Create real users via the database:

```bash
# Connect to database
psql -U fielduser -d fieldales

# Create a user (replace values)
INSERT INTO users (id, username, password_hash, email, name, hubspot_owner_id)
VALUES (
  gen_random_uuid(),
  'john.doe',
  '$2a$10$...',  -- Get this by running bcrypt hash
  'john@company.com',
  'John Doe',
  '12345678'  -- HubSpot owner ID
);
```

**To generate password hash:**
```javascript
const bcrypt = require('bcryptjs');
const hash = bcrypt.hashSync('secure-password', 10);
console.log(hash);
```

## Monitoring

### View Application Logs
```bash
# PM2
pm2 logs fieldales-app

# System logs
tail -f app.log

# Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### Check Application Status
```bash
# PM2
pm2 status

# Direct process
ps aux | grep node
```

### Monitor Resources
```bash
# Install htop
sudo apt install htop
htop
```

## Backup and Updates

### Database Backup
```bash
# Backup
pg_dump -U fielduser fieldales > backup_$(date +%Y%m%d).sql

# Restore
psql -U fielduser fieldales < backup_20241111.sql
```

### Application Update
```bash
# Pull latest code
git pull origin main

# Install new dependencies
npm install

# Rebuild
npm run build

# Restart app
pm2 restart fieldales-app
```

## Security Checklist

- [ ] Change default demo user password or disable it
- [ ] Use strong SESSION_SECRET (at least 64 characters)
- [ ] Enable firewall (ufw/firewalld)
- [ ] Set up SSL/HTTPS with Let's Encrypt
- [ ] Keep PostgreSQL password secure
- [ ] Never commit `.env` file to git
- [ ] Regular database backups
- [ ] Keep Node.js and packages updated
- [ ] Configure PostgreSQL to only allow local connections
- [ ] Use Nginx rate limiting for API endpoints

## Need Help?

Check these logs in order:
1. Application logs: `pm2 logs` or terminal output
2. PostgreSQL logs: `/var/log/postgresql/`
3. Nginx logs: `/var/log/nginx/`
4. Browser console: F12 → Console tab
