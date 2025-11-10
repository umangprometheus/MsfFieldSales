import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import MapView from "@/components/map-view";
import RadiusPicker from "@/components/radius-picker";
import CompanyList from "@/components/company-list";
import LocationSearch from "@/components/location-search";
import { useCompanies, useSyncCompanies, useBuildRoute } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { MapIcon, List, Route, Loader2, RefreshCw } from "lucide-react";
import type { BuildRouteResponse } from "@shared/schema";

export default function PlanPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [radiusMi, setRadiusMi] = useState(25);
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<"map" | "list">("map");
  const [showResumeDialog, setShowResumeDialog] = useState(false);
  const [activeRouteData, setActiveRouteData] = useState<any | null>(null);
  const [clickedCompanyId, setClickedCompanyId] = useState<string | null>(null);

  const { data, isLoading, refetch } = useCompanies({
    lat: userLocation?.lat,
    lng: userLocation?.lng,
    radiusMi,
    ownerOnly: true,
  });

  const syncMutation = useSyncCompanies();
  const buildRouteMutation = useBuildRoute();

  const companies = data?.companies || [];

  // Try to get GPS location on mount
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          console.log("GPS error:", error);
          // Default to Memphis if GPS fails
          setUserLocation({ lat: 35.1495, lng: -90.0490 });
        },
        { enableHighAccuracy: false, timeout: 5000 }
      );
    } else {
      setUserLocation({ lat: 35.1495, lng: -90.0490 });
    }
  }, []);

  // Check for active route on mount
  useEffect(() => {
    const checkActiveRoute = async () => {
      // First check localStorage
      const stored = localStorage.getItem("activeRoute");
      if (stored) {
        const data = JSON.parse(stored);
        setActiveRouteData(data);
        setShowResumeDialog(true);
        return;
      }

      // Then check database
      try {
        const response = await fetch('/api/route/active', {
          credentials: 'include',
        });
        
        if (response.ok) {
          const activeRoute = await response.json();
          setActiveRouteData(activeRoute);
          setShowResumeDialog(true);
        }
      } catch (error) {
        // No active route, which is fine
        console.log('No active route found');
      }
    };

    checkActiveRoute();
  }, []);

  const handleToggleCompany = (companyId: string) => {
    setSelectedCompanyIds((prev) =>
      prev.includes(companyId) ? prev.filter((id) => id !== companyId) : [...prev, companyId]
    );
  };

  const handleSync = async () => {
    try {
      await syncMutation.mutateAsync();
      toast({
        title: "Sync complete",
        description: "Companies have been updated from HubSpot",
      });
      refetch();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Sync failed",
        description: "Unable to sync companies. Please try again.",
      });
    }
  };

  const handleResumeRoute = () => {
    if (activeRouteData) {
      // Store in localStorage if it came from database
      const stored = localStorage.getItem("activeRoute");
      if (!stored) {
        // Generate simple route geometry from stops (fallback for DB routes without geometry)
        const routeGeometry = activeRouteData.stops.map((s: any) => ({ lat: s.lat, lng: s.lng }));
        
        // Convert database format to BuildRouteResponse format
        const routeResponse: BuildRouteResponse = {
          routeId: activeRouteData.id,
          stops: activeRouteData.stops,
          totalDistMi: activeRouteData.totalDistanceMi,
          totalEtaMin: activeRouteData.totalEtaMin,
          navUrl: `https://www.google.com/maps/dir/?api=1&waypoints=${activeRouteData.stops.map((s: any) => `${s.lat},${s.lng}`).join('|')}&travelmode=driving`,
          routeGeometry, // Simple geometry from stop coordinates
        };
        localStorage.setItem("activeRoute", JSON.stringify(routeResponse));
      }
      navigate("/route");
    }
    setShowResumeDialog(false);
  };

  const handleStartNewRoute = async () => {
    if (activeRouteData) {
      // Mark current route as completed
      const routeId = activeRouteData.id || activeRouteData.routeId;
      if (routeId) {
        try {
          await fetch(`/api/route/${routeId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'completed' }),
          });
        } catch (error) {
          console.error('Failed to mark route as completed:', error);
        }
      }
      localStorage.removeItem("activeRoute");
    }
    setShowResumeDialog(false);
    setActiveRouteData(null);
  };

  const handleBuildRoute = async () => {
    if (selectedCompanyIds.length === 0) {
      toast({
        variant: "destructive",
        title: "No companies selected",
        description: "Please select at least 2 companies to build a route.",
      });
      return;
    }

    if (selectedCompanyIds.length < 2) {
      toast({
        variant: "destructive",
        title: "Not enough stops",
        description: "Please select at least 2 companies to build a route.",
      });
      return;
    }

    // Check if there's already an active route
    const existingRoute = localStorage.getItem("activeRoute");
    if (existingRoute) {
      try {
        const routeData = JSON.parse(existingRoute);
        setActiveRouteData(routeData);
        setShowResumeDialog(true);
        return;
      } catch (error) {
        // Invalid data, clear it
        localStorage.removeItem("activeRoute");
      }
    }

    try {
      const result = await buildRouteMutation.mutateAsync({
        origin: userLocation || "gps",
        companyIds: selectedCompanyIds,
        optimize: true,
      });

      console.log('[Plan] Route built successfully:', result);

      // Validate response structure
      if (!result || !result.stops || !Array.isArray(result.stops)) {
        throw new Error('Invalid route response format');
      }

      // Store route in localStorage for route page
      localStorage.setItem("activeRoute", JSON.stringify(result));
      
      toast({
        title: "Route created!",
        description: `${result.stops.length} stops • ${result.totalDistMi.toFixed(1)} mi • ${Math.round(result.totalEtaMin)} min`,
      });

      navigate("/route");
    } catch (error: any) {
      console.error('[Plan] Route building failed:', error);
      toast({
        variant: "destructive",
        title: "Route building failed",
        description: error?.message || "Unable to build route. Please try again.",
      });
    }
  };

  return (
    <div className="fixed inset-0 flex flex-col bg-background overflow-hidden">
      {/* Header */}
      <header className="pt-safe px-4 flex items-center justify-between border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 min-h-[56px] flex-shrink-0">
        <h1 className="text-lg font-semibold text-foreground">Plan Route</h1>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={handleSync}
          disabled={syncMutation.isPending}
          data-testid="button-sync"
        >
          {syncMutation.isPending ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4 mr-2" />
          )}
          Sync
        </Button>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Map Section */}
        <div className="flex-1 relative">
          <MapView
            companies={companies}
            userLocation={userLocation}
            selectedCompanyIds={selectedCompanyIds}
            onCompanyClick={(id) => {
              console.log('[Plan] onCompanyClick called with:', id, 'Currently selected:', selectedCompanyIds);
              if (!selectedCompanyIds.includes(id)) {
                console.log('[Plan] Adding company to selection');
                setSelectedCompanyIds([...selectedCompanyIds, id]);
              } else {
                console.log('[Plan] Company already selected, toggling off');
                setSelectedCompanyIds(selectedCompanyIds.filter(cid => cid !== id));
              }
            }}
            onCompanyInfo={(id) => {
              setClickedCompanyId(id);
            }}
          />

          {/* Bottom Sheet - Company Info */}
          {clickedCompanyId && (() => {
            const company = companies.find(c => c.id === clickedCompanyId);
            if (!company) return null;
            
            return (
              <div 
                className="md:hidden absolute bottom-0 left-0 right-0 bg-background border-t shadow-2xl rounded-t-2xl z-40 animate-in slide-in-from-bottom duration-200 pointer-events-auto"
                data-testid="company-info-sheet"
              >
                <div className="p-4">
                  {/* Drag Handle */}
                  <div className="flex justify-center mb-3">
                    <button
                      onClick={() => setClickedCompanyId(null)}
                      className="w-12 h-1 bg-muted-foreground/30 rounded-full hover:bg-muted-foreground/50 transition-colors"
                      aria-label="Close"
                    />
                  </div>
                  
                  {/* Company Info */}
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="text-base font-semibold text-foreground">{company.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {company.city}, {company.state}
                        </p>
                        {company.distanceMi && (
                          <p className="text-sm text-primary font-medium mt-1">
                            {company.distanceMi.toFixed(1)} mi away
                          </p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setClickedCompanyId(null)}
                        data-testid="button-close-info"
                      >
                        ✕
                      </Button>
                    </div>
                    
                    {/* Action Button */}
                    <Button
                      className="w-full min-h-[44px]"
                      variant={selectedCompanyIds.includes(company.id) ? "secondary" : "default"}
                      onClick={() => {
                        handleToggleCompany(company.id);
                      }}
                      data-testid="button-toggle-selection"
                    >
                      {selectedCompanyIds.includes(company.id) ? "Remove from Route" : "Add to Route"}
                    </Button>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Floating Controls - Mobile */}
          <div className="md:hidden absolute top-4 left-4 right-4 z-10">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "map" | "list")} className="w-full">
              <TabsList className="grid w-full grid-cols-2 bg-background/90 backdrop-blur min-h-[48px]">
                <TabsTrigger value="map" data-testid="tab-map" className="min-h-[44px] text-base">
                  <MapIcon className="w-5 h-5 mr-2" />
                  Map
                </TabsTrigger>
                <TabsTrigger value="list" data-testid="tab-list" className="min-h-[44px] text-base">
                  <List className="w-5 h-5 mr-2" />
                  List
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Floating Build Route Button - Mobile Map View */}
          {selectedCompanyIds.length > 0 && activeTab === "map" && (
            <div 
              className={`md:hidden absolute left-4 right-4 z-50 transition-all duration-200 ${
                clickedCompanyId ? 'bottom-44' : 'bottom-24'
              }`}
            >
              <Button
                onClick={handleBuildRoute}
                className="w-full h-14 text-base font-semibold shadow-xl"
                disabled={selectedCompanyIds.length < 2 || buildRouteMutation.isPending}
                data-testid="button-build-route-mobile"
              >
                {buildRouteMutation.isPending ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Building Route...
                  </>
                ) : (
                  <>
                    <Route className="w-5 h-5 mr-2" />
                    Build Route ({selectedCompanyIds.length} stops)
                  </>
                )}
              </Button>
            </div>
          )}
        </div>

        {/* Controls Panel - Desktop or Mobile Sheet */}
        <div className={`${activeTab === "list" || window.innerWidth >= 768 ? "block" : "hidden"} md:block md:w-96 bg-background border-l overflow-y-auto`}>
          <div className="p-4 space-y-6">
            {/* Location Search */}
            <Card className="p-4">
              <h3 className="text-sm font-semibold text-foreground mb-3">Starting Location</h3>
              <LocationSearch onLocationSelect={(lat, lng) => setUserLocation({ lat, lng })} />
            </Card>

            {/* Radius Picker */}
            <Card className="p-4">
              <RadiusPicker value={radiusMi} onChange={setRadiusMi} />
            </Card>

            {/* Company List */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-foreground">
                  {isLoading ? (
                    <Skeleton className="h-4 w-32" />
                  ) : (
                    `Nearby Companies (${companies.length})`
                  )}
                </h3>
                {selectedCompanyIds.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedCompanyIds([])}
                    data-testid="button-clear-selection"
                  >
                    Clear
                  </Button>
                )}
              </div>

              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-20 w-full" />
                  ))}
                </div>
              ) : (
                <CompanyList
                  companies={companies}
                  selectedIds={selectedCompanyIds}
                  onToggle={handleToggleCompany}
                  onCompanyClick={(id) => {
                    if (!selectedCompanyIds.includes(id)) {
                      setSelectedCompanyIds([...selectedCompanyIds, id]);
                    }
                  }}
                />
              )}
            </div>

            {/* Build Route Button */}
            {selectedCompanyIds.length > 0 && (
              <div className="sticky bottom-0 pt-4 pb-2 bg-background">
                <Button
                  onClick={handleBuildRoute}
                  className="w-full h-12 text-base font-semibold"
                  disabled={selectedCompanyIds.length === 0 || buildRouteMutation.isPending}
                  data-testid="button-build-route"
                >
                  {buildRouteMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Building Route...
                    </>
                  ) : (
                    <>
                      <Route className="w-4 h-4 mr-2" />
                      Build Route ({selectedCompanyIds.length} stops)
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Resume Route Dialog */}
      <AlertDialog open={showResumeDialog} onOpenChange={setShowResumeDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Active Route Found</AlertDialogTitle>
            <AlertDialogDescription>
              You have an active route in progress.{" "}
              {activeRouteData?.stops && (
                <>
                  It has {activeRouteData.stops.length} stop{activeRouteData.stops.length > 1 ? 's' : ''} 
                  {activeRouteData.stops.filter((s: any) => s.completed).length > 0 && (
                    <> ({activeRouteData.stops.filter((s: any) => s.completed).length} completed)</>
                  )}.
                </>
              )}
              {" "}Would you like to resume it or start a new route?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleStartNewRoute} data-testid="button-start-new">
              Start New Route
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleResumeRoute} data-testid="button-resume-route">
              Resume Route
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
