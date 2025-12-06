import { useState, useEffect, useCallback } from 'react';
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
import { ExportStatus, VideoFile, TimelineClip, ExportSettings } from '@/types/editor';
import { concatenateVideos, downloadVideo, VideoProcessingOptions } from '@/utils/videoProcessor';
import {
  getUserFriendlyErrorMessage,
  getErrorRecoverySuggestions,
  VideoProcessingError,
  StorageError,
  MemoryError
} from '@/utils/errorHandling';
import { performanceMonitor } from '@/utils/performanceMonitor';
import { cn } from '@/lib/utils';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  outputDuration: number;
  resolution: string;
  clipCount: number;
  clips: TimelineClip[];
  files: VideoFile[];
  exportSettings: ExportSettings;
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
  clips,
  files,
  exportSettings,
}: ExportModalProps) {
  const [status, setStatus] = useState<ExportStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [exportedBlob, setExportedBlob] = useState<Blob | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [errorSuggestions, setErrorSuggestions] = useState<string[]>([]);
  const [processingSessionId, setProcessingSessionId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setStatus('idle');
      setProgress(0);
      setExportedBlob(null);
      setErrorMessage('');
      setErrorSuggestions([]);
      
      // End performance monitoring if still active
      if (processingSessionId) {
        performanceMonitor.endVideoProcessing(processingSessionId);
        setProcessingSessionId(null);
      }
    }
  }, [isOpen, processingSessionId]);

  const handleStartExport = useCallback(async () => {
    if (clips.length === 0) {
      setStatus('error');
      setErrorMessage('No clips to export');
      setErrorSuggestions(['Add video clips to the timeline before exporting']);
      return;
    }

    try {
      setStatus('preparing');
      setProgress(0);
      setErrorMessage('');
      setErrorSuggestions([]);

      // Start performance monitoring
      const totalDuration = clips.reduce((sum, clip) => sum + clip.duration, 0);
      const sessionId = performanceMonitor.startVideoProcessing(clips.length, totalDuration);
      setProcessingSessionId(sessionId);

      // Check performance health before starting
      const healthCheck = performanceMonitor.checkPerformanceHealth();
      if (healthCheck.status === 'critical') {
        console.warn('Performance issues detected before export:', healthCheck);
      }

      // Convert timeline clips to schema format
      const timelineClips = clips.map(clip => ({
        id: clip.id,
        fileId: clip.fileId,
        startTime: clip.startTime,
        duration: clip.duration,
        order: clip.order,
        trimStart: clip.trimStart,
        trimEnd: clip.trimEnd,
        speedMultiplier: clip.speedMultiplier,
        createdAt: clip.createdAt,
        updatedAt: clip.updatedAt,
      }));

      // Convert video files to schema format
      const videoFiles = files.map(file => ({
        id: file.id,
        name: file.name,
        size: file.size,
        type: file.type,
        lastModified: file.lastModified,
        duration: file.duration,
        width: file.width,
        height: file.height,
        framerate: file.framerate,
        bitrate: file.bitrate,
        codec: file.codec,
        thumbnail: file.thumbnail,
        thumbnailTimestamp: file.thumbnailTimestamp,
        status: file.status,
        indexedDBKey: file.indexedDBKey,
        fileHandle: file.fileHandle,
        createdAt: file.createdAt,
        updatedAt: file.updatedAt,
      }));

      const processingOptions: VideoProcessingOptions = {
        speedMultiplier: exportSettings.speedMultiplier,
        quality: exportSettings.quality === 'high' ? 'high' : exportSettings.quality === 'low' ? 'low' : 'medium',
        format: exportSettings.format,
        maxMemoryUsage: 800, // 800MB memory limit
        onProgress: (progressValue) => {
          setProgress(progressValue);
          if (progressValue < 25) {
            setStatus('preparing');
          } else if (progressValue < 90) {
            setStatus('encoding');
          } else {
            setStatus('packaging');
          }
        },
      };

      setStatus('encoding');
      const result = await concatenateVideos(timelineClips, videoFiles, processingOptions);
      
      // End performance monitoring
      performanceMonitor.endVideoProcessing(sessionId);
      setProcessingSessionId(null);
      
      setExportedBlob(result.blob);
      setStatus('done');
      setProgress(100);

    } catch (error) {
      console.error('Export failed:', error);
      
      // End performance monitoring on error
      if (processingSessionId) {
        performanceMonitor.endVideoProcessing(processingSessionId);
        setProcessingSessionId(null);
      }
      
      setStatus('error');
      
      // Get user-friendly error message and suggestions
      const friendlyMessage = getUserFriendlyErrorMessage(error as Error);
      const suggestions = getErrorRecoverySuggestions(error as Error);
      
      setErrorMessage(friendlyMessage);
      setErrorSuggestions(suggestions);
      
      // Log additional context for debugging
      if (error instanceof VideoProcessingError || error instanceof StorageError || error instanceof MemoryError) {
        console.error('Detailed error info:', {
          type: error.constructor.name,
          code: (error as any).code,
          details: (error as any).details,
          memoryUsage: performanceMonitor.getMemoryUsage(),
        });
      }
    }
  }, [clips, files, exportSettings, processingSessionId]);

  const handleDownload = useCallback(() => {
    if (!exportedBlob) {
      console.error('No exported blob available');
      return;
    }

    const filename = `timelapse-${Date.now()}.${exportSettings.format}`;
    downloadVideo(exportedBlob, filename);
  }, [exportedBlob, exportSettings.format]);

  const handleRetry = useCallback(() => {
    setStatus('idle');
    setProgress(0);
    setExportedBlob(null);
    setErrorMessage('');
    setErrorSuggestions([]);
    
    if (processingSessionId) {
      performanceMonitor.endVideoProcessing(processingSessionId);
      setProcessingSessionId(null);
    }
  }, [processingSessionId]);

  const isExporting = ['preparing', 'encoding', 'packaging'].includes(status);
  const isBatchMode = exportSettings.batchMode;

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
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Quality</span>
                  <span className="font-medium">{exportSettings.quality.charAt(0).toUpperCase() + exportSettings.quality.slice(1)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Batch Mode</span>
                  <span className="font-medium">{exportSettings.batchMode ? 'Enabled' : 'Disabled'}</span>
                </div>
              </div>

              <div className="flex gap-3">
                <Button variant="outline" onClick={onClose} className="flex-1">
                  Cancel
                </Button>
                <Button onClick={handleStartExport} className="flex-1">
                  {exportSettings.batchMode ? 'Start Batch Export' : 'Start Export'}
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
              {exportedBlob ? (
                <>
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
                </>
              ) : (
                <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
                  <p className="text-sm text-destructive font-medium">
                    Export completed but no video was generated
                  </p>
                </div>
              )}
            </div>
          )}

          {status === 'error' && (
            <div className="space-y-4">
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
                <p className="text-sm text-destructive font-medium mb-2">
                  {errorMessage || 'Something went wrong during export.'}
                </p>
                {errorSuggestions.length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs text-muted-foreground mb-2">Try these solutions:</p>
                    <ul className="text-xs text-muted-foreground space-y-1">
                      {errorSuggestions.map((suggestion, index) => (
                        <li key={index}>• {suggestion}</li>
                      ))}
                    </ul>
                  </div>
                )}
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
