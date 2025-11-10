import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Circle, Navigation, Clock } from "lucide-react";
import type { RouteStopApi } from "@shared/schema";

interface RoutePanelProps {
  stops: RouteStopApi[];
  currentStopIndex: number;
  totalDistanceMi: number;
  totalEtaMin: number;
  onNavigate: (stop: RouteStopApi) => void;
  className?: string;
  testMode?: boolean;
  onSimulateLocation?: (stopIndex: number) => void;
}

export default function RoutePanel({
  stops,
  currentStopIndex,
  totalDistanceMi,
  totalEtaMin,
  onNavigate,
  className = "",
  testMode = false,
  onSimulateLocation,
}: RoutePanelProps) {
  return (
    <div className={`space-y-4 ${className}`}>
      {/* Route Summary */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Total Distance</p>
            <p className="text-2xl font-bold text-foreground" data-testid="text-total-distance">
              {totalDistanceMi.toFixed(1)} mi
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Est. Time</p>
            <p className="text-2xl font-bold text-foreground" data-testid="text-total-eta">
              {Math.round(totalEtaMin)} min
            </p>
          </div>
        </div>
      </Card>

      {/* Stops List */}
      <div className="space-y-3">
        {stops.map((stop, index) => {
          const isCurrent = index === currentStopIndex;
          const isCompleted = stop.completed;
          const isPast = index < currentStopIndex;

          return (
            <Card
              key={stop.companyId}
              className={`p-4 transition-all ${
                isCurrent ? "ring-2 ring-warning shadow-md" : ""
              } ${isPast || isCompleted ? "opacity-60" : ""}`}
              data-testid={`card-route-stop-${index}`}
            >
              <div className="flex items-start gap-3">
                {/* Step indicator */}
                <div className="flex-shrink-0 pt-1">
                  {isCompleted ? (
                    <CheckCircle className="w-6 h-6 text-success" />
                  ) : isCurrent ? (
                    <div className="w-6 h-6 rounded-full bg-warning flex items-center justify-center text-warning-foreground font-semibold text-sm">
                      {index + 1}
                    </div>
                  ) : (
                    <Circle className="w-6 h-6 text-muted-foreground" />
                  )}
                </div>

                {/* Stop details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h3 className="text-base font-semibold text-foreground">
                      {stop.name}
                    </h3>
                    {isCurrent && (
                      <Badge variant="default" className="bg-warning text-warning-foreground">
                        Current
                      </Badge>
                    )}
                  </div>

                  {stop.etaFromPrevMin !== null && stop.etaFromPrevMin > 0 && (
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{Math.round(stop.etaFromPrevMin)} min</span>
                      </div>
                      {stop.distanceFromPrevMi !== null && (
                        <span>• {stop.distanceFromPrevMi.toFixed(1)} mi from previous</span>
                      )}
                    </div>
                  )}

                  {isCurrent && !isCompleted && (
                    <Button
                      onClick={() => onNavigate(stop)}
                      variant="outline"
                      className="w-full mt-2 h-11"
                      data-testid={`button-navigate-${index}`}
                    >
                      <Navigation className="w-4 h-4 mr-2" />
                      Navigate to Stop
                    </Button>
                  )}
                  
                  {/* Test Mode: Simulate being at this stop */}
                  {testMode && !isCompleted && !isCurrent && onSimulateLocation && (
                    <Button
                      onClick={() => onSimulateLocation(index)}
                      variant="secondary"
                      className="w-full mt-2 h-11"
                      data-testid={`button-simulate-${index}`}
                    >
                      📍 Test: Go Here
                    </Button>
                  )}
                </div>
              </div>

              {/* Connecting line (not for last stop) */}
              {index < stops.length - 1 && (
                <div className="ml-3 mt-2 mb-2 h-6 w-0.5 bg-border" />
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
