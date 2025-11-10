import { Button } from "@/components/ui/button";
import { MapPin, X } from "lucide-react";
import { formatDistance } from "@/lib/distance";

interface ProximityAlertProps {
  companyName: string;
  distanceMeters: number;
  onCheckIn: () => void;
  onSkip: () => void;
  onDismiss: () => void;
  isNextPlannedStop?: boolean;
}

export default function ProximityAlert({
  companyName,
  distanceMeters,
  onCheckIn,
  onSkip,
  onDismiss,
  isNextPlannedStop = true,
}: ProximityAlertProps) {
  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-40 animate-in fade-in duration-200"
        onClick={onDismiss}
        data-testid="backdrop-proximity-alert"
      />

      {/* Bottom Sheet */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 bg-background rounded-t-2xl shadow-2xl animate-in slide-in-from-bottom duration-300 pb-safe"
        data-testid="sheet-proximity-alert"
      >
        <div className="p-6 space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 flex-1">
              <div className="w-10 h-10 rounded-full bg-warning/10 flex items-center justify-center flex-shrink-0 mt-1">
                <MapPin className="w-5 h-5 text-warning" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-bold text-foreground mb-1">
                  {isNextPlannedStop ? "Arrived at Next Stop" : "Nearby Stop Detected"}
                </h3>
                <p className="text-base font-semibold text-foreground truncate">
                  {companyName}
                </p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {formatDistance(distanceMeters)} away
                  {!isNextPlannedStop && " • Out of sequence"}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              className="h-11 w-11 flex-shrink-0"
              onClick={onDismiss}
              data-testid="button-dismiss-proximity"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Actions */}
          <div className="space-y-3 pt-2">
            <Button
              onClick={onCheckIn}
              className="w-full h-14 text-base font-semibold"
              data-testid="button-check-in"
            >
              Check In
            </Button>
            <Button
              onClick={onSkip}
              variant="outline"
              className="w-full h-12 text-base"
              data-testid="button-skip-check-in"
            >
              Skip for now
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
