import * as turf from "@turf/turf";
import { distance } from "@turf/distance";

// Calculate distance between two points in miles using Turf.js
export function calculateDistanceMiles(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const from = turf.point([lng1, lat1]);
  const to = turf.point([lng2, lat2]);
  const distanceKm = distance(from, to, { units: "kilometers" });
  return distanceKm * 0.621371; // Convert km to miles
}

// Calculate distance in meters
export function calculateDistanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const from = turf.point([lng1, lat1]);
  const to = turf.point([lng2, lat2]);
  return distance(from, to, { units: "meters" });
}

// Filter companies within a radius
export function filterByRadius(
  companies: Array<{ lat: number | null; lng: number | null; [key: string]: any }>,
  centerLat: number,
  centerLng: number,
  radiusMiles: number
): Array<{ distanceMi: number; [key: string]: any }> {
  const center = turf.point([centerLng, centerLat]);
  const radiusKm = radiusMiles * 1.60934; // Convert miles to km

  return companies
    .filter((company) => company.lat !== null && company.lng !== null)
    .map((company) => {
      const point = turf.point([company.lng!, company.lat!]);
      const distanceKm = distance(center, point, { units: "kilometers" });
      const distanceMi = distanceKm * 0.621371;

      return {
        ...company,
        distanceMi,
      };
    })
    .filter((company) => company.distanceMi <= radiusMiles)
    .sort((a, b) => a.distanceMi - b.distanceMi);
}

// Build address string from company
export function buildAddressString(company: {
  street?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  country?: string | null;
}): string {
  const parts = [
    company.street,
    company.city,
    company.state,
    company.postalCode,
    company.country,
  ].filter(Boolean);

  return parts.join(", ");
}

// Order stops by nearest neighbor (fallback if Mapbox optimization fails)
export function orderByNearestNeighbor(
  stops: Array<{ lat: number; lng: number; [key: string]: any }>,
  startLat?: number,
  startLng?: number
): Array<{ [key: string]: any }> {
  if (stops.length === 0) return [];
  if (stops.length === 1) return stops;

  const ordered: any[] = [];
  const remaining = [...stops];

  // Start from given position or first stop
  let current = startLat !== undefined && startLng !== undefined
    ? { lat: startLat, lng: startLng }
    : remaining.shift()!;

  if (current && "companyId" in current) {
    ordered.push(current);
  }

  while (remaining.length > 0) {
    let nearestIndex = 0;
    let nearestDistance = Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const dist = calculateDistanceMiles(
        current.lat,
        current.lng,
        remaining[i].lat,
        remaining[i].lng
      );

      if (dist < nearestDistance) {
        nearestDistance = dist;
        nearestIndex = i;
      }
    }

    current = remaining.splice(nearestIndex, 1)[0];
    ordered.push(current);
  }

  return ordered;
}
