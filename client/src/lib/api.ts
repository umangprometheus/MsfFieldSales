import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient, getQueryFn } from "./queryClient";
import type { 
  CompanyWithDistance,
  BuildRouteRequest,
  BuildRouteResponse,
  CheckInRequest,
  CheckInResponse,
  SummaryResponse 
} from "@shared/schema";

// ============================================================================
// Auth API
// ============================================================================

export function useCurrentUser() {
  return useQuery({
    queryKey: ["/api/auth/me"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    retry: false,
  });
}

export function useLogout() {
  return useMutation({
    mutationFn: () => apiRequest("POST", "/api/auth/logout", {}),
    onSuccess: () => {
      queryClient.clear();
      window.location.href = "/login";
    },
  });
}

// ============================================================================
// Companies API
// ============================================================================

export function useCompanies(params: {
  lat?: number;
  lng?: number;
  radiusMi?: number;
  ownerOnly?: boolean;
  search?: string;
  enabled?: boolean;
}) {
  const queryParams = new URLSearchParams();
  if (params.lat !== undefined) queryParams.set("lat", params.lat.toString());
  if (params.lng !== undefined) queryParams.set("lng", params.lng.toString());
  if (params.radiusMi !== undefined) queryParams.set("radiusMi", params.radiusMi.toString());
  if (params.ownerOnly !== undefined) queryParams.set("ownerOnly", params.ownerOnly.toString());
  if (params.search) queryParams.set("search", params.search);

  return useQuery<{ companies: CompanyWithDistance[] }>({
    queryKey: ["/api/companies", params],
    queryFn: async () => {
      const response = await fetch(`/api/companies?${queryParams}`);
      if (!response.ok) throw new Error("Failed to fetch companies");
      return response.json();
    },
    enabled: (params.lat !== undefined && params.lng !== undefined) && (params.enabled !== false),
  });
}

export function useSyncCompanies() {
  return useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/sync", {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
    },
  });
}

// ============================================================================
// Route API
// ============================================================================

export function useBuildRoute() {
  return useMutation<BuildRouteResponse, Error, BuildRouteRequest>({
    mutationFn: async (data) => {
      console.log('[API] Building route with:', data);
      const res = await apiRequest("POST", "/api/route", data);
      const json = await res.json();
      
      // Validate response matches schema
      const { buildRouteResponseSchema } = await import("@shared/schema");
      const result = buildRouteResponseSchema.parse(json);
      
      console.log('[API] Route response:', result);
      return result;
    },
  });
}

// ============================================================================
// Check-In API
// ============================================================================

export function useCheckIn() {
  return useMutation<CheckInResponse, Error, CheckInRequest>({
    mutationFn: async (data) => {
      const res = await apiRequest("POST", "/api/checkins", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/summary"] });
    },
  });
}

// ============================================================================
// Summary API
// ============================================================================

export function useSummary(date: string) {
  return useQuery<SummaryResponse>({
    queryKey: ["/api/summary", date],
    queryFn: async () => {
      const response = await fetch(`/api/summary?date=${date}`);
      if (!response.ok) throw new Error("Failed to fetch summary");
      return response.json();
    },
  });
}
