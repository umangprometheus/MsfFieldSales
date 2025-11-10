import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";

interface RadiusPickerProps {
  value: number;
  onChange: (value: number) => void;
  className?: string;
}

const RADIUS_OPTIONS = [10, 25, 50];

export default function RadiusPicker({ value, onChange, className = "" }: RadiusPickerProps) {
  const handleSliderChange = (values: number[]) => {
    const index = values[0];
    onChange(RADIUS_OPTIONS[index]);
  };

  const currentIndex = RADIUS_OPTIONS.indexOf(value);

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium text-foreground">Search Radius</Label>
        <span className="text-lg font-semibold text-primary" data-testid="text-radius-value">
          {value} mi
        </span>
      </div>
      <Slider
        value={[currentIndex]}
        onValueChange={handleSliderChange}
        max={RADIUS_OPTIONS.length - 1}
        step={1}
        className="w-full"
        data-testid="slider-radius"
      />
      <div className="flex justify-between text-xs text-muted-foreground">
        {RADIUS_OPTIONS.map((r) => (
          <span key={r}>{r} mi</span>
        ))}
      </div>
    </div>
  );
}
