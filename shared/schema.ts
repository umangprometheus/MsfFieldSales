import { pgTable, text, varchar, timestamp, real, boolean, integer, jsonb, unique, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { sql } from "drizzle-orm";

// ============================================================================
// Users Table - Username/password authentication + HubSpot owner mapping
// ============================================================================
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: varchar("username", { length: 100 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  name: varchar("name", { length: 255 }),
  hubspotOwnerId: varchar("hubspot_owner_id", { length: 100 }), // Maps to HubSpot owner ID
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type LoginCredentials = z.infer<typeof loginSchema>;

// ============================================================================
// Companies Table - Cached HubSpot companies with geocoded locations
// ============================================================================
export const companies = pgTable("companies", {
  id: varchar("id").primaryKey(), // HubSpot company ID
  name: text("name").notNull(),
  street: text("street"),
  city: varchar("city", { length: 100 }),
  state: varchar("state", { length: 50 }),
  postalCode: varchar("postal_code", { length: 20 }),
  country: varchar("country", { length: 100 }),
  ownerId: varchar("owner_id", { length: 100 }), // HubSpot owner ID
  lat: real("lat"),
  lng: real("lng"),
  lastSyncedAt: timestamp("last_synced_at").notNull().defaultNow(),
  isDeleted: boolean("is_deleted").default(false), // Soft delete flag
});

export const insertCompanySchema = createInsertSchema(companies).omit({
  lastSyncedAt: true,
});

export type Company = typeof companies.$inferSelect;
export type InsertCompany = z.infer<typeof insertCompanySchema>;

// ============================================================================
// Check-Ins Table - Field visit records
// ============================================================================
export const checkIns = pgTable("check_ins", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  companyId: varchar("company_id").notNull().references(() => companies.id),
  lat: real("lat").notNull(),
  lng: real("lng").notNull(),
  note: text("note"),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  hubspotNoteId: varchar("hubspot_note_id", { length: 100 }), // HubSpot Note ID after sync
  hubspotCustomObjectId: varchar("hubspot_custom_object_id", { length: 100 }), // Custom object ID
});

export const insertCheckInSchema = createInsertSchema(checkIns).omit({
  id: true,
  timestamp: true,
  hubspotNoteId: true,
  hubspotCustomObjectId: true,
});

export type CheckIn = typeof checkIns.$inferSelect;
export type InsertCheckIn = z.infer<typeof insertCheckInSchema>;

// ============================================================================
// Routes Table - Active routes with ordered stops
// ============================================================================
export const routes = pgTable("routes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  stops: jsonb("stops").notNull(), // DEPRECATED: Use route_stops table instead
  totalDistanceMi: real("total_distance_mi").notNull(),
  totalEtaMin: integer("total_eta_min").notNull(),
  currentStopIndex: integer("current_stop_index").notNull().default(0),
  status: varchar("status", { length: 20 }).notNull().default("planning"), // planning, active, completed
  createdAt: timestamp("created_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
});

export const insertRouteSchema = createInsertSchema(routes).omit({
  id: true,
  createdAt: true,
  completedAt: true,
});

export type Route = typeof routes.$inferSelect;
export type InsertRoute = z.infer<typeof insertRouteSchema>;

// ============================================================================
// Route Stops Table - Individual stops for better reporting & analytics
// ============================================================================
export const routeStops = pgTable("route_stops", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  routeId: varchar("route_id").notNull().references(() => routes.id, { onDelete: "cascade" }),
  companyId: varchar("company_id").notNull().references(() => companies.id),
  stopIndex: integer("stop_index").notNull(), // Order in the route (0-based)
  lat: real("lat").notNull(),
  lng: real("lng").notNull(),
  street: text("street"),
  city: varchar("city", { length: 100 }),
  state: varchar("state", { length: 50 }),
  postalCode: varchar("postal_code", { length: 20 }),
  distanceFromPrevMi: real("distance_from_prev_mi"),
  etaFromPrevMin: integer("eta_from_prev_min"),
  completed: boolean("completed").notNull().default(false),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  // Unique constraint to prevent duplicate stop indexes in same route
  uniqueRouteStopIndex: unique("route_stops_route_id_stop_index_unique").on(table.routeId, table.stopIndex),
  // Performance indexes for analytics queries
  routeIdIdx: index("route_stops_route_id_idx").on(table.routeId),
  routeCompletedIdx: index("route_stops_route_id_completed_idx").on(table.routeId, table.completed),
  companyIdIdx: index("route_stops_company_id_idx").on(table.companyId),
}));

export const insertRouteStopSchema = createInsertSchema(routeStops).omit({
  id: true,
  createdAt: true,
  completedAt: true,
});

export type RouteStop = typeof routeStops.$inferSelect;
export type InsertRouteStop = z.infer<typeof insertRouteStopSchema>;

// ============================================================================
// Sync Log Table - Track HubSpot sync history
// ============================================================================
export const syncLogs = pgTable("sync_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  startedAt: timestamp("started_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
  companiesFetched: integer("companies_fetched"),
  companiesAdded: integer("companies_added"),
  companiesUpdated: integer("companies_updated"),
  companiesDeleted: integer("companies_deleted"),
  geocodingCalls: integer("geocoding_calls"),
  status: varchar("status", { length: 20 }).notNull().default("running"), // running, success, failed
  errorMessage: text("error_message"),
});

export const insertSyncLogSchema = createInsertSchema(syncLogs).omit({
  id: true,
  startedAt: true,
});

export type SyncLog = typeof syncLogs.$inferSelect;
export type InsertSyncLog = z.infer<typeof insertSyncLogSchema>;

// ============================================================================
// API Request/Response Schemas (Zod only - not database tables)
// ============================================================================

export const routeStopApiSchema = z.object({
  companyId: z.string(),
  name: z.string(),
  lat: z.number(),
  lng: z.number(),
  distanceFromPrevMi: z.number().nullable(),
  etaFromPrevMin: z.number().nullable(),
  completed: z.boolean().default(false),
  street: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  postalCode: z.string().nullable(),
});

export type RouteStopApi = z.infer<typeof routeStopApiSchema>;

// Companies endpoint
export const companiesQuerySchema = z.object({
  lat: z.number().optional(),
  lng: z.number().optional(),
  radiusMi: z.number().min(1).max(100).default(25),
  ownerOnly: z.boolean().default(true),
  search: z.string().optional(),
});

export type CompaniesQuery = z.infer<typeof companiesQuerySchema>;

export const companyWithDistanceSchema = z.object({
  id: z.string(),
  name: z.string(),
  street: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  postalCode: z.string().nullable(),
  country: z.string().nullable(),
  ownerId: z.string().nullable(),
  lat: z.number().nullable(),
  lng: z.number().nullable(),
  distanceMi: z.number(),
});

export type CompanyWithDistance = z.infer<typeof companyWithDistanceSchema>;

// Route building endpoint
export const buildRouteRequestSchema = z.object({
  origin: z.union([
    z.object({ lat: z.number(), lng: z.number() }),
    z.literal("gps"),
  ]),
  companyIds: z.array(z.string()).min(1),
  optimize: z.boolean().default(true),
});

export type BuildRouteRequest = z.infer<typeof buildRouteRequestSchema>;

export const buildRouteResponseSchema = z.object({
  routeId: z.string(),
  stops: z.array(routeStopApiSchema),
  totalDistMi: z.number(),
  totalEtaMin: z.number(),
  navUrl: z.string(),
  routeGeometry: z.array(z.object({ lat: z.number(), lng: z.number() })),
});

export type BuildRouteResponse = z.infer<typeof buildRouteResponseSchema>;

// Check-in endpoint
export const checkInRequestSchema = z.object({
  companyId: z.string(),
  lat: z.number(),
  lng: z.number(),
  note: z.string().optional(),
});

export type CheckInRequest = z.infer<typeof checkInRequestSchema>;

export const checkInResponseSchema = z.object({
  checkInId: z.string(),
  hsNoteId: z.string(),
  nextStop: routeStopApiSchema.nullable(),
});

export type CheckInResponse = z.infer<typeof checkInResponseSchema>;

// Summary endpoint
export const summaryQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export type SummaryQuery = z.infer<typeof summaryQuerySchema>;

export const summaryResponseSchema = z.object({
  date: z.string(),
  visitCount: z.number(),
  totalDistanceMi: z.number(),
  checkIns: z.array(
    z.object({
      id: z.string(),
      userId: z.string(),
      companyId: z.string(),
      lat: z.number(),
      lng: z.number(),
      note: z.string().nullable(),
      timestamp: z.string(),
      hubspotNoteId: z.string().nullable(),
      hubspotCustomObjectId: z.string().nullable(),
      companyName: z.string(),
    })
  ),
});

export type SummaryResponse = z.infer<typeof summaryResponseSchema>;
