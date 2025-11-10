import { storage } from "../storage";
import { fetchHubSpotCompanies } from "./hubspot";
import { geocodeAddress } from "./mapbox";
import { buildAddressString } from "./geo";
import type { InsertCompany } from "@shared/schema";

// Sync companies from HubSpot to local cache
export async function syncCompanies(ownerId?: string): Promise<number> {
  // Skip sync if HubSpot is not configured
  if (!process.env.HUBSPOT_API_KEY) {
    console.log("[Sync] Skipping HubSpot sync - no API key configured (using demo data)");
    return 0;
  }
  
  console.log(`[Sync] Starting company sync${ownerId ? ` for owner ${ownerId}` : " (all companies)"}...`);

  try {
    const hubspotCompanies = await fetchHubSpotCompanies(ownerId);
    console.log(`[Sync] Fetched ${hubspotCompanies.length} companies from HubSpot`);

    const companiesToCache: InsertCompany[] = [];

    for (const hsCompany of hubspotCompanies) {
      const props = hsCompany.properties;
      
      // Build address for geocoding
      const addressString = buildAddressString({
        street: props.address || props.address2,
        city: props.city,
        state: props.state,
        postalCode: props.zip,
        country: props.country || "US",
      });

      // Check if we already have geocoded this company
      const existing = await storage.getCompany(hsCompany.id);
      let lat = existing?.lat || null;
      let lng = existing?.lng || null;

      // Geocode if we don't have coordinates and have an address
      if ((!lat || !lng) && addressString) {
        console.log(`[Sync] Geocoding: ${props.name} - ${addressString}`);
        const coords = await geocodeAddress(addressString);
        if (coords) {
          lat = coords.lat;
          lng = coords.lng;
        }

        // Add small delay to respect rate limits (Mapbox: 600/min = ~100ms)
        await new Promise((resolve) => setTimeout(resolve, 150));
      }

      companiesToCache.push({
        id: hsCompany.id,
        name: props.name || "Unknown Company",
        street: props.address || props.address2 || null,
        city: props.city || null,
        state: props.state || null,
        postalCode: props.zip || null,
        country: props.country || null,
        ownerId: props.hubspot_owner_id || null,
        lat,
        lng,
      });
    }

    // Batch upsert all companies
    await storage.upsertCompanies(companiesToCache);
    
    console.log(`[Sync] Successfully synced ${companiesToCache.length} companies`);
    return companiesToCache.length;
  } catch (error) {
    console.error("[Sync] Error syncing companies:", error);
    throw error;
  }
}

// Schedule periodic sync (called on server startup)
export function startPeriodicSync(intervalMinutes: number = 15) {
  console.log(`[Sync] Starting periodic sync every ${intervalMinutes} minutes`);

  // Run initial sync after 30 seconds
  setTimeout(() => {
    syncCompanies().catch((err) =>
      console.error("[Sync] Initial sync failed:", err)
    );
  }, 30000);

  // Then run every N minutes
  setInterval(() => {
    syncCompanies().catch((err) =>
      console.error("[Sync] Periodic sync failed:", err)
    );
  }, intervalMinutes * 60 * 1000);
}
