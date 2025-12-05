import { Download, Trash2, Save, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { SpeedControls } from './SpeedControls';
import { PreviewQualityToggle } from './PreviewQualityToggle';

interface ControlsPanelProps {
  speedMultiplier: number;
  previewQuality: 'proxy' | 'high';
  hasContent: boolean;
  onSpeedChange: (speed: number) => void;
  onQualityChange: (quality: 'proxy' | 'high') => void;
  onExport: () => void;
  onClearProject: () => void;
}

export function ControlsPanel({
  speedMultiplier,
  previewQuality,
  hasContent,
  onSpeedChange,
  onQualityChange,
  onExport,
  onClearProject,
}: ControlsPanelProps) {
  return (
    <div className="flex flex-col h-full bg-card border-l">
      <div className="p-4 border-b">
        <h2 className="font-semibold flex items-center gap-2">
          <Settings className="w-4 h-4" />
          Controls
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-6">
        <SpeedControls value={speedMultiplier} onChange={onSpeedChange} />
        
        <Separator />
        
        <PreviewQualityToggle value={previewQuality} onChange={onQualityChange} />
      </div>

      <div className="p-4 border-t space-y-3">
        <Button
          className="w-full shadow-card hover:shadow-card-hover"
          size="lg"
          onClick={onExport}
          disabled={!hasContent}
        >
          <Download className="w-4 h-4 mr-2" />
          Export Timelapse
        </Button>

        <p className="text-[10px] text-muted-foreground text-center flex items-center justify-center gap-1">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-success" />
          Files never leave your device
        </p>

        <Separator className="my-3" />

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            disabled={!hasContent}
          >
            <Save className="w-3 h-3 mr-1" />
            Save
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1 text-destructive hover:text-destructive"
            onClick={onClearProject}
            disabled={!hasContent}
          >
            <Trash2 className="w-3 h-3 mr-1" />
            Clear
          </Button>
        </div>
      </div>
    </div>
  );
}
