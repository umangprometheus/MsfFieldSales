import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { X, MapPin, Clock, Loader2 } from "lucide-react";

interface CheckInFormProps {
  companyName: string;
  companyAddress: string;
  lat: number;
  lng: number;
  timestamp: string;
  onSubmit: (note: string) => Promise<void>;
  onCancel: () => void;
}

export default function CheckInForm({
  companyName,
  companyAddress,
  lat,
  lng,
  timestamp,
  onSubmit,
  onCancel,
}: CheckInFormProps) {
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await onSubmit(note);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formattedTime = new Date(timestamp).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  const formattedDate = new Date(timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 z-50 animate-in fade-in duration-200"
        onClick={onCancel}
        data-testid="backdrop-check-in-form"
      />

      {/* Modal */}
      <div className="fixed inset-4 md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-full md:max-w-lg z-50 animate-in zoom-in-95 duration-200">
        <Card className="h-full md:h-auto flex flex-col bg-background shadow-2xl">
          {/* Header */}
          <div className="p-6 border-b flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold text-foreground mb-1">Field Check-In</h2>
              <p className="text-base font-semibold text-foreground truncate">
                {companyName}
              </p>
            </div>
            <Button
              variant="ghost"
              className="h-11 w-11"
              onClick={onCancel}
              disabled={isSubmitting}
              data-testid="button-close-check-in"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {/* Location Info */}
            <div className="space-y-3">
              <div className="flex items-start gap-2 text-sm">
                <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <p className="text-muted-foreground">{companyAddress}</p>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Clock className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <p className="text-muted-foreground">
                  {formattedTime} • {formattedDate}
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
                <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                <p data-testid="text-coordinates">
                  {lat.toFixed(6)}, {lng.toFixed(6)}
                </p>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Visit Notes <span className="text-muted-foreground">(optional)</span>
              </label>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Met with maintenance lead; discussed injector quote..."
                className="min-h-[120px] resize-none"
                disabled={isSubmitting}
                data-testid="textarea-check-in-note"
              />
              <p className="text-xs text-muted-foreground">
                Will be logged to HubSpot as a Note
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="p-6 border-t space-y-2">
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="w-full h-12 text-base font-semibold"
              data-testid="button-submit-check-in"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Logging Check-In...
                </>
              ) : (
                "Complete Check-In"
              )}
            </Button>
            <Button
              onClick={onCancel}
              variant="ghost"
              disabled={isSubmitting}
              className="w-full"
              data-testid="button-cancel-check-in"
            >
              Cancel
            </Button>
          </div>
        </Card>
      </div>
    </>
  );
}
