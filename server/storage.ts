import { eq, and, gte, lte, desc } from "drizzle-orm";
import { db } from "./db";
import * as schema from "@shared/schema";
import type {
  User,
  InsertUser,
  Company,
  InsertCompany,
  CheckIn,
  InsertCheckIn,
  Route,
  InsertRoute,
  RouteStop,
  InsertRouteStop,
  SyncLog,
  InsertSyncLog,
} from "@shared/schema";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<InsertUser>): Promise<User>;

  getCompany(id: string): Promise<Company | undefined>;
  getCompaniesByOwner(ownerId: string): Promise<Company[]>;
  getAllCompanies(): Promise<Company[]>;
  upsertCompany(company: InsertCompany): Promise<Company>;
  upsertCompanies(companies: InsertCompany[]): Promise<Company[]>;
  softDeleteCompany(id: string): Promise<void>;

  getCheckIn(id: string): Promise<CheckIn | undefined>;
  getCheckInsByUser(userId: string): Promise<CheckIn[]>;
  getCheckInsByDate(userId: string, date: string): Promise<CheckIn[]>;
  createCheckIn(checkIn: InsertCheckIn): Promise<CheckIn>;
  updateCheckIn(id: string, updates: Partial<CheckIn>): Promise<CheckIn>;

  getRoute(id: string): Promise<Route | undefined>;
  getActiveRoute(userId: string): Promise<Route | undefined>;
  getRoutesByUser(userId: string, status?: string): Promise<Route[]>;
  createRoute(route: InsertRoute): Promise<Route>;
  updateRoute(id: string, updates: Partial<Route>): Promise<Route>;
  deleteRoute(id: string): Promise<void>;

  getRouteStops(routeId: string): Promise<RouteStop[]>;
  createRouteStop(stop: InsertRouteStop): Promise<RouteStop>;
  createRouteStops(stops: InsertRouteStop[]): Promise<RouteStop[]>;
  updateRouteStop(id: string, updates: Partial<RouteStop>): Promise<RouteStop>;
  deleteRouteStops(routeId: string): Promise<void>;

  createSyncLog(log: InsertSyncLog): Promise<SyncLog>;
  updateSyncLog(id: string, updates: Partial<SyncLog>): Promise<SyncLog>;
  getLatestSyncLog(): Promise<SyncLog | undefined>;
}

export class DbStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(schema.users).where(eq(schema.users.username, username));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(schema.users).where(eq(schema.users.email, email));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(schema.users).values(insertUser).returning();
    return user;
  }

  async updateUser(id: string, updates: Partial<InsertUser>): Promise<User> {
    const [user] = await db
      .update(schema.users)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.users.id, id))
      .returning();
    
    if (!user) throw new Error("User not found");
    return user;
  }

  async getCompany(id: string): Promise<Company | undefined> {
    const [company] = await db
      .select()
      .from(schema.companies)
      .where(and(eq(schema.companies.id, id), eq(schema.companies.isDeleted, false)));
    return company;
  }

  async getCompaniesByOwner(ownerId: string): Promise<Company[]> {
    return await db
      .select()
      .from(schema.companies)
      .where(and(eq(schema.companies.ownerId, ownerId), eq(schema.companies.isDeleted, false)));
  }

  async getAllCompanies(): Promise<Company[]> {
    return await db
      .select()
      .from(schema.companies)
      .where(eq(schema.companies.isDeleted, false));
  }

  async upsertCompany(company: InsertCompany): Promise<Company> {
    const [result] = await db
      .insert(schema.companies)
      .values({ ...company, lastSyncedAt: new Date() })
      .onConflictDoUpdate({
        target: schema.companies.id,
        set: { ...company, lastSyncedAt: new Date() },
      })
      .returning();
    return result;
  }

  async upsertCompanies(companies: InsertCompany[]): Promise<Company[]> {
    if (companies.length === 0) return [];
    
    const results = await Promise.all(companies.map((c) => this.upsertCompany(c)));
    return results;
  }

  async softDeleteCompany(id: string): Promise<void> {
    await db
      .update(schema.companies)
      .set({ isDeleted: true, lastSyncedAt: new Date() })
      .where(eq(schema.companies.id, id));
  }

  async getCheckIn(id: string): Promise<CheckIn | undefined> {
    const [checkIn] = await db.select().from(schema.checkIns).where(eq(schema.checkIns.id, id));
    return checkIn;
  }

  async getCheckInsByUser(userId: string): Promise<CheckIn[]> {
    return await db
      .select()
      .from(schema.checkIns)
      .where(eq(schema.checkIns.userId, userId))
      .orderBy(desc(schema.checkIns.timestamp));
  }

  async getCheckInsByDate(userId: string, date: string): Promise<CheckIn[]> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    return await db
      .select()
      .from(schema.checkIns)
      .where(
        and(
          eq(schema.checkIns.userId, userId),
          gte(schema.checkIns.timestamp, startOfDay),
          lte(schema.checkIns.timestamp, endOfDay)
        )
      )
      .orderBy(desc(schema.checkIns.timestamp));
  }

  async createCheckIn(insertCheckIn: InsertCheckIn): Promise<CheckIn> {
    const [checkIn] = await db.insert(schema.checkIns).values(insertCheckIn).returning();
    return checkIn;
  }

  async updateCheckIn(id: string, updates: Partial<CheckIn>): Promise<CheckIn> {
    const [checkIn] = await db
      .update(schema.checkIns)
      .set(updates)
      .where(eq(schema.checkIns.id, id))
      .returning();
    
    if (!checkIn) throw new Error("Check-in not found");
    return checkIn;
  }

  async getRoute(id: string): Promise<Route | undefined> {
    const [route] = await db.select().from(schema.routes).where(eq(schema.routes.id, id));
    return route;
  }

  async getActiveRoute(userId: string): Promise<Route | undefined> {
    const [route] = await db
      .select()
      .from(schema.routes)
      .where(and(eq(schema.routes.userId, userId), eq(schema.routes.status, "active")))
      .orderBy(desc(schema.routes.createdAt))
      .limit(1);
    return route;
  }

  async getRoutesByUser(userId: string, status?: string): Promise<Route[]> {
    if (status) {
      return await db
        .select()
        .from(schema.routes)
        .where(and(eq(schema.routes.userId, userId), eq(schema.routes.status, status)))
        .orderBy(desc(schema.routes.createdAt));
    }
    return await db
      .select()
      .from(schema.routes)
      .where(eq(schema.routes.userId, userId))
      .orderBy(desc(schema.routes.createdAt));
  }

  async createRoute(insertRoute: InsertRoute): Promise<Route> {
    const [route] = await db.insert(schema.routes).values(insertRoute).returning();
    return route;
  }

  async updateRoute(id: string, updates: Partial<Route>): Promise<Route> {
    const [route] = await db
      .update(schema.routes)
      .set(updates)
      .where(eq(schema.routes.id, id))
      .returning();
    
    if (!route) throw new Error("Route not found");
    return route;
  }

  async deleteRoute(id: string): Promise<void> {
    await db.delete(schema.routes).where(eq(schema.routes.id, id));
  }

  async getRouteStops(routeId: string): Promise<RouteStop[]> {
    return await db
      .select()
      .from(schema.routeStops)
      .where(eq(schema.routeStops.routeId, routeId))
      .orderBy(schema.routeStops.stopIndex);
  }

  async createRouteStop(insertStop: InsertRouteStop): Promise<RouteStop> {
    const [stop] = await db.insert(schema.routeStops).values(insertStop).returning();
    return stop;
  }

  async createRouteStops(stops: InsertRouteStop[]): Promise<RouteStop[]> {
    if (stops.length === 0) return [];
    const results = await db.insert(schema.routeStops).values(stops).returning();
    return results;
  }

  async updateRouteStop(id: string, updates: Partial<RouteStop>): Promise<RouteStop> {
    const [stop] = await db
      .update(schema.routeStops)
      .set(updates)
      .where(eq(schema.routeStops.id, id))
      .returning();
    
    if (!stop) throw new Error("Route stop not found");
    return stop;
  }

  async deleteRouteStops(routeId: string): Promise<void> {
    await db.delete(schema.routeStops).where(eq(schema.routeStops.routeId, routeId));
  }

  async createSyncLog(insertLog: InsertSyncLog): Promise<SyncLog> {
    const [log] = await db.insert(schema.syncLogs).values(insertLog).returning();
    return log;
  }

  async updateSyncLog(id: string, updates: Partial<SyncLog>): Promise<SyncLog> {
    const [log] = await db
      .update(schema.syncLogs)
      .set(updates)
      .where(eq(schema.syncLogs.id, id))
      .returning();
    
    if (!log) throw new Error("Sync log not found");
    return log;
  }

  async getLatestSyncLog(): Promise<SyncLog | undefined> {
    const [log] = await db
      .select()
      .from(schema.syncLogs)
      .orderBy(desc(schema.syncLogs.startedAt))
      .limit(1);
    return log;
  }
}

export const storage = new DbStorage();
