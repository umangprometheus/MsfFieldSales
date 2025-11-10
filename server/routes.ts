import type { Express } from "express";
import { createServer, type Server } from "http";
import cookieSession from "cookie-session";
import { storage } from "./storage";
import { 
  createFieldVisitCheckIn 
} from "./services/hubspot";
import { hashPassword, verifyPassword } from "./services/auth";
import { geocodeAddress, optimizeRoute, getRoute } from "./services/mapbox";
import { 
  calculateDistanceMiles, 
  calculateDistanceMeters,
  filterByRadius, 
  buildAddressString,
  orderByNearestNeighbor 
} from "./services/geo";
import { syncCompanies } from "./services/sync";
import type { 
  CompanyWithDistance,
  BuildRouteRequest, 
  CheckInRequest,
  RouteStop,
  loginSchema
} from "@shared/schema";

// Session middleware
function setupSession(app: Express) {
  app.use(
    cookieSession({
      name: "session",
      keys: [process.env.SESSION_SECRET || "dev-secret-key"],
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    })
  );
}

// Auth middleware
function requireAuth(req: any, res: any, next: any) {
  if (!req.session?.userId) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Not authenticated" } });
  }
  next();
}

// Create demo user on startup
async function ensureDemoUser() {
  const existingUser = await storage.getUserByUsername("demo");
  if (!existingUser) {
    const passwordHash = await hashPassword("demo123");
    await storage.createUser({
      username: "demo",
      passwordHash,
      email: "demo@mspdiesel.com",
      name: "Demo User",
      hubspotOwnerId: null,
    });
    console.log("✅ Created demo user (username: demo, password: demo123)");
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  setupSession(app);
  
  // Ensure demo user exists
  await ensureDemoUser();
  
  // Seed demo companies for testing
  const { seedDemoCompanies } = await import("./seed-data");
  await seedDemoCompanies();

  // ============================================================================
  // Auth Routes
  // ============================================================================

  // Login with username/password
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { loginSchema } = await import("@shared/schema");
      const credentials = loginSchema.parse(req.body);
      
      // Find user by username
      const user = await storage.getUserByUsername(credentials.username);
      
      if (!user) {
        return res.status(401).json({
          error: { code: "INVALID_CREDENTIALS", message: "Invalid username or password" }
        });
      }

      // Verify password using bcrypt
      const isValid = await verifyPassword(credentials.password, user.passwordHash);
      if (!isValid) {
        return res.status(401).json({
          error: { code: "INVALID_CREDENTIALS", message: "Invalid username or password" }
        });
      }

      // Set session
      (req as any).session.userId = user.id;
      (req as any).session.username = user.username;

      // Return user info (without password)
      res.json({
        id: user.id,
        username: user.username,
        email: user.email,
        name: user.name,
      });
    } catch (error: any) {
      console.error("Login error:", error);
      res.status(401).json({
        error: { code: "AUTH_FAILED", message: "Authentication failed" }
      });
    }
  });

  // Get current user
  app.get("/api/auth/me", requireAuth, async (req, res) => {
    const user = await storage.getUser((req as any).session.userId);
    if (!user) {
      return res.status(404).json({ error: { code: "NOT_FOUND", message: "User not found" } });
    }

    res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      name: user.name,
    });
  });

  // Logout
  app.post("/api/auth/logout", (req, res) => {
    (req as any).session = null;
    res.json({ success: true });
  });

  // ============================================================================
  // Companies Routes
  // ============================================================================

  // Get nearby companies
  app.get("/api/companies", requireAuth, async (req, res) => {
    try {
      const lat = req.query.lat ? parseFloat(req.query.lat as string) : null;
      const lng = req.query.lng ? parseFloat(req.query.lng as string) : null;
      const radiusMi = parseInt(req.query.radiusMi as string) || 25;
      const search = req.query.search as string;

      // Get current user to check for owner ID filtering
      const user = await storage.getUser((req as any).session.userId);
      if (!user) {
        return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "User not found" } });
      }

      // Get companies filtered by owner if user has a hubspotOwnerId
      let companies = user.hubspotOwnerId
        ? await storage.getCompaniesByOwner(user.hubspotOwnerId)
        : await storage.getAllCompanies();

      // Filter by search term
      if (search) {
        const searchLower = search.toLowerCase();
        companies = companies.filter((c) =>
          c.name.toLowerCase().includes(searchLower) ||
          c.city?.toLowerCase().includes(searchLower) ||
          c.state?.toLowerCase().includes(searchLower)
        );
      }

      // Filter by radius if location provided
      let companiesWithDistance: CompanyWithDistance[];
      if (lat !== null && lng !== null) {
        companiesWithDistance = filterByRadius(companies, lat, lng, radiusMi) as CompanyWithDistance[];
      } else {
        // No location - return all with distance 0
        companiesWithDistance = companies
          .filter((c) => c.lat !== null && c.lng !== null)
          .map((c) => ({ ...c, distanceMi: 0 })) as CompanyWithDistance[];
      }

      res.json({ companies: companiesWithDistance });
    } catch (error) {
      console.error("Error fetching companies:", error);
      res.status(500).json({ error: { code: "SERVER_ERROR", message: "Failed to fetch companies" } });
    }
  });

  // Force sync companies from HubSpot
  app.post("/api/sync", requireAuth, async (req, res) => {
    try {
      await syncCompanies();
      res.json({ success: true, message: "Company sync initiated" });
    } catch (error) {
      console.error("Sync error:", error);
      res.status(500).json({ error: { code: "SYNC_ERROR", message: "Failed to sync companies" } });
    }
  });

  // ============================================================================
  // Route Planning Routes
  // ============================================================================

  // Build optimized route
  app.post("/api/route", requireAuth, async (req, res) => {
    try {
      const { buildRouteRequestSchema } = await import("@shared/schema");
      const request: BuildRouteRequest = buildRouteRequestSchema.parse(req.body);

      // Get company details for each ID
      const companies = await Promise.all(
        request.companyIds.map((id) => storage.getCompany(id))
      );

      // Filter out any missing companies
      const validCompanies = companies.filter((c) => c !== undefined && c.lat !== null && c.lng !== null);
      
      if (validCompanies.length < 2) {
        return res.status(400).json({ 
          error: { code: "INVALID_REQUEST", message: "Need at least 2 companies to build a route" } 
        });
      }

      // Build coordinates array as objects with lat/lng
      const coordinates = validCompanies.map((c) => ({ lat: c!.lat!, lng: c!.lng! }));

      // Get user's origin (current location or specified point)
      let origin: { lat: number; lng: number } | undefined;
      if (typeof request.origin === 'object' && 'lat' in request.origin && 'lng' in request.origin) {
        origin = request.origin;
      }
      // Note: if origin is "gps", we'll optimize without a fixed start (any starting point)

      // Optimize route using Mapbox with user's location as starting point
      const optimizedRoute = await optimizeRoute(coordinates, origin);

      // Map optimized waypoints back to companies for API response
      const stopsForApi: RouteStopApi[] = optimizedRoute.waypoints.map((waypoint, index) => {
        const company = validCompanies[waypoint.waypointIndex];
        return {
          companyId: company!.id,
          name: company!.name,
          lat: company!.lat!,
          lng: company!.lng!,
          distanceFromPrevMi: waypoint.distanceFromPrevMi,
          etaFromPrevMin: waypoint.etaFromPrevMin,
          completed: false,
          // Include full company details for map display
          street: company!.street,
          city: company!.city,
          state: company!.state,
          postalCode: company!.postalCode,
        };
      });

      // Create route in storage (keep JSONB for backward compatibility during migration)
      console.log('[Routes] Creating route with totalDistMi:', optimizedRoute.totalDistMi, 'totalEtaMin:', optimizedRoute.totalEtaMin);
      
      const route = await storage.createRoute({
        userId: (req as any).session.userId,
        stops: stopsForApi as any,
        totalDistanceMi: optimizedRoute.totalDistMi,
        totalEtaMin: Math.round(optimizedRoute.totalEtaMin), // Round to integer for database
        currentStopIndex: 0,
        status: "planning",
      });
      
      // Create route_stops records for better analytics
      const routeStopsToCreate = stopsForApi.map((stop, index) => ({
        routeId: route.id,
        companyId: stop.companyId,
        stopIndex: index,
        lat: stop.lat,
        lng: stop.lng,
        street: stop.street || null,
        city: stop.city || null,
        state: stop.state || null,
        postalCode: stop.postalCode || null,
        distanceFromPrevMi: stop.distanceFromPrevMi || null,
        etaFromPrevMin: stop.etaFromPrevMin ? Math.round(stop.etaFromPrevMin) : null,
        completed: false,
      }));
      
      await storage.createRouteStops(routeStopsToCreate);
      
      console.log('[Routes] Created route with', routeStopsToCreate.length, 'stops in route_stops table');

      // Build Google Maps navigation URL
      const waypointsParam = stopsForApi
        .map((stop) => `${stop.lat},${stop.lng}`)
        .join("|");
      const navUrl = `https://www.google.com/maps/dir/?api=1&waypoints=${waypointsParam}&travelmode=driving`;

      // Return BuildRouteResponse format - use optimizedRoute values directly
      res.json({
        routeId: route.id,
        stops: stopsForApi,
        totalDistMi: optimizedRoute.totalDistMi,  // Use values from optimizedRoute, not storage
        totalEtaMin: optimizedRoute.totalEtaMin,
        navUrl,
        routeGeometry: optimizedRoute.routeGeometry,
      });
    } catch (error) {
      console.error("Route planning error:", error);
      res.status(500).json({ error: { code: "ROUTE_ERROR", message: "Failed to build route" } });
    }
  });

  // Get active route
  app.get("/api/route/active", requireAuth, async (req, res) => {
    try {
      const route = await storage.getActiveRoute((req as any).session.userId);
      if (!route) {
        return res.status(404).json({ error: { code: "NOT_FOUND", message: "No active route" } });
      }
      res.json(route);
    } catch (error) {
      console.error("Error fetching active route:", error);
      res.status(500).json({ error: { code: "SERVER_ERROR", message: "Failed to fetch route" } });
    }
  });

  // Update route (mark stops complete, update status)
  app.patch("/api/route/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;

      const route = await storage.updateRoute(id, updates);
      res.json(route);
    } catch (error) {
      console.error("Error updating route:", error);
      res.status(500).json({ error: { code: "SERVER_ERROR", message: "Failed to update route" } });
    }
  });

  // Get route history
  app.get("/api/routes/history", requireAuth, async (req, res) => {
    try {
      const status = req.query.status as string | undefined;
      const routes = await storage.getRoutesByUser((req as any).session.userId, status);
      res.json({ routes });
    } catch (error) {
      console.error("Error fetching route history:", error);
      res.status(500).json({ error: { code: "SERVER_ERROR", message: "Failed to fetch routes" } });
    }
  });

  // Delete route
  app.delete("/api/route/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteRoute(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting route:", error);
      res.status(500).json({ error: { code: "SERVER_ERROR", message: "Failed to delete route" } });
    }
  });

  // ============================================================================
  // Check-In Routes
  // ============================================================================

  // Create check-in
  app.post("/api/checkins", requireAuth, async (req, res) => {
    try {
      const { checkInRequestSchema } = await import("@shared/schema");
      const checkInData: CheckInRequest = checkInRequestSchema.parse(req.body);

      // Get company details
      const company = await storage.getCompany(checkInData.companyId);
      if (!company) {
        return res.status(404).json({ error: { code: "NOT_FOUND", message: "Company not found" } });
      }

      // Get user details
      const user = await storage.getUser((req as any).session.userId);
      if (!user) {
        return res.status(404).json({ error: { code: "NOT_FOUND", message: "User not found" } });
      }

      // Create local check-in record
      const checkIn = await storage.createCheckIn({
        userId: (req as any).session.userId,
        companyId: checkInData.companyId,
        lat: checkInData.lat,
        lng: checkInData.lng,
        note: checkInData.note || null,
      });

      // Mark route_stop as completed if there's an active route
      const activeRoute = await storage.getActiveRoute((req as any).session.userId);
      if (activeRoute) {
        const routeStops = await storage.getRouteStops(activeRoute.id);
        const stopToComplete = routeStops.find(s => s.companyId === checkInData.companyId && !s.completed);
        if (stopToComplete) {
          await storage.updateRouteStop(stopToComplete.id, { 
            completed: true,
            completedAt: new Date()
          });
          console.log(`✅ Marked route_stop ${stopToComplete.id} as completed for company ${checkInData.companyId}`);
          
          // Check if all stops are now completed and mark route as completed
          const allStops = await storage.getRouteStops(activeRoute.id);
          const allCompleted = allStops.every(s => s.completed);
          if (allCompleted) {
            await storage.updateRoute(activeRoute.id, {
              status: "completed",
              completedAt: new Date()
            });
            console.log(`✅ All stops completed, marked route ${activeRoute.id} as completed`);
          }
        }
      }

      // Create HubSpot field visit record (async, don't block response)
      createFieldVisitCheckIn(
        company.id,
        company.name,
        user.id,
        user.username,
        checkInData.lat,
        checkInData.lng,
        checkInData.note || null,
        checkIn.timestamp.toISOString()
      )
        .then((recordId) => {
          // Update check-in with HubSpot record ID
          storage.updateCheckIn(checkIn.id, { hubspotNoteId: recordId });
          console.log(`✅ Created HubSpot field visit ${recordId} for check-in ${checkIn.id}`);
        })
        .catch((err) => {
          console.error("Failed to create HubSpot field visit:", err);
        });

      res.json(checkIn);
    } catch (error) {
      console.error("Check-in error:", error);
      res.status(500).json({ error: { code: "SERVER_ERROR", message: "Failed to create check-in" } });
    }
  });

  // Update check-in (edit notes)
  app.patch("/api/checkins/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { note } = req.body;

      const checkIn = await storage.updateCheckIn(id, { note });
      res.json(checkIn);
    } catch (error) {
      console.error("Error updating check-in:", error);
      res.status(500).json({ error: { code: "SERVER_ERROR", message: "Failed to update check-in" } });
    }
  });

  // ============================================================================
  // Summary Routes
  // ============================================================================

  // Get daily summary
  app.get("/api/summary", requireAuth, async (req, res) => {
    try {
      const date = req.query.date as string || new Date().toISOString().split("T")[0];
      
      const checkIns = await storage.getCheckInsByDate((req as any).session.userId, date);

      // Calculate stats
      const totalVisits = checkIns.length;
      let totalMiles = 0;

      // Calculate mileage between check-ins
      for (let i = 1; i < checkIns.length; i++) {
        const prev = checkIns[i - 1];
        const curr = checkIns[i];
        totalMiles += calculateDistanceMiles(prev.lat, prev.lng, curr.lat, curr.lng);
      }

      // Get company details for each check-in
      const checkInsWithCompanies = await Promise.all(
        checkIns.map(async (checkIn) => {
          const company = await storage.getCompany(checkIn.companyId);
          return {
            ...checkIn,
            companyName: company?.name || "Unknown",
          };
        })
      );

      res.json({
        date,
        totalVisits,
        totalMiles: Math.round(totalMiles * 10) / 10,
        checkIns: checkInsWithCompanies,
      });
    } catch (error) {
      console.error("Summary error:", error);
      res.status(500).json({ error: { code: "SERVER_ERROR", message: "Failed to fetch summary" } });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
