import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Navigation, MapPin, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface LocationSearchProps {
  onLocationSelect: (lat: number, lng: number) => void;
  className?: string;
}

export default function LocationSearch({
  onLocationSelect,
  className = "",
}: LocationSearchProps) {
  const [searchValue, setSearchValue] = useState("");
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const { toast } = useToast();

  const handleUseGPS = () => {
    setIsGettingLocation(true);

    if (!navigator.geolocation) {
      toast({
        variant: "destructive",
        title: "Location not available",
        description: "Your browser doesn't support geolocation",
      });
      setIsGettingLocation(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        onLocationSelect(position.coords.latitude, position.coords.longitude);
        setIsGettingLocation(false);
        toast({
          title: "Location found",
          description: "Using your current GPS location",
        });
      },
      (error) => {
        console.error("Geolocation error:", error);
        toast({
          variant: "destructive",
          title: "Location error",
          description: "Unable to get your location. Please check permissions.",
        });
        setIsGettingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const handleSearch = async () => {
    if (!searchValue.trim()) return;
    let token = import.meta.env.VITE_MAPBOX_TOKEN || "";

    try {
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
          searchValue,
        )}.json?access_token=${token}&limit=1`,
      );
      const data = await response.json();

      if (data.features && data.features.length > 0) {
        const [lng, lat] = data.features[0].center;
        onLocationSelect(lat, lng);
        toast({
          title: "Location found",
          description: data.features[0].place_name,
        });
      } else {
        toast({
          variant: "destructive",
          title: "Location not found",
          description: "Try a different city or ZIP code",
        });
      }
    } catch (error) {
      console.error("Geocoding error:", error);
      toast({
        variant: "destructive",
        title: "Search error",
        description: "Unable to search for location",
      });
    }
  };

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Enter city or ZIP code"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="pl-9"
            data-testid="input-location-search"
          />
        </div>
        <Button
          onClick={handleSearch}
          variant="secondary"
          data-testid="button-search-location"
        >
          Search
        </Button>
      </div>

      <Button
        onClick={handleUseGPS}
        variant="outline"
        className="w-full"
        disabled={isGettingLocation}
        data-testid="button-use-gps"
      >
        {isGettingLocation ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Getting location...
          </>
        ) : (
          <>
            <Navigation className="w-4 h-4 mr-2" />
            Use Current GPS Location
          </>
        )}
      </Button>
    </div>
  );
}
