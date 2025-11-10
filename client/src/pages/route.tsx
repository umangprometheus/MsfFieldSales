import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import MapView from "@/components/map-view";
import RoutePanel from "@/components/route-panel";
import ProximityAlert from "@/components/proximity-alert";
import CheckInForm from "@/components/check-in-form";
import AddStopDialog from "@/components/add-stop-dialog";
import { useCheckIn } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, X, Plus, Navigation } from "lucide-react";
import type { RouteStop, BuildRouteResponse, Company } from "@shared/schema";
import { PROXIMITY_THRESHOLD_METERS } from "@/lib/distance";

export default function RoutePage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const checkInMutation = useCheckIn();
  
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [currentStopIndex, setCurrentStopIndex] = useState(0);
  const [showProximityAlert, setShowProximityAlert] = useState(false);
  const [showCheckInForm, setShowCheckInForm] = useState(false);
  const [distanceToCurrentStop, setDistanceToCurrentStop] = useState<number | null>(null);
  const [testMode, setTestMode] = useState(false);
  const [nearbyStopIndex, setNearbyStopIndex] = useState<number | null>(null);
  const [testLocationIndex, setTestLocationIndex] = useState<number | null>(null);
  const [showAddStopDialog, setShowAddStopDialog] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  
  // Load route from localStorage or database
  const [routeData, setRouteData] = useState<BuildRouteResponse | null>(null);

  useEffect(() => {
    const loadRoute = async () => {
      // First, check localStorage
      const stored = localStorage.getItem("activeRoute");
      if (stored) {
        const data: BuildRouteResponse = JSON.parse(stored);
        setRouteData(data);
        
        // Mark route as active in database
        if (data.routeId) {
          fetch(`/api/route/${data.routeId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'active' }),
          }).catch(err => console.error('Failed to mark route as active:', err));
        }
        return;
      }

      // If no localStorage, check database for active route
      try {
        const response = await fetch('/api/route/active', {
          credentials: 'include',
        });
        
        if (response.ok) {
          const activeRoute = await response.json();
          
          // Generate simple route geometry from stops (fallback for DB routes without geometry)
          const routeGeometry = activeRoute.stops.map((s: any) => ({ lat: s.lat, lng: s.lng }));
          
          // Convert database route format to BuildRouteResponse format
          const routeResponse: BuildRouteResponse = {
            routeId: activeRoute.id,
            stops: activeRoute.stops,
            totalDistMi: activeRoute.totalDistanceMi,
            totalEtaMin: activeRoute.totalEtaMin,
            navUrl: `https://www.google.com/maps/dir/?api=1&waypoints=${activeRoute.stops.map((s: any) => `${s.lat},${s.lng}`).join('|')}&travelmode=driving`,
            routeGeometry, // Simple geometry from stop coordinates
          };
          
          // Save to localStorage for performance
          localStorage.setItem("activeRoute", JSON.stringify(routeResponse));
          setRouteData(routeResponse);
          
          toast({
            title: "Route resumed",
            description: "Continuing your active route from another device",
          });
        } else {
          // No active route in localStorage or database
          toast({
            variant: "destructive",
            title: "No active route",
            description: "Please create a route first",
          });
          navigate("/plan");
        }
      } catch (error) {
        console.error('Failed to load active route:', error);
        toast({
          variant: "destructive",
          title: "No active route",
          description: "Please create a route first",
        });
        navigate("/plan");
      }
    };

    loadRoute();
  }, [navigate, toast]);

  const routeStops: RouteStop[] = routeData?.stops || [];

  // Watch user location (real GPS or test mode)
  useEffect(() => {
    // Test mode: simulate being at a specific stop
    if (testMode && routeStops.length > 0) {
      const targetIndex = testLocationIndex !== null ? testLocationIndex : currentStopIndex;
      if (targetIndex < routeStops.length) {
        const targetStop = routeStops[targetIndex];
        setUserLocation({
          lat: targetStop.lat,
          lng: targetStop.lng,
        });
        
        // Calculate distance to current stop for display
        if (currentStopIndex < routeStops.length) {
          const currentStop = routeStops[currentStopIndex];
          const distance = calculateDistance(
            targetStop.lat,
            targetStop.lng,
            currentStop.lat,
            currentStop.lng
          );
          setDistanceToCurrentStop(distance);
        }
        
        // Check all stops for proximity
        const distances = routeStops.map((stop, idx) => ({
          idx,
          distance: calculateDistance(targetStop.lat, targetStop.lng, stop.lat, stop.lng),
          completed: stop.completed,
        }));
        
        const nearbyUncompleted = distances
          .filter(d => !d.completed && d.distance <= PROXIMITY_THRESHOLD_METERS)
          .sort((a, b) => a.distance - b.distance);
        
        if (nearbyUncompleted.length > 0) {
          setNearbyStopIndex(nearbyUncompleted[0].idx);
          if (!showProximityAlert && !showCheckInForm) {
            setShowProximityAlert(true);
          }
        } else {
          setNearbyStopIndex(null);
          setShowProximityAlert(false);
        }
      }
      return;
    }

    // Real GPS mode
    if (!navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const newLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        setUserLocation(newLocation);

        // Check distance to ALL uncompleted stops (not just current one)
        let closestNearbyStop: { index: number; distance: number } | null = null as { index: number; distance: number } | null;
        
        routeStops.forEach((stop, idx) => {
          if (!stop.completed) {
            const distance = calculateDistance(
              newLocation.lat,
              newLocation.lng,
              stop.lat,
              stop.lng
            );
            
            // Track closest stop within proximity threshold (800 feet)
            if (distance <= PROXIMITY_THRESHOLD_METERS) {
              if (!closestNearbyStop || distance < closestNearbyStop.distance) {
                closestNearbyStop = { index: idx, distance };
              }
            }
          }
        });

        // Update nearby stop index to the closest one (or null if none nearby)
        if (closestNearbyStop) {
          setNearbyStopIndex(closestNearbyStop.index);
          // Show alert if not already showing and not in check-in form
          if (!showProximityAlert && !showCheckInForm) {
            setShowProximityAlert(true);
          }
        } else {
          // No stops nearby - clear state
          setNearbyStopIndex(null);
          setShowProximityAlert(false);
        }

        // Update distance to current stop for display purposes
        if (currentStopIndex < routeStops.length) {
          const currentStop = routeStops[currentStopIndex];
          const distance = calculateDistance(
            newLocation.lat,
            newLocation.lng,
            currentStop.lat,
            currentStop.lng
          );
          setDistanceToCurrentStop(distance);
        }
      },
      (error) => console.error("Geolocation error:", error),
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [testMode, testLocationIndex, currentStopIndex, routeStops, showProximityAlert, showCheckInForm]);

  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371000; // Earth's radius in meters
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const handleNavigate = (stop: RouteStop) => {
    const navUrl = `https://www.google.com/maps/dir/?api=1&destination=${stop.lat},${stop.lng}`;
    window.location.href = navUrl;
  };

  const handleCheckIn = () => {
    setShowProximityAlert(false);
    setShowCheckInForm(true);
  };

  const handleSubmitCheckIn = async (note: string) => {
    if (!userLocation || nearbyStopIndex === null) return;

    const checkedInStop = routeStops[nearbyStopIndex];

    try {
      await checkInMutation.mutateAsync({
        companyId: checkedInStop.companyId,
        lat: userLocation.lat,
        lng: userLocation.lng,
        note: note || undefined,
      });

      // Mark the nearby stop as completed
      const updatedStops = [...routeStops];
      updatedStops[nearbyStopIndex].completed = true;
      
      toast({
        title: "Check-in complete",
        description: `Logged visit to ${checkedInStop.name}`,
      });

      setShowCheckInForm(false);
      setNearbyStopIndex(null);

      // Re-optimize remaining stops
      await reoptimizeRoute(updatedStops);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Check-in failed",
        description: "Unable to log check-in. Please try again.",
      });
    }
  };

  const reoptimizeRoute = async (updatedStops: RouteStop[]) => {
    // Find remaining uncompleted stops
    const remaining = updatedStops.filter(stop => !stop.completed);
    
    if (remaining.length === 0) {
      // All stops completed
      if (routeData) {
        const updatedRoute = { ...routeData, stops: updatedStops };
        localStorage.setItem("activeRoute", JSON.stringify(updatedRoute));
        setRouteData(updatedRoute);
      }
      // Ensure currentStopIndex doesn't point past the end
      setCurrentStopIndex(updatedStops.length - 1);
      return;
    }

    // Re-build route with remaining stops, starting from current location
    try {
      const response = await fetch("/api/route", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          companyIds: remaining.map(s => s.companyId),
          origin: userLocation ? { lat: userLocation.lat, lng: userLocation.lng } : "gps",
          optimize: true,
        }),
      });

      if (!response.ok) throw new Error("Failed to re-optimize route");

      const optimizedRoute: BuildRouteResponse = await response.json();
      
      // Create a map of completed stops by companyId
      const completedMap = new Map<string, RouteStop>();
      updatedStops.forEach(stop => {
        if (stop.completed) {
          completedMap.set(stop.companyId, stop);
        }
      });

      // Merge: completed stops first, then optimized remaining stops (preserving completion status)
      const completedStops = updatedStops.filter(stop => stop.completed);
      const reoptimizedStops = optimizedRoute.stops.map(stop => {
        // Preserve completed flag if this stop was already completed
        const completed = completedMap.get(stop.companyId);
        return completed || stop;
      }).filter(stop => !stop.completed); // Filter out any duplicates that are completed

      const newStops = [
        ...completedStops,
        ...reoptimizedStops,
      ];

      const updatedRoute = {
        ...optimizedRoute,
        stops: newStops,
      };

      localStorage.setItem("activeRoute", JSON.stringify(updatedRoute));
      setRouteData(updatedRoute);
      
      // Update current stop index to first uncompleted stop
      const firstUncompletedIdx = newStops.findIndex(s => !s.completed);
      setCurrentStopIndex(firstUncompletedIdx !== -1 ? firstUncompletedIdx : 0);

      toast({
        title: "Route updated",
        description: `Re-optimized ${remaining.length} remaining stop${remaining.length > 1 ? 's' : ''}`,
      });
    } catch (error) {
      console.error("Failed to re-optimize route:", error);
      // Fallback: just update stops without re-optimization
      if (routeData) {
        const updatedRoute = { ...routeData, stops: updatedStops };
        localStorage.setItem("activeRoute", JSON.stringify(updatedRoute));
        setRouteData(updatedRoute);
        
        // Ensure currentStopIndex points to first uncompleted stop
        const firstUncompletedIdx = updatedStops.findIndex(s => !s.completed);
        setCurrentStopIndex(firstUncompletedIdx !== -1 ? firstUncompletedIdx : 0);
      }
    }
  };

  const handleEndRoute = async () => {
    // Mark route as completed in database
    if (routeData?.routeId) {
      try {
        await fetch(`/api/route/${routeData.routeId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            status: 'completed',
            stops: routeStops, // Save final stops state with completion flags
          }),
        });
      } catch (err) {
        console.error('Failed to mark route as completed:', err);
      }
    }
    
    localStorage.removeItem("activeRoute");
    navigate("/summary");
  };

  const handleAddStop = async (company: { id: string; name: string; street: string | null; city: string | null; state: string | null }) => {
    if (!routeData) return;

    try {
      // Get all remaining uncompleted stops + the new stop
      const remainingStops = routeStops.filter(s => !s.completed);
      const newCompanyIds = [...remainingStops.map(s => s.companyId), company.id];

      // Re-build route with all stops including the new one
      const response = await fetch("/api/route", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          companyIds: newCompanyIds,
          origin: userLocation ? { lat: userLocation.lat, lng: userLocation.lng } : "gps",
          optimize: true,
        }),
      });

      if (!response.ok) throw new Error("Failed to add stop to route");

      const optimizedRoute: BuildRouteResponse = await response.json();
      
      // Merge: completed stops first, then optimized stops (including new one)
      const completedStops = routeStops.filter(stop => stop.completed);
      const newStops = [
        ...completedStops,
        ...optimizedRoute.stops,
      ];

      const updatedRoute = {
        ...optimizedRoute,
        stops: newStops,
      };

      localStorage.setItem("activeRoute", JSON.stringify(updatedRoute));
      setRouteData(updatedRoute);
      
      // Update current stop index to first uncompleted stop
      const firstUncompletedIdx = newStops.findIndex(s => !s.completed);
      setCurrentStopIndex(firstUncompletedIdx !== -1 ? firstUncompletedIdx : 0);

      toast({
        title: "Stop added",
        description: `${company.name} added to route`,
      });
    } catch (error) {
      console.error("Failed to add stop:", error);
      toast({
        variant: "destructive",
        title: "Failed to add stop",
        description: "Unable to add stop to route. Please try again.",
      });
    }
  };

  const currentStop = routeStops[currentStopIndex];
  const isRouteComplete = currentStopIndex >= routeStops.length || routeStops.every(s => s.completed);

  return (
    <div className="fixed inset-0 flex flex-col bg-background overflow-hidden">
      {/* Header */}
      <header className="pt-safe px-2 sm:px-4 flex items-center justify-between border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 z-40 min-h-[56px] flex-shrink-0">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <Button 
            variant="ghost" 
            className="h-11 w-11 md:h-9 md:w-9"
            onClick={() => navigate("/plan")}
            data-testid="button-back"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-sm sm:text-lg font-semibold text-foreground truncate">Active Route</h1>
            <p className="text-xs text-muted-foreground">
              Stop {currentStopIndex + 1} of {routeStops.length}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          <Button 
            size="sm" 
            onClick={() => setShowAddStopDialog(true)}
            data-testid="button-add-stop"
            className="hidden sm:flex bg-success hover:bg-success/90 text-success-foreground"
          >
            <Plus className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Add Stop</span>
          </Button>
          <Button 
            className="h-11 w-11 sm:hidden bg-success hover:bg-success/90 text-success-foreground"
            onClick={() => setShowAddStopDialog(true)}
            data-testid="button-add-stop-mobile"
          >
            <Plus className="w-5 h-5" />
          </Button>
          <Button 
            variant={testMode ? "default" : "outline"}
            size="sm" 
            onClick={() => setTestMode(!testMode)}
            data-testid="button-test-mode"
            className="hidden sm:flex"
          >
            {testMode ? "Test Mode ON" : "Test Mode"}
          </Button>
          <Button 
            variant={testMode ? "default" : "outline"}
            className="h-11 w-11 sm:hidden"
            onClick={() => setTestMode(!testMode)}
            data-testid="button-test-mode-mobile"
            title={testMode ? "Test Mode ON - Tap to disable" : "Enable Test Mode"}
          >
            <span className="text-xs font-bold">{testMode ? "TEST" : "GPS"}</span>
          </Button>
          <Button 
            variant="ghost" 
            className="h-11 w-11 sm:hidden"
            onClick={handleEndRoute}
            data-testid="button-end-route"
          >
            <X className="w-4 h-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleEndRoute}
            data-testid="button-end-route-desktop"
            className="hidden sm:flex"
          >
            <X className="w-4 h-4 mr-2" />
            End Route
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Map Section */}
        <div className="flex-1 relative">
          <MapView
            companies={routeStops.map((s) => ({
              id: s.companyId,
              name: s.name,
              lat: s.lat,
              lng: s.lng,
              distanceMi: 0,
              street: s.street,
              city: s.city,
              state: s.state,
              postalCode: s.postalCode,
              country: null,
              ownerId: null,
              lastSyncedAt: new Date().toISOString(),
            }))}
            userLocation={userLocation}
            routeCoordinates={routeStops.map((s) => ({ lat: s.lat, lng: s.lng }))}
            routeGeometry={routeData?.routeGeometry}
            currentStopIndex={currentStopIndex}
          />

          {/* Distance indicator overlay */}
          {distanceToCurrentStop !== null && currentStop && !currentStop.completed && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10">
              <div className="bg-background/90 backdrop-blur px-4 py-2 rounded-full shadow-lg">
                <p className="text-sm font-semibold text-foreground">
                  {distanceToCurrentStop < 100 ? "< 100" : Math.round(distanceToCurrentStop)}m to {currentStop.name}
                </p>
              </div>
            </div>
          )}

          {/* Mobile Floating Action Buttons */}
          <div className="md:hidden absolute bottom-24 right-4 z-50 flex flex-col gap-3">
            {/* Navigate to current stop button */}
            {currentStop && !currentStop.completed && (
              <Button
                size="lg"
                className="h-14 w-14 rounded-full shadow-xl"
                onClick={() => handleNavigate(currentStop)}
                data-testid="button-navigate-mobile"
              >
                <Navigation className="w-6 h-6" />
              </Button>
            )}
            {/* View stops list button */}
            <Button
              variant="outline"
              size="lg"
              className="h-14 px-6 rounded-full shadow-xl bg-background border-2"
              onClick={() => setMobileDrawerOpen(true)}
              data-testid="button-view-stops"
            >
              <span className="font-semibold">
                {currentStopIndex + 1}/{routeStops.length}
              </span>
            </Button>
          </div>
        </div>

        {/* Route Panel - Desktop Sidebar */}
        <div className="hidden md:block md:w-96 bg-background border-l overflow-y-auto">
          <div className="p-4">
            <RoutePanel
              stops={routeStops}
              currentStopIndex={currentStopIndex}
              totalDistanceMi={routeData?.totalDistMi || 0}
              totalEtaMin={routeData?.totalEtaMin || 0}
              onNavigate={handleNavigate}
              testMode={testMode}
              onSimulateLocation={(index) => setTestLocationIndex(index)}
            />
          </div>
        </div>
      </div>

      {/* Mobile Bottom Drawer - Route Panel */}
      <Drawer open={mobileDrawerOpen} onOpenChange={setMobileDrawerOpen}>
        <DrawerContent className="max-h-[85vh] md:hidden">
          <DrawerHeader>
            <DrawerTitle>Route Stops</DrawerTitle>
          </DrawerHeader>
          <div className="overflow-y-auto px-4 pb-4">
            <RoutePanel
              stops={routeStops}
              currentStopIndex={currentStopIndex}
              totalDistanceMi={routeData?.totalDistMi || 0}
              totalEtaMin={routeData?.totalEtaMin || 0}
              onNavigate={(index) => {
                handleNavigate(index);
                setMobileDrawerOpen(false);
              }}
              testMode={testMode}
              onSimulateLocation={(index) => {
                setTestLocationIndex(index);
                setMobileDrawerOpen(false);
              }}
            />
          </div>
        </DrawerContent>
      </Drawer>

      {/* Proximity Alert */}
      {showProximityAlert && nearbyStopIndex !== null && routeStops[nearbyStopIndex] && (
        <ProximityAlert
          companyName={routeStops[nearbyStopIndex].name}
          distanceMeters={calculateDistance(
            userLocation?.lat || 0,
            userLocation?.lng || 0,
            routeStops[nearbyStopIndex].lat,
            routeStops[nearbyStopIndex].lng
          )}
          onCheckIn={handleCheckIn}
          onSkip={() => {
            setShowProximityAlert(false);
            setNearbyStopIndex(null);
          }}
          onDismiss={() => {
            setShowProximityAlert(false);
            setNearbyStopIndex(null);
          }}
          isNextPlannedStop={nearbyStopIndex === currentStopIndex}
        />
      )}

      {/* Check-In Form */}
      {showCheckInForm && nearbyStopIndex !== null && routeStops[nearbyStopIndex] && userLocation && (
        <CheckInForm
          companyName={routeStops[nearbyStopIndex].name}
          companyAddress={`${routeStops[nearbyStopIndex].street}, ${routeStops[nearbyStopIndex].city}, ${routeStops[nearbyStopIndex].state}`}
          lat={userLocation.lat}
          lng={userLocation.lng}
          timestamp={new Date().toISOString()}
          onSubmit={handleSubmitCheckIn}
          onCancel={() => {
            setShowCheckInForm(false);
            setNearbyStopIndex(null);
          }}
        />
      )}

      {/* Route Complete Banner */}
      {isRouteComplete && (
        <div className="absolute bottom-20 md:bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-md z-30">
          <div className="bg-success text-success-foreground p-4 rounded-lg shadow-xl">
            <p className="font-semibold mb-2">Route Complete! 🎉</p>
            <Button 
              variant="secondary" 
              className="w-full"
              onClick={handleEndRoute}
              data-testid="button-view-summary"
            >
              View Summary
            </Button>
          </div>
        </div>
      )}

      {/* Add Stop Dialog */}
      <AddStopDialog
        open={showAddStopDialog}
        onClose={() => setShowAddStopDialog(false)}
        onAddStop={handleAddStop}
        currentLocation={userLocation}
        excludeCompanyIds={routeStops.map(s => s.companyId)}
      />
    </div>
  );
}
