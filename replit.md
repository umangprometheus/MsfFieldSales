# MSP Diesel Field Sales Route App

A Progressive Web App for field sales route planning and customer check-ins with HubSpot CRM integration.

## Overview

Mobile-first field sales application that helps sales reps:
- Plan optimized routes based on customer proximity
- Get automatic proximity alerts when near customers (250m threshold)
- Log check-ins directly to HubSpot CRM (custom object or Notes fallback)
- Track daily visit summaries and mileage
- Filter companies by sales rep ownership

## Tech Stack

**Frontend:**
- React + Vite (PWA)
- Wouter (routing)
- TanStack Query (data fetching)
- Mapbox GL JS (maps)
- Shadcn UI + Tailwind CSS

**Backend:**
- Node.js 20 + Express
- PostgreSQL (Neon) - persistent data storage
- HubSpot Private App API integration
- Mapbox APIs (geocoding, route optimization)
- Turf.js (geospatial calculations)
- Drizzle ORM

## Setup Instructions

### Required Secrets

Add these secrets in the Replit Secrets panel:

1. **DATABASE_URL** - PostgreSQL connection string (auto-populated by Replit)
   
2. **HUBSPOT_API_KEY** - Your HubSpot Private App access token
   - Create a Private App in HubSpot: Settings → Integrations → Private Apps
   - Required scopes:
     - `crm.objects.companies.read` - Read company data
     - `crm.objects.custom.read` - Read custom objects
     - `crm.objects.custom.write` - Write field visit check-ins
     - `crm.objects.owners.read` - Map owner IDs to reps (optional)
   - See HUBSPOT_CUSTOM_OBJECT_SETUP.md for detailed setup
   
3. **MAPBOX_TOKEN** - Your Mapbox access token
   - Get it from https://account.mapbox.com/
   - Free tier: 100k geocoding requests/month
   
4. **VITE_MAPBOX_TOKEN** - Same value as MAPBOX_TOKEN
   - Required for client-side map display
   
5. **SESSION_SECRET** - Random string for session encryption
   - Generate with: `openssl rand -hex 32`

6. **HUBSPOT_FIELD_VISIT_ASSOCIATION_TYPE_ID** - (Optional) Association type ID
   - Only needed if you want automatic company association for field visits
   - See HUBSPOT_CUSTOM_OBJECT_SETUP.md for how to get this value

### Database Setup

The app uses PostgreSQL for persistent storage:

1. Database is automatically provisioned by Replit
2. **First-time setup**: Run `npm run db:push` manually to create database tables
   - If you see data-loss warnings, use `npm run db:push --force` to force the migration
3. Demo user created automatically on first server start: username `demo`, password `demo123`
4. Demo companies seeded for testing (10 Memphis locations)

**Note:** Database migrations must be run manually. The app will fail to start if tables don't exist yet.

**Database Schema:**
- `users` - User accounts with bcrypt-hashed passwords and HubSpot owner ID mapping
- `companies` - Cached HubSpot companies with geocoded coordinates
- `check_ins` - Field visit records with GPS coordinates
- `routes` - Saved route plans with stop sequences
- `sync_logs` - Background sync tracking

### HubSpot Integration

The app uses a **HubSpot Private App** for API access (not OAuth):

**Authentication Model:**
- Sales reps log in with username/password (not HubSpot OAuth)
- Backend uses single Private App API key for all HubSpot operations
- Each user has a `hubspotOwnerId` field mapping them to HubSpot owner

**Data Sync:**
- Background job pulls companies from HubSpot every 15 minutes
- Companies geocoded via Mapbox and cached in PostgreSQL
- Incremental updates detect new/changed/deleted companies
- Manual sync available via POST /api/sync endpoint

**Owner-Based Filtering:**
- Sales reps see only companies they own (hubspot_owner_id = their hubspotOwnerId)
- Admin users (no hubspotOwnerId) see all companies
- Mapping usernames to owner IDs done via database updates

**Check-In Logging:**
- App attempts to create HubSpot custom object record (field_visits)
- Falls back to Note creation if custom object doesn't exist
- All check-ins stored in local database regardless

## Architecture

### Authentication Flow

1. **User Login**: Rep enters username/password → backend verifies with bcrypt
2. **Session Creation**: Cookie-based session with userId stored
3. **Authorization**: Protected routes check session, fetch user from database
4. **Owner Filtering**: API endpoints filter data by user's hubspotOwnerId

### Data Flow

1. **Background Sync**: Every 15 minutes, fetch companies from HubSpot → geocode new addresses → upsert to PostgreSQL
2. **Route Planning**: User selects location & radius → API filters companies by owner & proximity → builds optimized route
3. **Route Execution**: Real-time GPS tracking → proximity detection → check-in prompt at 250m
4. **Check-In**: Create local DB record → async write to HubSpot (custom object or Note) → update local record with HubSpot ID
5. **Summary**: Query local DB for user's check-ins by date → calculate stats → return with company details

### Key Files

**Backend:**
- `server/db.ts` - PostgreSQL connection (Neon WebSocket config)
- `server/storage.ts` - Database access layer (Drizzle ORM)
- `server/routes.ts` - All API endpoints
- `server/services/hubspot.ts` - HubSpot Private App API integration
- `server/services/mapbox.ts` - Geocoding & route optimization
- `server/services/geo.ts` - Distance calculations (Turf.js)
- `server/services/sync.ts` - Background company sync (15 min intervals)
- `server/services/auth.ts` - Password hashing (bcrypt)
- `server/seed-data.ts` - Demo user & company seeding
- `shared/schema.ts` - Drizzle table definitions & Zod schemas

**Frontend:**
- `client/src/pages/login.tsx` - Username/password login form
- `client/src/pages/plan.tsx` - Route planning interface
- `client/src/pages/route.tsx` - Active route execution
- `client/src/pages/summary.tsx` - Daily summary dashboard
- `client/src/lib/api.ts` - API hooks (TanStack Query)
- `client/src/lib/auth.tsx` - Authentication context

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login with username/password
- `GET /api/auth/me` - Get current user
- `POST /api/auth/logout` - Logout (clear session)

### Companies
- `GET /api/companies` - Get nearby companies (filtered by owner, radius, search)
- `POST /api/sync` - Force sync from HubSpot (admin only)

### Routes
- `POST /api/route` - Build optimized route from company IDs

### Check-Ins
- `POST /api/checkins` - Log field visit (creates DB record + HubSpot entry)

### Summary
- `GET /api/summary?date=YYYY-MM-DD` - Get daily summary with stats

## Development

**Start the app:**
```bash
npm run dev
```

**Database migrations:**
```bash
npm run db:push         # Push schema changes to database
npm run db:push --force # Force push if data-loss warning
```

**Access:**
- Frontend: http://localhost:5000
- Backend API: http://localhost:5000/api

**Demo Credentials:**
- Username: `demo`
- Password: `demo123`

## Deployment Requirements

### Environment Variables (Secrets)

**Required:**
- `DATABASE_URL` - PostgreSQL connection string (auto-populated by Replit)
  - Neon WebSocket connections are configured automatically in `server/db.ts`
  - Format: `postgres://user:password@host/database?sslmode=require`
- `HUBSPOT_API_KEY` - Private App token (get from HubSpot Settings → Integrations → Private Apps)
- `MAPBOX_TOKEN` - Mapbox API key (from https://account.mapbox.com/)
- `VITE_MAPBOX_TOKEN` - Same value as MAPBOX_TOKEN (required for client-side maps)
- `SESSION_SECRET` - Random string for session encryption (generate with `openssl rand -hex 32`)

**Optional:**
- `HUBSPOT_FIELD_VISIT_ASSOCIATION_TYPE_ID` - Association type ID for automatic field visit → company linking

**⚠️ Breaking Change from OAuth Version:**
If migrating from the OAuth version, remove these deprecated secrets:
- Any HubSpot OAuth-related secrets from Replit Connectors
- Old authentication tokens or refresh tokens

### HubSpot Private App Scopes

Minimum required:
- `crm.objects.companies.read`
- `crm.objects.custom.read`
- `crm.objects.custom.write`

Recommended:
- `crm.objects.owners.read` (for owner lookups)
- `crm.schemas.custom.read` (for custom object schema inspection)

### User Management

**Creating Users:**
```typescript
// Via database or API
await storage.createUser({
  username: "john.doe",
  passwordHash: await hashPassword("secure-password"),
  email: "john@example.com",
  name: "John Doe",
  hubspotOwnerId: "12345678", // HubSpot owner ID
});
```

**Mapping Users to HubSpot Owners:**
1. Get HubSpot owner IDs from HubSpot UI (Settings → Users & Teams → Owners)
   - Or use HubSpot API directly: `GET https://api.hubapi.com/crm/v3/owners`
2. Update user records in database with corresponding hubspotOwnerId:
   ```typescript
   await storage.updateUser(userId, { hubspotOwnerId: "12345678" });
   ```
3. Users will automatically see only their owned companies

### Rate Limits

**Mapbox:**
- Free tier: 100k geocoding requests/month
- Current setup: ~1700 companies geocoded once, then cached
- Periodic sync: Only geocodes new/changed addresses

**HubSpot Private App:**
- 100 requests per 10 seconds (burst)
- Uses pagination for large company lists
- Exponential backoff on rate limit errors

## Cost Breakdown

**Replit Hosting:** $6-60/month (depending on tier)
**Mapbox:** $0 (free tier sufficient for most use cases)
**HubSpot:** $0 (clients bring own accounts)
**Total:** $6-60/month

Compare to Google Cloud Platform: $13-83/month (Cloud Run + Cloud SQL)

## User Preferences

**Design System:**
- Mobile-first, outdoor-optimized (high contrast)
- Primary: Deep blue (#1c4ed8) - trust/reliability
- Success: Green - check-in confirmations
- Warning: Amber - proximity alerts
- Typography: Inter (primary), JetBrains Mono (coordinates)

## Recent Changes

**October 27, 2025:**
- **🚨 BREAKING CHANGE:** Complete architecture overhaul
  - **Authentication**: Migrated from HubSpot OAuth to username/password (bcrypt)
    - Remove all OAuth secrets from Replit Connectors
    - Create user accounts manually via database
  - **Database**: Switched from in-memory to PostgreSQL (Neon) with Drizzle ORM
    - Requires manual `npm run db:push` on first setup
    - All data persists across restarts
  - **HubSpot Integration**: Now uses Private App API key instead of OAuth connector
    - Create Private App in HubSpot Settings
    - Add `HUBSPOT_API_KEY` secret to Replit
    - See setup instructions above for required scopes
- **Owner Filtering:** Users see only companies they own (hubspotOwnerId mapping)
- **Custom Object:** Field visits write to custom object with Note fallback
- **Background Sync:** Automatic company sync every 15 minutes
- **Demo Data:** Auto-seeded demo user (`demo` / `demo123`) and 10 Memphis test companies
- **Documentation:** Added HUBSPOT_CUSTOM_OBJECT_SETUP.md for custom object setup

**October 15, 2025:**
- Initial MVP implementation complete
- Frontend: All pages and components with Shadcn UI
- Backend: HubSpot integration, Mapbox services, API routes
- Integration: TanStack Query hooks, authentication flow
- Design: Mobile-optimized with design guidelines

## Project Structure

```
/
├── client/                        # React PWA
│   ├── src/
│   │   ├── components/            # Reusable UI components
│   │   ├── pages/                 # Route pages (login, plan, route, summary)
│   │   ├── lib/                   # API hooks, auth, utils
│   │   └── App.tsx                # Main app with routing
│   └── index.html
├── server/                        # Express API
│   ├── services/                  # HubSpot, Mapbox, Geo, Auth, Sync
│   ├── db.ts                      # PostgreSQL connection
│   ├── storage.ts                 # Database access layer (Drizzle)
│   ├── routes.ts                  # API routes
│   ├── seed-data.ts               # Demo data seeding
│   └── index.ts                   # Server entry point
├── shared/                        # Shared types
│   └── schema.ts                  # Drizzle schemas & Zod validators
├── design_guidelines.md           # UI/UX design system
├── HUBSPOT_CUSTOM_OBJECT_SETUP.md # HubSpot custom object guide
└── cost-breakdown.csv             # Cost comparison analysis
```

## Known Issues & Future Enhancements

**Current Limitations:**
- No offline mode (requires internet for maps & sync)
- Foreground-only geolocation (app must stay open)
- Manual user creation via database (no signup UI)
- No role-based permissions (owner filtering only)

**Roadmap (Phase 2):**
- Offline mode with background sync
- Background geolocation with service workers
- Admin UI for user management
- Role-based access control (admin, manager, rep)
- AI-based route prioritization
- Voice-to-text notes
- Webhook-based real-time sync
- Mobile app (React Native)
- Multi-company support (separate HubSpot portals)
