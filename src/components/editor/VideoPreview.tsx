import React, { lazy, Suspense, useMemo } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { formatDuration } from '@/data/sampleData';
import { TimelineClip, VideoFile } from '@/types/editor';
import { VideoFileStatus } from '@/types/schema/VideoFile';
import { cn } from '@/lib/utils';

// Lazy load heavy components
const LazyVideoPlayer = lazy(() => import('./LazyVideoPlayer'));

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
  originalFiles: Map<string, File>;
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
  originalFiles,
}: VideoPreviewProps) {
  // Check if all files on timeline are ready
  const filesOnTimeline = useMemo(() => {
    const fileIds = new Set(timeline.map(clip => clip.fileId));
    return files.filter(f => fileIds.has(f.id));
  }, [timeline, files]);
  
  const processingFiles = useMemo(() => {
    return filesOnTimeline.filter(f => f.status === VideoFileStatus.PROCESSING);
  }, [filesOnTimeline]);
  
  const allFilesReady = processingFiles.length === 0 && filesOnTimeline.length > 0;
  const canPlay = allFilesReady && totalDuration > 0;

  return (
    <div className="flex flex-col h-full">
      {/* Video container */}
      <div className="relative flex-1 bg-foreground/5 rounded-lg overflow-hidden flex items-center justify-center">
        <Suspense fallback={
          <div className="text-center text-muted-foreground">
            <p className="text-sm">Loading preview...</p>
          </div>
        }>
          <LazyVideoPlayer
            timeline={timeline}
            files={files}
            currentTime={currentTime}
            isPlaying={isPlaying}
            speedMultiplier={speedMultiplier}
            previewQuality={previewQuality}
            totalDuration={totalDuration}
            onTimeChange={onTimeChange}
            onTogglePlayback={onTogglePlayback}
            onLoad={() => {}}
            onError={() => {}}
            originalFiles={originalFiles}
          />
        </Suspense>
      </div>

      {/* Controls */}
      <div className="mt-4 space-y-3">
        {/* Progress bar */}
        <div className="px-1">
          <Slider
            value={[currentTime / totalDuration * 100]}
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
              disabled={!canPlay}
              title={!canPlay && processingFiles.length > 0 ? `Processing ${processingFiles.length} file(s)...` : ''}
            >
              {!canPlay && processingFiles.length > 0 ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : isPlaying ? (
                <Pause className="w-5 h-5" />
              ) : (
                <Play className="w-5 h-5" />
              )}
            </Button>
            
            {!canPlay && processingFiles.length > 0 && (
              <span className="text-xs text-muted-foreground">
                Processing {processingFiles.length} file{processingFiles.length > 1 ? 's' : ''}...
              </span>
            )}

            <Button variant="ghost" size="icon" disabled>
              <VolumeX className="w-4 h-4" />
            </Button>
          </div>

          <div className="flex items-center gap-4 text-sm">
            <span className="text-muted-foreground font-mono">
              {formatDuration(currentTime / speedMultiplier)} / {formatDuration(outputDuration)}
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
