import { useState, useCallback } from 'react';
import { VideoFile } from '@/types/editor';
import { Film, Zap, Lock, Clock, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useFileUpload } from '@/hooks/useFileUpload';

interface LandingScreenProps {
  onFilesAdded: (files: VideoFile[]) => void;
  onFilesUpdated?: (files: VideoFile[]) => void;
  onLoadSample: () => void;
}

export function LandingScreen({ onFilesAdded, onFilesUpdated, onLoadSample }: LandingScreenProps) {
  const [isDragging, setIsDragging] = useState(false);
  const { fileInputRef, handleFiles, handleInputChange, handleClick } = useFileUpload({
    onFilesAdded,
    onFilesUpdated,
  });

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

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="h-14 border-b bg-card flex items-center justify-center">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Film className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-semibold text-lg">Timelapse</span>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex items-center justify-center p-8">
        <div className="max-w-xl w-full animate-fade-in">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold mb-3">
              Create stunning timelapses
            </h1>
            <p className="text-lg text-muted-foreground">
              Upload your clips, arrange them, and export — all in your browser.
            </p>
          </div>

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
              <span className="text-xs">Supports MP4 and WebM files (Max 1GB)</span>
            </p>

            <input
              ref={fileInputRef}
              type="file"
              accept="video/mp4,video/webm"
              multiple
              className="hidden"
              onChange={handleInputChange}
            />
            <Button size="lg" className="shadow-card hover:shadow-card-hover" onClick={handleClick}>
              <Upload className="w-4 h-4 mr-2" />
              Choose Files
            </Button>

            <p className="text-xs text-muted-foreground mt-6 flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-full bg-success" />
              Files never leave your device
            </p>
          </div>

          <div className="mt-6 text-center">
            <Button variant="link" onClick={onLoadSample} className="text-muted-foreground">
              Or try with sample clips
            </Button>
          </div>

          {/* Features */}
          <div className="mt-12 grid grid-cols-3 gap-6">
            <div className="text-center">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-2">
                <Lock className="w-5 h-5 text-primary" />
              </div>
              <h3 className="text-sm font-medium mb-1">Private</h3>
              <p className="text-xs text-muted-foreground">Files never leave your device</p>
            </div>
            <div className="text-center">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-2">
                <Zap className="w-5 h-5 text-primary" />
              </div>
              <h3 className="text-sm font-medium mb-1">Fast</h3>
              <p className="text-xs text-muted-foreground">Hardware-accelerated encoding</p>
            </div>
            <div className="text-center">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-2">
                <Clock className="w-5 h-5 text-primary" />
              </div>
              <h3 className="text-sm font-medium mb-1">Simple</h3>
              <p className="text-xs text-muted-foreground">No account required</p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-4 text-center text-xs text-muted-foreground border-t">
        Built with modern web technologies • Client-side processing only
      </footer>
    </div>
  );
}
