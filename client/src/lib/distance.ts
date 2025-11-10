// Distance conversion utilities for US imperial units

// Constants
const METERS_TO_FEET = 3.28084;
const FEET_TO_MILES = 1 / 5280;
const PROXIMITY_THRESHOLD_FEET = 800; // 800 feet proximity detection
export const PROXIMITY_THRESHOLD_METERS = PROXIMITY_THRESHOLD_FEET / METERS_TO_FEET; // ~243.84 meters

/**
 * Convert meters to feet
 */
export function metersToFeet(meters: number): number {
  return meters * METERS_TO_FEET;
}

/**
 * Convert meters to miles
 */
export function metersToMiles(meters: number): number {
  return meters * METERS_TO_FEET * FEET_TO_MILES;
}

/**
 * Format distance for display: feet when < 0.5 miles, otherwise miles
 */
export function formatDistance(meters: number): string {
  const feet = metersToFeet(meters);
  const miles = feet * FEET_TO_MILES;

  if (miles < 0.5) {
    // Show in feet for distances less than 0.5 miles
    if (feet < 100) {
      return "< 100 ft";
    }
    return `${Math.round(feet)} ft`;
  } else {
    // Show in miles for longer distances
    return `${miles.toFixed(1)} mi`;
  }
}

/**
 * Format distance with explicit "away" suffix
 */
export function formatDistanceAway(meters: number): string {
  return `${formatDistance(meters)} away`;
}
