import { useState, useEffect } from 'react';
import { Download, X, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { formatDuration } from '@/data/sampleData';
import { ExportStatus } from '@/types/editor';
import { cn } from '@/lib/utils';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  outputDuration: number;
  resolution: string;
  clipCount: number;
}

const statusMessages: Record<ExportStatus, string> = {
  idle: 'Ready to export',
  preparing: 'Preparing files...',
  encoding: 'Encoding video...',
  packaging: 'Packaging output...',
  done: 'Export complete!',
  error: 'Export failed',
};

export function ExportModal({
  isOpen,
  onClose,
  outputDuration,
  resolution,
  clipCount,
}: ExportModalProps) {
  const [status, setStatus] = useState<ExportStatus>('idle');
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!isOpen) {
      setStatus('idle');
      setProgress(0);
    }
  }, [isOpen]);

  const handleStartExport = () => {
    setStatus('preparing');
    setProgress(0);

    // Simulate export progress
    const stages: { status: ExportStatus; duration: number }[] = [
      { status: 'preparing', duration: 1000 },
      { status: 'encoding', duration: 3000 },
      { status: 'packaging', duration: 1000 },
      { status: 'done', duration: 0 },
    ];

    let currentProgress = 0;
    let stageIndex = 0;

    const interval = setInterval(() => {
      currentProgress += 2;
      setProgress(Math.min(currentProgress, 100));

      if (currentProgress >= 25 && stageIndex === 0) {
        setStatus('encoding');
        stageIndex = 1;
      } else if (currentProgress >= 90 && stageIndex === 1) {
        setStatus('packaging');
        stageIndex = 2;
      } else if (currentProgress >= 100) {
        setStatus('done');
        clearInterval(interval);
      }
    }, 100);
  };

  const handleDownload = () => {
    // Simulate download
    const link = document.createElement('a');
    link.href = '#';
    link.download = 'timelapse-export.mp4';
    // In real implementation, this would be a blob URL
    alert('Download would start here (demo mode)');
  };

  const handleRetry = () => {
    setStatus('idle');
    setProgress(0);
  };

  const isExporting = ['preparing', 'encoding', 'packaging'].includes(status);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {status === 'done' ? (
              <CheckCircle2 className="w-5 h-5 text-success" />
            ) : status === 'error' ? (
              <AlertCircle className="w-5 h-5 text-destructive" />
            ) : (
              <Download className="w-5 h-5" />
            )}
            {status === 'done' ? 'Export Complete' : status === 'error' ? 'Export Failed' : 'Export Timelapse'}
          </DialogTitle>
          {status === 'idle' && (
            <DialogDescription>
              Review settings and export your timelapse video.
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="space-y-4 py-4">
          {status === 'idle' && (
            <>
              {/* Summary */}
              <div className="bg-muted rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Output duration</span>
                  <span className="font-medium">{formatDuration(outputDuration)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Resolution</span>
                  <span className="font-medium">{resolution}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Clips</span>
                  <span className="font-medium">{clipCount}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Audio</span>
                  <span className="font-medium text-muted-foreground">Removed (timelapse)</span>
                </div>
              </div>

              <div className="flex gap-3">
                <Button variant="outline" onClick={onClose} className="flex-1">
                  Cancel
                </Button>
                <Button onClick={handleStartExport} className="flex-1">
                  Start Export
                </Button>
              </div>
            </>
          )}

          {isExporting && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
                <span className="text-sm">{statusMessages[status]}</span>
              </div>
              <Progress value={progress} className="h-2" />
              <p className="text-xs text-muted-foreground text-center">
                {progress}% complete
              </p>
            </div>
          )}

          {status === 'done' && (
            <div className="space-y-4">
              <div className="bg-success/10 border border-success/20 rounded-lg p-4 text-center">
                <CheckCircle2 className="w-10 h-10 text-success mx-auto mb-2" />
                <p className="text-sm font-medium">Your timelapse is ready!</p>
              </div>

              <div className="flex gap-3">
                <Button variant="outline" onClick={onClose} className="flex-1">
                  Close
                </Button>
                <Button onClick={handleDownload} className="flex-1">
                  <Download className="w-4 h-4 mr-2" />
                  Download
                </Button>
              </div>
            </div>
          )}

          {status === 'error' && (
            <div className="space-y-4">
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
                <p className="text-sm text-destructive font-medium mb-2">
                  Something went wrong during export.
                </p>
                <ul className="text-xs text-muted-foreground space-y-1">
                  <li>• Try reducing the number of clips</li>
                  <li>• Lower preview quality and try again</li>
                  <li>• Ensure clips are valid video files</li>
                </ul>
              </div>

              <div className="flex gap-3">
                <Button variant="outline" onClick={onClose} className="flex-1">
                  Cancel
                </Button>
                <Button onClick={handleRetry} className="flex-1">
                  Try Again
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
