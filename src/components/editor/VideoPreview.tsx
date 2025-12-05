import { Play, Pause, Volume2, VolumeX, Maximize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { formatDuration } from '@/data/sampleData';
import { TimelineClip, VideoFile } from '@/types/editor';
import { cn } from '@/lib/utils';

interface VideoPreviewProps {
  timeline: TimelineClip[];
  files: VideoFile[];
  currentTime: number;
  isPlaying: boolean;
  speedMultiplier: number;
  previewQuality: 'proxy' | 'high';
  totalDuration: number;
  outputDuration: number;
  onTimeChange: (time: number) => void;
  onTogglePlayback: () => void;
}

export function VideoPreview({
  timeline,
  files,
  currentTime,
  isPlaying,
  speedMultiplier,
  previewQuality,
  totalDuration,
  outputDuration,
  onTimeChange,
  onTogglePlayback,
}: VideoPreviewProps) {
  // Find current clip based on currentTime
  const getCurrentThumbnail = () => {
    for (const clip of timeline) {
      if (currentTime >= clip.startTime && currentTime < clip.startTime + clip.duration) {
        const file = files.find(f => f.id === clip.fileId);
        return file?.thumbnail;
      }
    }
    return timeline[0] ? files.find(f => f.id === timeline[0].fileId)?.thumbnail : null;
  };

  const thumbnail = getCurrentThumbnail();
  const displayTime = currentTime / speedMultiplier;
  const progress = totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0;

  return (
    <div className="flex flex-col h-full">
      {/* Video container */}
      <div className="relative flex-1 bg-foreground/5 rounded-lg overflow-hidden flex items-center justify-center">
        {timeline.length === 0 ? (
          <div className="text-center text-muted-foreground">
            <p className="text-sm">No clips on timeline</p>
            <p className="text-xs mt-1">Add clips to preview your timelapse</p>
          </div>
        ) : (
          <>
            <div className="relative w-full aspect-video max-h-full">
              {thumbnail && (
                <img
                  src={thumbnail}
                  alt="Preview"
                  className="w-full h-full object-contain"
                />
              )}
              
              {/* Play overlay */}
              {!isPlaying && (
                <div className="absolute inset-0 flex items-center justify-center bg-foreground/10">
                  <Button
                    size="lg"
                    variant="secondary"
                    className="rounded-full w-16 h-16 shadow-elevated"
                    onClick={onTogglePlayback}
                  >
                    <Play className="w-6 h-6 ml-1" />
                  </Button>
                </div>
              )}
            </div>

            {/* Quality badge */}
            <Badge
              variant="secondary"
              className={cn(
                'absolute top-3 right-3 text-xs',
                previewQuality === 'proxy' && 'bg-warning/20 text-warning'
              )}
            >
              {previewQuality === 'proxy' ? 'Proxy' : 'High Quality'}
            </Badge>

            {/* Speed indicator */}
            <Badge
              variant="outline"
              className="absolute top-3 left-3 text-xs bg-background/80"
            >
              {speedMultiplier}× speed
            </Badge>
          </>
        )}
      </div>

      {/* Controls */}
      <div className="mt-4 space-y-3">
        {/* Progress bar */}
        <div className="px-1">
          <Slider
            value={[progress]}
            max={100}
            step={0.1}
            onValueChange={([value]) => {
              const newTime = (value / 100) * totalDuration;
              onTimeChange(newTime);
            }}
            className="cursor-pointer"
            disabled={totalDuration === 0}
          />
        </div>

        {/* Control buttons */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={onTogglePlayback}
              disabled={totalDuration === 0}
            >
              {isPlaying ? (
                <Pause className="w-5 h-5" />
              ) : (
                <Play className="w-5 h-5" />
              )}
            </Button>

            <Button variant="ghost" size="icon" disabled>
              <VolumeX className="w-4 h-4" />
            </Button>
          </div>

          <div className="flex items-center gap-4 text-sm">
            <span className="text-muted-foreground font-mono">
              {formatDuration(displayTime)} / {formatDuration(outputDuration)}
            </span>
            <span className="text-xs text-muted-foreground">
              (Source: {formatDuration(totalDuration)})
            </span>
          </div>

          <Button variant="ghost" size="icon" disabled>
            <Maximize2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
