import { Gauge } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface SpeedControlsProps {
  value: number;
  onChange: (value: number) => void;
}

const PRESETS = [1, 2, 4, 8];

export function SpeedControls({ value, onChange }: SpeedControlsProps) {
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const num = parseFloat(e.target.value);
    if (!isNaN(num) && num >= 1 && num <= 100) {
      onChange(num);
    }
  };

  return (
    <div className="space-y-3">
      <Label className="flex items-center gap-2 text-sm font-medium">
        <Gauge className="w-4 h-4" />
        Speed Multiplier
      </Label>

      {/* Presets */}
      <div className="flex gap-1">
        {PRESETS.map(preset => (
          <Button
            key={preset}
            variant={value === preset ? 'default' : 'outline'}
            size="sm"
            className={cn(
              'flex-1 text-xs',
              value === preset && 'shadow-card'
            )}
            onClick={() => onChange(preset)}
          >
            {preset}×
          </Button>
        ))}
      </div>

      {/* Custom input */}
      <div className="flex items-center gap-2">
        <Input
          type="number"
          min={1}
          max={100}
          step={0.5}
          value={value}
          onChange={handleInputChange}
          className="text-center"
        />
        <span className="text-sm text-muted-foreground">×</span>
      </div>

      <p className="text-xs text-muted-foreground">
        1× = normal speed, 100× = maximum compression
      </p>
    </div>
  );
}
