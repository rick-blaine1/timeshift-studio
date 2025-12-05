import { VideoFile } from '@/types/editor';
import { formatDuration, formatFileSize } from '@/data/sampleData';
import { X, GripVertical, Check, AlertCircle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface FileCardProps {
  file: VideoFile;
  onRemove: () => void;
  onAddToTimeline: () => void;
  isDragging?: boolean;
}

export function FileCard({ file, onRemove, onAddToTimeline, isDragging }: FileCardProps) {
  const statusConfig = {
    ready: { icon: null, label: 'Ready', className: 'bg-muted text-muted-foreground' },
    'on-timeline': { icon: Check, label: 'On timeline', className: 'bg-success/10 text-success' },
    error: { icon: AlertCircle, label: 'Error', className: 'bg-destructive/10 text-destructive' },
    uploading: { icon: Clock, label: 'Uploading', className: 'bg-primary/10 text-primary' },
  };

  const status = statusConfig[file.status];
  const StatusIcon = status.icon;

  return (
    <div
      className={cn(
        'group relative bg-card rounded-lg border shadow-card overflow-hidden transition-all duration-200',
        isDragging && 'shadow-elevated scale-[1.02] ring-2 ring-primary',
        !isDragging && 'hover:shadow-card-hover'
      )}
    >
      <div className="flex gap-3 p-3">
        {/* Drag handle */}
        <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity cursor-grab">
          <GripVertical className="w-4 h-4 text-muted-foreground" />
        </div>

        {/* Thumbnail */}
        <div className="relative w-20 h-12 rounded-md overflow-hidden bg-muted flex-shrink-0">
          <img
            src={file.thumbnail}
            alt={file.name}
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 60"><rect fill="%23e5e7eb" width="100" height="60"/><text x="50" y="35" text-anchor="middle" fill="%239ca3af" font-size="10">Video</text></svg>';
            }}
          />
          <div className="absolute bottom-0.5 right-0.5 px-1 py-0.5 bg-foreground/80 text-background text-[10px] font-medium rounded">
            {formatDuration(file.duration)}
          </div>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate" title={file.name}>
            {file.name}
          </p>
          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
            <span>{file.resolution}</span>
            <span>•</span>
            <span>{formatFileSize(file.size)}</span>
          </div>
          <div className={cn('inline-flex items-center gap-1 mt-1.5 px-1.5 py-0.5 rounded text-[10px] font-medium', status.className)}>
            {StatusIcon && <StatusIcon className="w-3 h-3" />}
            {status.label}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-start gap-1">
          {file.status === 'ready' && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={onAddToTimeline}
            >
              Add
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-destructive"
            onClick={onRemove}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
