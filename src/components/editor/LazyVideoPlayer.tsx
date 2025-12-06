import React, { useEffect, useState } from 'react';
import { TimelineClip, VideoFile } from '@/types/editor';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface LazyVideoPlayerProps {
  timeline: TimelineClip[];
  files: VideoFile[];
  currentTime: number;
  isPlaying: boolean;
  speedMultiplier: number;
  previewQuality: 'proxy' | 'high';
  onTimeChange: (time: number) => void;
  onTogglePlayback: () => void;
  onLoad: () => void;
  onError: (error: string) => void;
}

export default function LazyVideoPlayer({
  timeline,
  files,
  currentTime,
  isPlaying,
  speedMultiplier,
  previewQuality,
  onTimeChange,
  onTogglePlayback,
  onLoad,
  onError,
}) {
  const [thumbnail, setThumbnail] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Find current clip based on currentTime
  useEffect(() => {
    const getCurrentThumbnail = () => {
      for (const clip of timeline) {
        if (currentTime >= clip.startTime && currentTime < clip.startTime + clip.duration) {
          const file = files.find(f => f.id === clip.fileId);
          return file?.thumbnail || null;
        }
      }
      return timeline[0] ? files.find(f => f.id === timeline[0].fileId)?.thumbnail || null : null;
    };

    setThumbnail(getCurrentThumbnail());
    setIsLoading(false);
    onLoad();
  }, [timeline, files, currentTime]);

  if (timeline.length === 0) {
    return (
      <div className="text-center text-muted-foreground">
        <p className="text-sm">No clips on timeline</p>
        <p className="text-xs mt-1">Add clips to preview your timelapse</p>
      </div>
    );
  }

  return (
    <>
      <div className="relative w-full aspect-video max-h-full">
        {thumbnail && typeof thumbnail === 'string' && (
          <img
            src={thumbnail}
            alt="Preview"
            className="w-full h-full object-contain"
          />
        )}
        
        {/* Play overlay */}
        {!isPlaying && (
          <div className="absolute inset-0 flex items-center justify-center bg-foreground/10">
            <button
              className="rounded-full w-16 h-16 bg-white bg-opacity-20 backdrop-blur-sm flex items-center justify-center shadow-lg"
              onClick={onTogglePlayback}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 ml-1 text-white" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
              </svg>
            </button>
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
  );
}