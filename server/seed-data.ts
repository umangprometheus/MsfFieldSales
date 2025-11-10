import { storage } from "./storage";
import type { InsertCompany } from "@shared/schema";

// Demo companies in Memphis, TN for testing
const demoCompanies: InsertCompany[] = [
  {
    id: "demo-1",
    name: "Beale Street Music Shop",
    street: "143 Beale Street",
    city: "Memphis",
    state: "TN",
    postalCode: "38103",
    country: "US",
    ownerId: "demo-owner",
    lat: 35.1398,
    lng: -90.0513,
  },
  {
    id: "demo-2",
    name: "Sun Studio Records",
    street: "706 Union Avenue",
    city: "Memphis",
    state: "TN",
    postalCode: "38103",
    country: "US",
    ownerId: "demo-owner",
    lat: 35.1446,
    lng: -90.0281,
  },
  {
    id: "demo-3",
    name: "Graceland Visitor Center",
    street: "3734 Elvis Presley Boulevard",
    city: "Memphis",
    state: "TN",
    postalCode: "38116",
    country: "US",
    ownerId: "demo-owner",
    lat: 35.0478,
    lng: -90.0260,
  },
  {
    id: "demo-4",
    name: "Memphis Zoo",
    street: "2000 Prentiss Place",
    city: "Memphis",
    state: "TN",
    postalCode: "38112",
    country: "US",
    ownerId: "demo-owner",
    lat: 35.1391,
    lng: -89.9937,
  },
  {
    id: "demo-5",
    name: "National Civil Rights Museum",
    street: "450 Mulberry Street",
    city: "Memphis",
    state: "TN",
    postalCode: "38103",
    country: "US",
    ownerId: "demo-owner",
    lat: 35.1344,
    lng: -90.0575,
  },
  {
    id: "demo-6",
    name: "AutoZone Park",
    street: "200 Union Avenue",
    city: "Memphis",
    state: "TN",
    postalCode: "38103",
    country: "US",
    ownerId: "demo-owner",
    lat: 35.1390,
    lng: -90.0504,
  },
  {
    id: "demo-7",
    name: "Memphis Brooks Museum of Art",
    street: "1934 Poplar Avenue",
    city: "Memphis",
    state: "TN",
    postalCode: "38104",
    country: "US",
    ownerId: "demo-owner",
    lat: 35.1563,
    lng: -89.9940,
  },
  {
    id: "demo-8",
    name: "Stax Museum",
    street: "926 E McLemore Avenue",
    city: "Memphis",
    state: "TN",
    postalCode: "38106",
    country: "US",
    ownerId: "demo-owner",
    lat: 35.1014,
    lng: -90.0256,
  },
  {
    id: "demo-9",
    name: "Memphis Botanic Garden",
    street: "750 Cherry Road",
    city: "Memphis",
    state: "TN",
    postalCode: "38117",
    country: "US",
    ownerId: "demo-owner",
    lat: 35.1425,
    lng: -89.9142,
  },
  {
    id: "demo-10",
    name: "Shelby Farms Park",
    street: "6903 Great View Drive North",
    city: "Memphis",
    state: "TN",
    postalCode: "38134",
    country: "US",
    ownerId: "demo-owner",
    lat: 35.1686,
    lng: -89.8575,
  },
];

export async function seedDemoCompanies() {
  console.log("[Seed] Adding demo companies for testing...");
  
  try {
    await storage.upsertCompanies(demoCompanies);
    console.log(`[Seed] ✅ Added ${demoCompanies.length} demo companies in Memphis, TN`);
  } catch (error) {
    console.error("[Seed] Error seeding demo companies:", error);
  }
}
