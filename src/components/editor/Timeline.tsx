import { useState, useEffect } from 'react';
import { TimelineClip as TimelineClipType, VideoFile } from '@/types/editor';
import { formatDuration } from '@/data/sampleData';
import { X, GripHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface TimelineProps {
  clips: TimelineClipType[];
  files: VideoFile[];
  currentTime: number;
  totalDuration: number;
  onRemoveClip: (clipId: string) => void;
  onReorderClips: (fromIndex: number, toIndex: number) => void;
  onTimeChange: (time: number) => void;
  onDropFile: (fileId: string) => void;
}

export function Timeline({
  clips,
  files,
  currentTime,
  totalDuration,
  onRemoveClip,
  onReorderClips,
  onTimeChange,
  onDropFile,
}: TimelineProps) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [activeTrimHandle, setActiveTrimHandle] = useState<{ clipId: string, side: 'start' | 'end' } | null>(null);

  const playheadPosition = totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0;

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== index) {
      setDropTargetIndex(index);
    }
  };

  const handleDrop = (index: number) => {
    if (draggedIndex !== null && draggedIndex !== index) {
      onReorderClips(draggedIndex, index);
    }
    setDraggedIndex(null);
    setDropTargetIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDropTargetIndex(null);
  };

  // Handle external file drop
  const handleExternalDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    const fileId = e.dataTransfer.getData('fileId');
    if (fileId || e.dataTransfer.types.includes('fileId')) {
      setIsDragOver(true);
    }
  };

  const handleExternalDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const fileId = e.dataTransfer.getData('fileId');
    if (fileId) {
      onDropFile(fileId);
    }
    setIsDragOver(false);
  };

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (totalDuration === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    onTimeChange(percentage * totalDuration);
  };

  const handleTrimStart = (e: React.MouseEvent, clipId: string) => {
    e.stopPropagation();
    setActiveTrimHandle({ clipId, side: 'start' });
  };

  const handleTrimEnd = (e: React.MouseEvent, clipId: string) => {
    e.stopPropagation();
    setActiveTrimHandle({ clipId, side: 'end' });
  };

  useEffect(() => {
    if (!activeTrimHandle) return;

    const handleMouseMove = (e: MouseEvent) => {
      const timelineElement = document.querySelector('.timeline-container');
      if (!timelineElement) return;

      const rect = timelineElement.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const timelineWidth = rect.width;
      const timePosition = (mouseX / timelineWidth) * totalDuration;

      // Find the clip being trimmed
      const clipIndex = clips.findIndex(c => c.id === activeTrimHandle.clipId);
      if (clipIndex === -1) return;

      const clip = clips[clipIndex];
      const file = files.find(f => f.id === clip.fileId);
      if (!file) return;

      if (activeTrimHandle.side === 'start') {
        // Ensure trim start is within valid range
        const newStart = Math.max(0, Math.min(timePosition, clip.end - 0.1));
        // Update clip start time and duration
      } else {
        // Ensure trim end is within valid range
        const newEnd = Math.min(file.duration, Math.max(timePosition, clip.start + 0.1));
        // Update clip end time and duration
      }

      // Update timeline total duration
    };

    const handleMouseUp = () => {
      setActiveTrimHandle(null);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [activeTrimHandle, clips, files, totalDuration]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-sm font-medium">Timeline</h3>
        <span className="text-xs text-muted-foreground">
          {clips.length} clip{clips.length !== 1 ? 's' : ''} • {formatDuration(totalDuration)}
        </span>
      </div>

      <div
        className={cn(
          'relative bg-timeline-bg rounded-lg p-2 min-h-[80px] transition-colors cursor-pointer',
          isDragOver && 'ring-2 ring-primary ring-dashed bg-primary/5'
        )}
        onDragOver={handleExternalDragOver}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleExternalDrop}
        onClick={handleTimelineClick}
      >
        {clips.length === 0 ? (
          <div className="flex items-center justify-center h-16 text-sm text-muted-foreground">
            <p>Drop clips here to start building your timelapse</p>
          </div>
        ) : (
          <>
            {/* Clips */}
            <div className="flex gap-1">
              {clips.map((clip, index) => {
                const file = files.find(f => f.id === clip.fileId);
                if (!file) return null;

                const widthPercent = (clip.duration / totalDuration) * 100;

                return (
                  <div
                    key={clip.id}
                    data-testid="timeline-clip"
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDrop={() => handleDrop(index)}
                    onDragEnd={handleDragEnd}
                    className={cn(
                      'group relative flex-shrink-0 bg-timeline-clip border-2 border-timeline-clip-border rounded-md overflow-hidden transition-all cursor-grab active:cursor-grabbing',
                      draggedIndex === index && 'opacity-50 scale-95',
                      dropTargetIndex === index && 'ring-2 ring-primary'
                    )}
                    style={{ width: `${Math.max(widthPercent, 8)}%`, minWidth: '60px' }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Left trim handle */}
                    <div
                      className="absolute left-0 top-0 bottom-0 w-2 bg-trim-handle cursor-ew-resize z-20 opacity-0 group-hover:opacity-100 transition-opacity"
                      onMouseDown={(e) => handleTrimStart(e, clip.id)}
                    />
                    
                    {/* Clip content */}
                    <div className="flex items-center h-14 px-2 gap-2">
                      <GripHorizontal className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                      
                      <div className="w-10 h-8 rounded overflow-hidden bg-muted flex-shrink-0">
                        <img
                          src={file.thumbnail}
                          alt={file.name}
                          className="w-full h-full object-cover"
                        />
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{file.name}</p>
                        <p className="text-[10px] text-muted-foreground">{formatDuration(clip.duration)}</p>
                      </div>

                      <Button
                        variant="ghost"
                        size="icon"
                        className="w-5 h-5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveClip(clip.id);
                        }}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                    
                    {/* Right trim handle */}
                    <div
                      className="absolute right-0 top-0 bottom-0 w-2 bg-trim-handle cursor-ew-resize z-20 opacity-0 group-hover:opacity-100 transition-opacity"
                      onMouseDown={(e) => handleTrimEnd(e, clip.id)}
                    />
                  </div>
                );
              })}
            </div>

            {/* Playhead */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-playhead z-10 pointer-events-none"
              style={{ left: `${playheadPosition}%` }}
            >
              <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-playhead rounded-full" />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
