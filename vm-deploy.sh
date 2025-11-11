#!/bin/bash

# MSP Field Sales App - VM Deployment Script
# This script sets up and deploys the app on your VM

set -e  # Exit on error

echo "=========================================="
echo "MSP Field Sales App - VM Deployment"
echo "=========================================="

# Check if .env exists
if [ ! -f .env ]; then
    echo "ERROR: .env file not found!"
    echo "Please create .env with the following variables:"
    echo ""
    echo "DATABASE_URL=postgresql://user:pass@localhost:5432/dbname"
    echo "HUBSPOT_API_KEY=pat-na1-xxxx"
    echo "MAPBOX_TOKEN=pk.eyJ..."
    echo "VITE_MAPBOX_TOKEN=pk.eyJ...  # Same as MAPBOX_TOKEN"
    echo "SESSION_SECRET=random-64-char-string"
    exit 1
fi

# Load environment variables
echo "✓ Loading environment variables from .env"
export $(cat .env | grep -v '^#' | xargs)

# Check required variables
echo "Checking required environment variables..."

if [ -z "$DATABASE_URL" ]; then
    echo "ERROR: DATABASE_URL not set in .env"
    exit 1
fi
echo "✓ DATABASE_URL is set"

if [ -z "$VITE_MAPBOX_TOKEN" ]; then
    echo "ERROR: VITE_MAPBOX_TOKEN not set in .env"
    echo "This must be set for maps to work in the frontend!"
    exit 1
fi
echo "✓ VITE_MAPBOX_TOKEN is set"

if [ -z "$HUBSPOT_API_KEY" ]; then
    echo "WARNING: HUBSPOT_API_KEY not set - HubSpot sync will be disabled"
else
    echo "✓ HUBSPOT_API_KEY is set"
fi

if [ -z "$SESSION_SECRET" ]; then
    echo "ERROR: SESSION_SECRET not set in .env"
    exit 1
fi
echo "✓ SESSION_SECRET is set"

# Install dependencies
echo ""
echo "Installing dependencies..."
npm install

# Install dotenv for runtime env loading
echo "Installing dotenv..."
npm install dotenv

# Check if server/index.ts has dotenv import
if ! grep -q "dotenv/config" server/index.ts; then
    echo ""
    echo "Adding dotenv import to server/index.ts..."
    # Add import as first line
    sed -i "1s;^;import 'dotenv/config';\n;" server/index.ts
    echo "✓ Added dotenv import"
else
    echo "✓ dotenv import already present"
fi

# Run database migrations
echo ""
echo "Running database migrations..."
npm run db:push --force

# Build the application
echo ""
echo "Building application (this may take a few minutes)..."
echo "VITE_MAPBOX_TOKEN will be baked into frontend bundle..."
npm run build

echo ""
echo "=========================================="
echo "✓ Deployment Complete!"
echo "=========================================="
echo ""
echo "Start the application with:"
echo "  npm start"
echo ""
echo "Or use PM2 for production:"
echo "  pm2 start npm --name fieldapp -- start"
echo ""
echo "Access your app at:"
echo "  http://your-vm-ip:5000"
echo ""
echo "Default login:"
echo "  Username: demo"
echo "  Password: demo123"
echo ""
echo "Note: GPS requires HTTPS. Set up SSL or access via localhost."
echo "=========================================="
