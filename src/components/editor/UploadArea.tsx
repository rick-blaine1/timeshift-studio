import { useState, useCallback } from 'react';
import { Upload, Film, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { VideoFile } from '@/types/editor';

interface UploadAreaProps {
  onFilesAdded: (files: VideoFile[]) => void;
  variant?: 'full' | 'compact';
}

export function UploadArea({ onFilesAdded, variant = 'full' }: UploadAreaProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleFiles = useCallback((fileList: FileList | null) => {
    if (!fileList) return;

    const videoFiles: VideoFile[] = Array.from(fileList)
      .filter(file => file.type.startsWith('video/'))
      .map(file => ({
        id: `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: file.name,
        duration: Math.floor(Math.random() * 60) + 10, // Placeholder
        thumbnail: URL.createObjectURL(file),
        resolution: '1920x1080',
        size: file.size,
        status: 'ready' as const,
        file,
      }));

    if (videoFiles.length > 0) {
      onFilesAdded(videoFiles);
    }
  }, [onFilesAdded]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files);
    e.target.value = '';
  }, [handleFiles]);

  if (variant === 'compact') {
    return (
      <label className="cursor-pointer">
        <input
          type="file"
          accept="video/*"
          multiple
          className="hidden"
          onChange={handleInputChange}
        />
        <Button variant="outline" size="sm" className="w-full" asChild>
          <span>
            <Plus className="w-4 h-4 mr-2" />
            Add clips
          </span>
        </Button>
      </label>
    );
  }

  return (
    <div
      className={cn(
        'relative flex flex-col items-center justify-center p-12 rounded-xl border-2 border-dashed transition-all duration-200',
        isDragging
          ? 'border-primary bg-primary/5 scale-[1.01]'
          : 'border-border hover:border-primary/50 hover:bg-muted/50'
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className={cn(
        'flex items-center justify-center w-16 h-16 rounded-full mb-6 transition-colors',
        isDragging ? 'bg-primary/20' : 'bg-muted'
      )}>
        {isDragging ? (
          <Upload className="w-8 h-8 text-primary animate-pulse-soft" />
        ) : (
          <Film className="w-8 h-8 text-muted-foreground" />
        )}
      </div>

      <h3 className="text-lg font-semibold mb-2">
        {isDragging ? 'Drop your clips here' : 'Upload video clips'}
      </h3>

      <p className="text-sm text-muted-foreground mb-6 text-center max-w-sm">
        Drag and drop your video files, or click to browse.
        <br />
        <span className="text-xs">Supports MP4, MOV, WebM, and AVI</span>
      </p>

      <label className="cursor-pointer">
        <input
          type="file"
          accept="video/*"
          multiple
          className="hidden"
          onChange={handleInputChange}
        />
        <Button size="lg" className="shadow-card hover:shadow-card-hover" asChild>
          <span>
            <Upload className="w-4 h-4 mr-2" />
            Choose files
          </span>
        </Button>
      </label>

      <p className="text-xs text-muted-foreground mt-6 flex items-center gap-1">
        <span className="inline-block w-2 h-2 rounded-full bg-success" />
        Files never leave your device
      </p>
    </div>
  );
}
