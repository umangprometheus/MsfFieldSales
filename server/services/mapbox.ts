import axios from "axios";

const MAPBOX_TOKEN = process.env.MAPBOX_TOKEN;
const MAPBOX_API = "https://api.mapbox.com";

if (!MAPBOX_TOKEN) {
  console.warn("Warning: MAPBOX_TOKEN not set. Mapbox features will not work.");
}

// Geocode an address to lat/lng
export async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  if (!MAPBOX_TOKEN) {
    throw new Error("MAPBOX_TOKEN not configured");
  }

  try {
    const response = await axios.get(
      `${MAPBOX_API}/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json`,
      {
        params: {
          access_token: MAPBOX_TOKEN,
          limit: 1,
        },
      }
    );

    if (response.data.features && response.data.features.length > 0) {
      const [lng, lat] = response.data.features[0].center;
      return { lat, lng };
    }

    return null;
  } catch (error) {
    console.error("Geocoding error:", error);
    return null;
  }
}

// Reverse geocode lat/lng to address
export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  if (!MAPBOX_TOKEN) {
    throw new Error("MAPBOX_TOKEN not configured");
  }

  try {
    const response = await axios.get(
      `${MAPBOX_API}/geocoding/v5/mapbox.places/${lng},${lat}.json`,
      {
        params: {
          access_token: MAPBOX_TOKEN,
          limit: 1,
        },
      }
    );

    if (response.data.features && response.data.features.length > 0) {
      return response.data.features[0].place_name;
    }

    return null;
  } catch (error) {
    console.error("Reverse geocoding error:", error);
    return null;
  }
}

// Simple greedy optimization: start from origin, always pick nearest unvisited stop
function greedyOptimize(
  coordinates: Array<{ lat: number; lng: number }>,
  origin?: { lat: number; lng: number }
): number[] {
  if (!origin) {
    // No origin, return original order
    return coordinates.map((_, idx) => idx);
  }

  const unvisited = new Set(coordinates.map((_, idx) => idx));
  const order: number[] = [];
  let current = origin;

  while (unvisited.size > 0) {
    let nearest = -1;
    let nearestDist = Infinity;

    for (const idx of unvisited) {
      const coord = coordinates[idx];
      const dist = Math.sqrt(
        Math.pow(coord.lat - current.lat, 2) + Math.pow(coord.lng - current.lng, 2)
      );
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = idx;
      }
    }

    order.push(nearest);
    unvisited.delete(nearest);
    current = coordinates[nearest];
  }

  return order;
}

// Optimize route using Mapbox Directions API (free tier compatible)
export async function optimizeRoute(
  coordinates: Array<{ lat: number; lng: number }>,
  origin?: { lat: number; lng: number }
): Promise<{
  waypoints: Array<{
    waypointIndex: number;
    distanceFromPrevMi: number | null;
    etaFromPrevMin: number | null;
  }>;
  totalDistMi: number;
  totalEtaMin: number;
  routeGeometry: Array<{ lat: number; lng: number }>;
}> {
  if (!MAPBOX_TOKEN) {
    throw new Error("MAPBOX_TOKEN not configured");
  }

  if (coordinates.length < 2) {
    return {
      waypoints: coordinates.map((_, idx) => ({
        waypointIndex: idx,
        distanceFromPrevMi: null,
        etaFromPrevMin: null,
      })),
      totalDistMi: 0,
      totalEtaMin: 0,
      routeGeometry: coordinates,
    };
  }

  try {
    // Use greedy algorithm to optimize stop order based on proximity
    const optimizedOrder = greedyOptimize(coordinates, origin);
    const orderedCoords = origin 
      ? [origin, ...optimizedOrder.map(idx => coordinates[idx])]
      : optimizedOrder.map(idx => coordinates[idx]);

    // Build route using Mapbox Directions API (supports up to 25 waypoints on free tier)
    const coordsString = orderedCoords.map(c => `${c.lng},${c.lat}`).join(';');
    const url = `${MAPBOX_API}/directions/v5/mapbox/driving/${coordsString}`;
    
    console.log('[Mapbox] Building route with', coordinates.length, 'stops, origin:', origin ? 'YES' : 'NO');
    const response = await axios.get(url, {
      params: {
        access_token: MAPBOX_TOKEN,
        geometries: 'geojson',
        overview: 'full',
        steps: false,
      },
    });

    if (response.data.routes && response.data.routes.length > 0) {
      const route = response.data.routes[0];
      console.log('[Mapbox] Route object keys:', Object.keys(route));
      console.log('[Mapbox] Route distance:', route.distance, 'duration:', route.duration);
      
      // Extract route geometry
      const routeGeometry: Array<{ lat: number; lng: number }> = [];
      if (route.geometry && route.geometry.coordinates) {
        route.geometry.coordinates.forEach((coord: [number, number]) => {
          routeGeometry.push({ lng: coord[0], lat: coord[1] });
        });
        console.log('[Mapbox] Route geometry points:', routeGeometry.length);
      }

      // Calculate distances and times for each leg
      const waypoints: Array<{ waypointIndex: number; distanceFromPrevMi: number | null; etaFromPrevMin: number | null; }> = [];
      
      for (let i = 0; i < optimizedOrder.length; i++) {
        const legIndex = origin ? i : (i > 0 ? i - 1 : 0);
        const leg = route.legs[legIndex];
        
        waypoints.push({
          waypointIndex: optimizedOrder[i],
          distanceFromPrevMi: leg ? leg.distance * 0.000621371 : null,
          etaFromPrevMin: leg ? leg.duration / 60 : null,
        });
      }

      const totalDistMi = route.distance ? route.distance * 0.000621371 : 0;
      const totalEtaMin = route.duration ? route.duration / 60 : 0;
      
      console.log('[Mapbox] Route stats - Distance:', totalDistMi.toFixed(2), 'mi, ETA:', totalEtaMin.toFixed(1), 'min');

      return {
        waypoints,
        totalDistMi,
        totalEtaMin,
        routeGeometry,
      };
    }

    throw new Error('No routes found');
  } catch (error: any) {
    console.error("[Mapbox] Route building error:", error.response?.data || error.message || error);
    
    // Fallback: return original order with no metrics
    return {
      waypoints: coordinates.map((_, idx) => ({
        waypointIndex: idx,
        distanceFromPrevMi: null,
        etaFromPrevMin: null,
      })),
      totalDistMi: 0,
      totalEtaMin: 0,
      routeGeometry: coordinates,
    };
  }
}

// Get simple route between two points
export async function getRoute(
  start: { lat: number; lng: number },
  end: { lat: number; lng: number }
): Promise<{
  distanceMeters: number;
  durationSeconds: number;
}> {
  if (!MAPBOX_TOKEN) {
    throw new Error("MAPBOX_TOKEN not configured");
  }

  try {
    const response = await axios.get(
      `${MAPBOX_API}/directions/v5/mapbox/driving/${start.lng},${start.lat};${end.lng},${end.lat}`,
      {
        params: {
          access_token: MAPBOX_TOKEN,
          geometries: "geojson",
        },
      }
    );

    if (response.data.routes && response.data.routes.length > 0) {
      const route = response.data.routes[0];
      return {
        distanceMeters: route.distance,
        durationSeconds: route.duration,
      };
    }

    return { distanceMeters: 0, durationSeconds: 0 };
  } catch (error) {
    console.error("Route calculation error:", error);
    return { distanceMeters: 0, durationSeconds: 0 };
  }
}
