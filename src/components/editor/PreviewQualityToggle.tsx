import { Monitor, Zap } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface PreviewQualityToggleProps {
  value: 'proxy' | 'high';
  onChange: (value: 'proxy' | 'high') => void;
}

export function PreviewQualityToggle({ value, onChange }: PreviewQualityToggleProps) {
  return (
    <div className="space-y-3">
      <Label className="flex items-center gap-2 text-sm font-medium">
        <Monitor className="w-4 h-4" />
        Preview Quality
      </Label>

      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => onChange('proxy')}
          className={cn(
            'flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-all',
            value === 'proxy'
              ? 'border-primary bg-primary/5'
              : 'border-border hover:border-primary/50'
          )}
        >
          <Zap className={cn('w-5 h-5', value === 'proxy' ? 'text-primary' : 'text-muted-foreground')} />
          <span className="text-sm font-medium">Proxy</span>
          <span className="text-[10px] text-muted-foreground">Faster preview</span>
        </button>

        <button
          onClick={() => onChange('high')}
          className={cn(
            'flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-all',
            value === 'high'
              ? 'border-primary bg-primary/5'
              : 'border-border hover:border-primary/50'
          )}
        >
          <Monitor className={cn('w-5 h-5', value === 'high' ? 'text-primary' : 'text-muted-foreground')} />
          <span className="text-sm font-medium">High</span>
          <span className="text-[10px] text-muted-foreground">Full quality</span>
        </button>
      </div>
    </div>
  );
}
