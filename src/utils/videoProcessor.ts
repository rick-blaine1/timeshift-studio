import { VideoFileSchema } from '@/types/schema/VideoFile';
import { TimelineClipSchema } from '@/types/schema/Timeline';
import {
  VideoProcessingError,
  MemoryError,
  StorageError,
  ErrorCodes,
  checkMemoryUsage,
  retryWithBackoff,
  logError
} from './errorHandling';

export interface VideoProcessingOptions {
  speedMultiplier: number;
  quality: 'low' | 'medium' | 'high';
  format: 'mp4' | 'webm';
  onProgress?: (progress: number) => void;
  maxMemoryUsage?: number; // Maximum memory usage in MB
}

export interface ProcessingResult {
  blob: Blob;
  duration: number;
  size: number;
}

interface MemoryStats {
  used: number;
  total: number;
  limit: number;
}

/**
 * Basic video processor for Phase 1 - simple concatenation with speed adjustment
 * Uses MediaRecorder API for basic video processing
 */
export class VideoProcessor {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private maxMemoryUsage: number;
  private memoryCheckInterval: number | null = null;

  constructor(maxMemoryUsage: number = 500) { // Default 500MB limit
    this.maxMemoryUsage = maxMemoryUsage * 1024 * 1024; // Convert to bytes
    
    try {
      this.canvas = document.createElement('canvas');
      const ctx = this.canvas.getContext('2d');
      if (!ctx) {
        throw new VideoProcessingError(
          'Could not get canvas 2D context',
          ErrorCodes.PROCESSING_FAILED
        );
      }
      this.ctx = ctx;
    } catch (error) {
      logError(error as Error, { component: 'VideoProcessor', method: 'constructor' });
      throw error;
    }
  }

  /**
   * Get current memory usage statistics
   */
  private getMemoryStats(): MemoryStats | null {
    if ('memory' in performance) {
      const memInfo = (performance as any).memory;
      return {
        used: memInfo.usedJSHeapSize,
        total: memInfo.totalJSHeapSize,
        limit: memInfo.jsHeapSizeLimit,
      };
    }
    return null;
  }

  /**
   * Check memory usage and throw error if exceeding limits
   */
  private checkMemoryLimits(): void {
    const stats = this.getMemoryStats();
    if (stats) {
      const usagePercent = stats.used / stats.limit;
      
      if (usagePercent > 0.9) {
        throw new MemoryError(
          'Memory usage too high',
          stats.limit - stats.used,
          stats.used
        );
      }
      
      if (stats.used > this.maxMemoryUsage) {
        throw new MemoryError(
          'Exceeded maximum memory usage limit',
          this.maxMemoryUsage,
          stats.used
        );
      }
    }
  }

  /**
   * Start memory monitoring
   */
  private startMemoryMonitoring(): void {
    this.memoryCheckInterval = window.setInterval(() => {
      try {
        this.checkMemoryLimits();
      } catch (error) {
        if (this.memoryCheckInterval) {
          clearInterval(this.memoryCheckInterval);
          this.memoryCheckInterval = null;
        }
        throw error;
      }
    }, 1000); // Check every second
  }

  /**
   * Stop memory monitoring
   */
  private stopMemoryMonitoring(): void {
    if (this.memoryCheckInterval) {
      clearInterval(this.memoryCheckInterval);
      this.memoryCheckInterval = null;
    }
  }

  /**
   * Process timeline clips into a single video
   */
  async processTimeline(
    clips: TimelineClipSchema[],
    files: VideoFileSchema[],
    options: VideoProcessingOptions
  ): Promise<ProcessingResult> {
    try {
      if (clips.length === 0) {
        throw new VideoProcessingError(
          'No clips to process',
          ErrorCodes.PROCESSING_FAILED
        );
      }

      // Start memory monitoring
      this.startMemoryMonitoring();

      // Initial memory check
      this.checkMemoryLimits();

      // Sort clips by order
      const sortedClips = [...clips].sort((a, b) => a.order - b.order);
      
      // Calculate total duration
      const totalDuration = sortedClips.reduce((sum, clip) => sum + clip.duration, 0);
      const adjustedDuration = totalDuration / options.speedMultiplier;

      // Set canvas dimensions based on first video
      const firstFile = files.find(f => f.id === sortedClips[0].fileId);
      if (!firstFile) {
        throw new VideoProcessingError(
          'First clip file not found',
          ErrorCodes.FILE_NOT_FOUND
        );
      }

      this.canvas.width = firstFile.width;
      this.canvas.height = firstFile.height;

      // Create video stream from canvas
      const stream = this.canvas.captureStream(30); // 30 FPS

      // Setup MediaRecorder with error handling
      const mimeType = options.format === 'mp4' ? 'video/mp4' : 'video/webm';
      
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        throw new VideoProcessingError(
          `Format ${options.format} is not supported`,
          ErrorCodes.UNSUPPORTED_FORMAT
        );
      }

      this.mediaRecorder = new MediaRecorder(stream, {
        mimeType: mimeType,
        videoBitsPerSecond: this.getVideoBitrate(options.quality)
      });

      this.recordedChunks = [];
      
      return new Promise(async (resolve, reject) => {
        if (!this.mediaRecorder) {
          reject(new VideoProcessingError(
            'MediaRecorder not initialized',
            ErrorCodes.PROCESSING_FAILED
          ));
          return;
        }

        this.mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            this.recordedChunks.push(event.data);
            
            // Check memory after each chunk
            try {
              this.checkMemoryLimits();
            } catch (error) {
              this.mediaRecorder?.stop();
              reject(error);
            }
          }
        };

        this.mediaRecorder.onstop = () => {
          this.stopMemoryMonitoring();
          
          try {
            const blob = new Blob(this.recordedChunks, { type: mimeType });
            resolve({
              blob,
              duration: adjustedDuration,
              size: blob.size
            });
          } catch (error) {
            reject(new VideoProcessingError(
              'Failed to create output blob',
              ErrorCodes.ENCODING_FAILED,
              error
            ));
          }
        };

        this.mediaRecorder.onerror = (event) => {
          this.stopMemoryMonitoring();
          reject(new VideoProcessingError(
            `MediaRecorder error: ${event}`,
            ErrorCodes.ENCODING_FAILED
          ));
        };

        try {
          // Start recording
          this.mediaRecorder.start();

          // Process each clip with retry logic
          let processedDuration = 0;
          for (let i = 0; i < sortedClips.length; i++) {
            const clip = sortedClips[i];
            const file = files.find(f => f.id === clip.fileId);
            
            if (!file) {
              throw new VideoProcessingError(
                `File not found for clip ${clip.id}`,
                ErrorCodes.FILE_NOT_FOUND
              );
            }

            await retryWithBackoff(
              () => this.processClip(clip, file, options.speedMultiplier),
              2, // Max 2 retries
              500 // 500ms base delay
            );
            
            processedDuration += clip.duration;
            if (options.onProgress) {
              options.onProgress((processedDuration / totalDuration) * 100);
            }

            // Memory check between clips
            this.checkMemoryLimits();
          }

          // Stop recording
          this.mediaRecorder.stop();
        } catch (error) {
          this.stopMemoryMonitoring();
          logError(error as Error, {
            component: 'VideoProcessor',
            method: 'processTimeline',
            clipCount: clips.length,
            totalDuration
          });
          reject(error);
        }
      });
    } catch (error) {
      this.stopMemoryMonitoring();
      throw error;
    }
  }

  /**
   * Process a single clip
   */
  private async processClip(
    clip: TimelineClipSchema,
    file: VideoFileSchema,
    speedMultiplier: number
  ): Promise<void> {
    return new Promise(async (resolve, reject) => {
      let videoUrl: string | null = null;
      
      try {
        const video = document.createElement('video');
        video.muted = true;
        video.playsInline = true;
        video.crossOrigin = 'anonymous';

        // Load video file with error handling
        if (file.fileHandle) {
          // Use File System Access API if available
          try {
            const fileData = await file.fileHandle.getFile();
            videoUrl = URL.createObjectURL(fileData);
          } catch (error) {
            throw new StorageError(
              `Failed to access file: ${error}`,
              ErrorCodes.STORAGE_ACCESS_DENIED,
              error
            );
          }
        } else if (file.indexedDBKey) {
          // Load from IndexedDB
          try {
            const { storageService } = await import('@/services/storage');
            const blob = await storageService.loadVideoFile(file.id);
            videoUrl = URL.createObjectURL(blob);
          } catch (error) {
            throw new StorageError(
              `Failed to load video from storage: ${error}`,
              ErrorCodes.FILE_NOT_FOUND,
              error
            );
          }
        } else {
          throw new VideoProcessingError(
            'No video file source available',
            ErrorCodes.FILE_NOT_FOUND
          );
        }

        video.onloadedmetadata = () => {
          try {
            const startTime = clip.trimStart || 0;
            const endTime = clip.trimEnd || file.duration;
            const clipDuration = endTime - startTime;
            
            if (clipDuration <= 0) {
              throw new VideoProcessingError(
                'Invalid clip duration',
                ErrorCodes.PROCESSING_FAILED
              );
            }
            
            video.currentTime = startTime;
            
            let frameCount = 0;
            const targetFrames = Math.floor((clipDuration / speedMultiplier) * 30); // 30 FPS
            const frameInterval = (clipDuration * 1000) / targetFrames; // ms per frame

            const drawFrame = () => {
              try {
                if (frameCount >= targetFrames) {
                  if (videoUrl) URL.revokeObjectURL(videoUrl);
                  resolve();
                  return;
                }

                // Memory check before drawing
                this.checkMemoryLimits();

                // Draw current frame to canvas
                this.ctx.drawImage(video, 0, 0, this.canvas.width, this.canvas.height);
                
                frameCount++;
                
                // Advance video time
                const newTime = startTime + (frameCount * clipDuration / targetFrames);
                if (newTime < endTime) {
                  video.currentTime = newTime;
                  setTimeout(drawFrame, frameInterval);
                } else {
                  if (videoUrl) URL.revokeObjectURL(videoUrl);
                  resolve();
                }
              } catch (error) {
                if (videoUrl) URL.revokeObjectURL(videoUrl);
                reject(error);
              }
            };

            video.onseeked = () => {
              drawFrame();
            };
          } catch (error) {
            if (videoUrl) URL.revokeObjectURL(videoUrl);
            reject(error);
          }
        };

        video.onerror = (event) => {
          if (videoUrl) URL.revokeObjectURL(videoUrl);
          
          const errorCode = video.error?.code;
          let errorMessage = 'Failed to load video';
          let code = ErrorCodes.PROCESSING_FAILED;
          
          switch (errorCode) {
            case MediaError.MEDIA_ERR_ABORTED:
              errorMessage = 'Video loading was aborted';
              break;
            case MediaError.MEDIA_ERR_NETWORK:
              errorMessage = 'Network error while loading video';
              code = ErrorCodes.NETWORK_ERROR;
              break;
            case MediaError.MEDIA_ERR_DECODE:
              errorMessage = 'Video decoding failed - file may be corrupted';
              code = ErrorCodes.CORRUPTED_FILE;
              break;
            case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
              errorMessage = 'Video format not supported';
              code = ErrorCodes.UNSUPPORTED_FORMAT;
              break;
          }
          
          reject(new VideoProcessingError(
            `${errorMessage} for clip ${clip.id}`,
            code,
            { clipId: clip.id, fileId: file.id, errorCode }
          ));
        };

        video.src = videoUrl;
        video.load();

      } catch (error) {
        if (videoUrl) URL.revokeObjectURL(videoUrl);
        
        if (error instanceof VideoProcessingError || error instanceof StorageError) {
          reject(error);
        } else {
          reject(new VideoProcessingError(
            `Failed to process clip ${clip.id}: ${error}`,
            ErrorCodes.PROCESSING_FAILED,
            { clipId: clip.id, fileId: file.id, originalError: error }
          ));
        }
      }
    });
  }

  /**
   * Get video bitrate based on quality setting
   */
  private getVideoBitrate(quality: 'low' | 'medium' | 'high'): number {
    switch (quality) {
      case 'low':
        return 1000000; // 1 Mbps
      case 'medium':
        return 2500000; // 2.5 Mbps
      case 'high':
        return 5000000; // 5 Mbps
      default:
        return 2500000;
    }
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
    this.recordedChunks = [];
  }
}

/**
 * Simple video concatenation using canvas and MediaRecorder
 * This is a basic implementation for Phase 1
 */
export async function concatenateVideos(
  clips: TimelineClipSchema[],
  files: VideoFileSchema[],
  options: VideoProcessingOptions
): Promise<ProcessingResult> {
  const processor = new VideoProcessor();
  
  try {
    const result = await processor.processTimeline(clips, files, options);
    return result;
  } finally {
    processor.dispose();
  }
}

/**
 * Create a downloadable blob URL from processed video
 */
export function createDownloadUrl(blob: Blob): string {
  return URL.createObjectURL(blob);
}

/**
 * Download processed video file
 */
export function downloadVideo(blob: Blob, filename: string): void {
  const url = createDownloadUrl(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}