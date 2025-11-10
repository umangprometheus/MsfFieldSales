import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import type { CompanyWithDistance } from "@shared/schema";

// Set Mapbox access token
// Note: MAPBOX_TOKEN secret needs to be duplicated as VITE_MAPBOX_TOKEN for client access
const token = import.meta.env.VITE_MAPBOX_TOKEN || "";
console.log("[MapView] Token available:", token ? "YES (length: " + token.length + ")" : "NO");
mapboxgl.accessToken = token;

interface MapViewProps {
  companies: CompanyWithDistance[];
  userLocation: { lat: number; lng: number } | null;
  onCompanyClick?: (companyId: string) => void;
  onCompanyInfo?: (companyId: string) => void; // Show company info in bottom sheet
  routeCoordinates?: Array<{ lat: number; lng: number }>; // Stop waypoints for markers
  routeGeometry?: Array<{ lat: number; lng: number }>; // Actual driving route
  currentStopIndex?: number;
  selectedCompanyIds?: string[]; // IDs of selected companies to highlight in green
  className?: string;
}

export default function MapView({
  companies,
  userLocation,
  onCompanyClick,
  onCompanyInfo,
  routeCoordinates,
  routeGeometry,
  currentStopIndex = 0,
  selectedCompanyIds = [],
  className = "",
}: MapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const userMarker = useRef<mapboxgl.Marker | null>(null);
  const popup = useRef<mapboxgl.Popup | null>(null);
  const hasInitiallyCentered = useRef(false); // Track if we've done the initial centering
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    // Check if Mapbox token is available
    if (!mapboxgl.accessToken) {
      setMapError("Mapbox token not configured");
      console.error("[MapView] MAPBOX token missing!");
      return;
    }

    try {
      const defaultCenter: [number, number] = userLocation
        ? [userLocation.lng, userLocation.lat]
        : [-90.0490, 35.1495]; // Memphis default

      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: "mapbox://styles/mapbox/streets-v12",
        center: defaultCenter,
        zoom: 12,
        preserveDrawingBuffer: true, // Helps with some WebGL issues
      });

      map.current.on("load", () => {
        console.log("[MapView] Map loaded successfully");
        setMapLoaded(true);
      });

      map.current.on("error", (e) => {
        console.error("[MapView] Map error:", e);
        setMapError(e.error?.message || "Map failed to load");
      });


      // Add navigation controls (top-right to avoid mobile bottom nav)
      map.current.addControl(new mapboxgl.NavigationControl(), "top-right");

      // Create popup instance with offset to avoid covering nearby markers
      popup.current = new mapboxgl.Popup({
        closeButton: true,
        closeOnClick: true,
        offset: 25, // Position popup 25px above the marker to avoid covering nearby dots
        anchor: 'bottom', // Popup anchor at bottom, so it appears above the marker
      });
    } catch (error: any) {
      console.error("[MapView] Failed to initialize map:", error);
      setMapError(error.message || "Failed to initialize map");
    }

    return () => {
      popup.current?.remove();
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Update user location marker (NEVER auto-center, let user control the view)
  useEffect(() => {
    if (!map.current || !mapLoaded || !userLocation) return;

    // Create marker if it doesn't exist
    if (!userMarker.current) {
      const el = document.createElement("div");
      el.className = "w-4 h-4 bg-green-500 rounded-full border-2 border-white shadow-lg animate-pulse";

      userMarker.current = new mapboxgl.Marker({ 
        element: el, 
        anchor: 'center',
        pitchAlignment: 'map',
        rotationAlignment: 'map'
      })
        .setLngLat([userLocation.lng, userLocation.lat])
        .addTo(map.current);

      // ONLY center on the very first marker creation
      if (!hasInitiallyCentered.current) {
        map.current.setCenter([userLocation.lng, userLocation.lat]);
        hasInitiallyCentered.current = true;
      }
    } else {
      // Just update position without any centering
      userMarker.current.setLngLat([userLocation.lng, userLocation.lat]);
    }
  }, [userLocation, mapLoaded]);

  // Update company markers using native Mapbox layers (no DOM markers = no zoom jitter)
  useEffect(() => {
    if (!map.current || !mapLoaded) {
      console.log('[MapView] Skipping markers - map not ready. mapLoaded:', mapLoaded);
      return;
    }
    
    // Double-check map style is loaded
    if (!map.current.isStyleLoaded()) {
      console.log('[MapView] Map style not loaded yet, waiting...');
      return;
    }

    console.log('[MapView] Adding', companies.length, 'company markers as native layers');

    const sourceId = 'companies';
    const circleLayerId = 'company-circles';
    const labelLayerId = 'company-labels';

    // Build GeoJSON FeatureCollection
    const features = companies
      .filter(c => c.lat && c.lng)
      .map((company, index) => ({
        type: 'Feature' as const,
        geometry: {
          type: 'Point' as const,
          coordinates: [company.lng!, company.lat!] as [number, number],
        },
        properties: {
          id: company.id,
          name: company.name,
          city: company.city || '',
          state: company.state || '',
          distanceMi: company.distanceMi || null,
          routeIndex: routeCoordinates ? index : null,
          isCurrentStop: routeCoordinates && index === currentStopIndex,
          isSelected: selectedCompanyIds.includes(company.id),
        },
      }));

    const geojson: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features,
    };

    // Check if source already exists
    const existingSource = map.current.getSource(sourceId) as mapboxgl.GeoJSONSource | undefined;
    
    if (existingSource) {
      // Just update the data - no flickering!
      existingSource.setData(geojson);
    } else {
      // First time setup: Add source with clustering enabled for performance
      map.current.addSource(sourceId, {
        type: 'geojson',
        data: geojson,
        cluster: true,
        clusterMaxZoom: 14, // Max zoom to cluster points on
        clusterRadius: 50, // Radius of each cluster when clustering points (default 50)
      });

      // Add cluster circles layer (for grouped companies)
      map.current.addLayer({
        id: 'company-clusters',
      type: 'circle',
      source: sourceId,
      filter: ['has', 'point_count'],
      paint: {
        'circle-radius': [
          'step',
          ['get', 'point_count'],
          20,  // radius for clusters with < 10 points
          10,
          25,  // radius for clusters with 10-100 points
          100,
          30   // radius for clusters with > 100 points
        ],
        'circle-color': [
          'step',
          ['get', 'point_count'],
          '#3b82f6', // blue for small clusters
          10,
          '#2563eb', // darker blue for medium clusters
          100,
          '#1e40af'  // darkest blue for large clusters
        ],
        'circle-stroke-width': 2,
        'circle-stroke-color': '#ffffff',
      },
    });

      // Add cluster count labels
      map.current.addLayer({
        id: 'company-cluster-count',
        type: 'symbol',
        source: sourceId,
        filter: ['has', 'point_count'],
        layout: {
          'text-field': '{point_count_abbreviated}',
          'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
          'text-size': 12,
        },
        paint: {
          'text-color': '#ffffff',
        },
      });

      // Add unclustered point layer (individual companies)
      map.current.addLayer({
        id: circleLayerId,
        type: 'circle',
        source: sourceId,
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-radius': 14, // Smaller but still tappable (44px minimum at default zoom)
          'circle-color': [
            'case',
            ['get', 'isSelected'],
            '#22c55e', // green color for selected companies
            '#1c4ed8', // primary blue color for all other dots
          ],
          'circle-stroke-width': 2, // Thinner stroke for smaller dots
          'circle-stroke-color': '#ffffff',
          'circle-opacity': 0.95, // Slightly transparent to see overlaps
        },
      });

      // Add symbol layer for route numbers (only if route exists)
      if (routeCoordinates) {
        map.current.addLayer({
          id: labelLayerId,
          type: 'symbol',
          source: sourceId,
          layout: {
            'text-field': [
              'case',
              ['!=', ['get', 'routeIndex'], null],
              ['to-string', ['+', ['get', 'routeIndex'], 1]], // Convert to string
              '',
            ],
            'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
            'text-size': 14,
            'text-allow-overlap': true,
            'text-ignore-placement': true,
          },
          paint: {
            'text-color': '#ffffff',
            'text-halo-color': '#000000',
            'text-halo-width': 2,
            'text-halo-blur': 1,
          },
        });
      }
    } // Close the else block

    // Add click handler for clusters (zoom in on click) - works for both click and touch
    const clusterClickHandler = (e: mapboxgl.MapMouseEvent | mapboxgl.MapTouchEvent) => {
      console.log('[MapView] Cluster clicked, features:', e.features?.length);
      if (!e.features || e.features.length === 0) return;
      const feature = e.features[0];
      const clusterId = feature.properties?.cluster_id;
      console.log('[MapView] Cluster ID:', clusterId);
      
      if (clusterId && map.current) {
        const source = map.current.getSource(sourceId) as mapboxgl.GeoJSONSource;
        source.getClusterExpansionZoom(clusterId, (err, zoom) => {
          if (err || !map.current) return;
          
          const coordinates = (feature.geometry as GeoJSON.Point).coordinates as [number, number];
          map.current.easeTo({
            center: coordinates,
            zoom: zoom || map.current.getZoom() + 2,
          });
        });
      }
    };

    // Add click handler for individual company markers - works for both click and touch
    let lastClickTime = 0;
    const clickHandler = (e: mapboxgl.MapMouseEvent | mapboxgl.MapTouchEvent) => {
      // Prevent double-firing from both click and touchend events
      const now = Date.now();
      if (now - lastClickTime < 300) {
        console.log('[MapView] Ignoring duplicate click event');
        return;
      }
      lastClickTime = now;

      console.log('[MapView] Marker clicked, features:', e.features?.length);
      if (!e.features || e.features.length === 0) return;
      const feature = e.features[0];
      const companyId = feature.properties?.id;
      console.log('[MapView] Company ID:', companyId, 'Has handler:', !!onCompanyClick);
      
      // Close any existing popup first (prevents blocking other markers)
      if (popup.current) {
        popup.current.remove();
      }

      if (companyId) {
        // Toggle selection
        if (onCompanyClick) {
          console.log('[MapView] Calling onCompanyClick for:', companyId);
          onCompanyClick(companyId);
        }
        
        // Show info in bottom sheet
        if (onCompanyInfo) {
          console.log('[MapView] Calling onCompanyInfo for:', companyId);
          onCompanyInfo(companyId);
        }
      }
    };

    // Change cursor on hover
    const mouseEnterHandler = () => {
      if (map.current) map.current.getCanvas().style.cursor = 'pointer';
    };

    const mouseLeaveHandler = () => {
      if (map.current) map.current.getCanvas().style.cursor = '';
    };

    // Close popup when clicking on map background (not on a marker)
    const mapClickHandler = (e: mapboxgl.MapMouseEvent) => {
      if (!e.defaultPrevented && popup.current) {
        popup.current.remove();
      }
    };

    // Attach cluster handlers (both click and touch)
    map.current.on('click', 'company-clusters', clusterClickHandler);
    map.current.on('touchend', 'company-clusters', clusterClickHandler);
    map.current.on('mouseenter', 'company-clusters', mouseEnterHandler);
    map.current.on('mouseleave', 'company-clusters', mouseLeaveHandler);

    // Attach handlers to both circle and label layers for individual companies (both click and touch)
    map.current.on('click', circleLayerId, clickHandler);
    map.current.on('touchend', circleLayerId, clickHandler);
    map.current.on('mouseenter', circleLayerId, mouseEnterHandler);
    map.current.on('mouseleave', circleLayerId, mouseLeaveHandler);

    if (routeCoordinates) {
      map.current.on('click', labelLayerId, clickHandler);
      map.current.on('touchend', labelLayerId, clickHandler);
      map.current.on('mouseenter', labelLayerId, mouseEnterHandler);
      map.current.on('mouseleave', labelLayerId, mouseLeaveHandler);
    }

    // Close popup when clicking on map background
    map.current.on('click', mapClickHandler);

    // Cleanup
    return () => {
      if (map.current) {
        map.current.off('click', 'company-clusters', clusterClickHandler);
        map.current.off('touchend', 'company-clusters', clusterClickHandler);
        map.current.off('mouseenter', 'company-clusters', mouseEnterHandler);
        map.current.off('mouseleave', 'company-clusters', mouseLeaveHandler);
        
        map.current.off('click', circleLayerId, clickHandler);
        map.current.off('touchend', circleLayerId, clickHandler);
        map.current.off('mouseenter', circleLayerId, mouseEnterHandler);
        map.current.off('mouseleave', circleLayerId, mouseLeaveHandler);
        
        if (routeCoordinates) {
          map.current.off('click', labelLayerId, clickHandler);
          map.current.off('touchend', labelLayerId, clickHandler);
          map.current.off('mouseenter', labelLayerId, mouseEnterHandler);
          map.current.off('mouseleave', labelLayerId, mouseLeaveHandler);
        }

        map.current.off('click', mapClickHandler);
      }
    };
  }, [companies, mapLoaded, routeCoordinates, currentStopIndex, selectedCompanyIds, onCompanyClick]);

  // Draw route polyline (stable - only updates data, doesn't recreate layer)
  useEffect(() => {
    if (!map.current || !mapLoaded) return;
    
    // Use routeGeometry if available (actual driving route), otherwise fallback to routeCoordinates (straight lines)
    const routeData = routeGeometry || routeCoordinates;
    
    if (!routeData || routeData.length < 2) {
      // Remove route if it exists but no data
      const routeId = "route-line";
      if (map.current.getLayer(routeId)) {
        map.current.removeLayer(routeId);
      }
      if (map.current.getSource(routeId)) {
        map.current.removeSource(routeId);
      }
      return;
    }

    const routeId = "route-line";
    const geojsonData = {
      type: "Feature" as const,
      properties: {},
      geometry: {
        type: "LineString" as const,
        coordinates: routeData.map((c) => [c.lng, c.lat]),
      },
    };

    // Check if source exists
    const source = map.current.getSource(routeId) as mapboxgl.GeoJSONSource | undefined;
    
    if (source) {
      // Just update the data (no flickering!)
      source.setData(geojsonData);
    } else {
      // Create source and layer for first time
      map.current.addSource(routeId, {
        type: "geojson",
        data: geojsonData,
      });

      // Add route line BEFORE company circles so it renders behind the dots/numbers
      const beforeLayerId = map.current.getLayer('company-circles') ? 'company-circles' : undefined;
      
      map.current.addLayer({
        id: routeId,
        type: "line",
        source: routeId,
        layout: {
          "line-join": "round",
          "line-cap": "round",
        },
        paint: {
          "line-color": "#1c4ed8",
          "line-width": 4,
          "line-opacity": 0.8,
        },
      }, beforeLayerId);
    }

    // Fit bounds to route ONLY on initial route load (when flag is not set)
    if (routeCoordinates && !hasInitiallyCentered.current) {
      const bounds = new mapboxgl.LngLatBounds();
      routeData.forEach((c) => bounds.extend([c.lng, c.lat]));
      map.current.fitBounds(bounds, { padding: 50 });
      hasInitiallyCentered.current = true;
    }
  }, [routeCoordinates, routeGeometry, mapLoaded]);

  return (
    <div className={`relative w-full h-full ${className}`} data-testid="map-view">
      <div ref={mapContainer} className="absolute inset-0" />
      {mapError && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/90 backdrop-blur-sm z-50">
          <div className="text-center p-6 max-w-md">
            <p className="text-lg font-semibold text-destructive mb-2">Map Error</p>
            <p className="text-sm text-muted-foreground">{mapError}</p>
            <p className="text-xs text-muted-foreground mt-4">Check browser console for details</p>
          </div>
        </div>
      )}
    </div>
  );
}
