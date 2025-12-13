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
import { initFFmpeg, trimVideo, concatVideos, transcodeVideo } from './ffmpeg';
import { createQueue } from './queue';
import { storageService } from '@/services/storage';

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
 * Optimized video processor using Web Workers for frame processing
 */
export class VideoProcessor {
  private maxMemoryUsage: number;

  constructor(maxMemoryUsage: number = 500) {
    this.maxMemoryUsage = maxMemoryUsage * 1024 * 1024;
  }

  /**
   * Process timeline clips into a single video using FFmpeg
   */
  async processTimeline(
    clips: TimelineClipSchema[],
    files: VideoFileSchema[],
    options: VideoProcessingOptions
  ): Promise<ProcessingResult> {
    // Delegate to concatenateVideos function
    return concatenateVideos(clips, files, options);
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    // No resources to clean up
  }
}

/**
 * Simple video concatenation using FFmpeg with speed adjustment and audio removal
 */
export async function concatenateVideos(
  clips: TimelineClipSchema[],
  files: VideoFileSchema[],
  options: VideoProcessingOptions
): Promise<ProcessingResult> {
  console.log('[VideoProcessor] concatenateVideos called with:', {
    clipsCount: clips.length,
    filesCount: files.length,
    options
  });
  
  try {
    console.log('[VideoProcessor] Initializing FFmpeg...');
    await initFFmpeg();
    console.log('[VideoProcessor] FFmpeg initialized successfully');

    // Report initial progress
    if (options.onProgress) {
      options.onProgress(5);
    }

    // Prepare input files - retrieve blobs from storage
    const videoBlobs: Blob[] = [];
    let progressStep = 0;
    const progressPerFile = 30 / clips.length; // 30% for file loading

    for (const clip of clips) {
      const file = files.find(f => f.id === clip.fileId);
      if (!file) {
        throw new VideoProcessingError(
          `File not found for clip ${clip.id}`,
          ErrorCodes.FILE_NOT_FOUND
        );
      }

      // Retrieve blob from storage
      let blob: Blob;
      if (file.indexedDBKey) {
        try {
          blob = await storageService.loadVideoFile(file.id);
        } catch (error) {
          throw new StorageError(
            `Failed to load video file ${file.id} from storage`,
            ErrorCodes.STORAGE_ACCESS_DENIED,
            error
          );
        }
      } else if (file.fileHandle) {
        try {
          const fileData = await file.fileHandle.getFile();
          blob = fileData;
        } catch (error) {
          throw new StorageError(
            `Failed to load video file ${file.id} from file handle`,
            ErrorCodes.STORAGE_ACCESS_DENIED,
            error
          );
        }
      } else {
        throw new VideoProcessingError(
          `No storage reference found for file ${file.id}`,
          ErrorCodes.FILE_NOT_FOUND
        );
      }

      videoBlobs.push(blob);
      
      progressStep += progressPerFile;
      if (options.onProgress) {
        options.onProgress(5 + Math.floor(progressStep));
      }
    }

    // Report concatenation start
    if (options.onProgress) {
      options.onProgress(35);
    }

    console.log('[VideoProcessor] Starting concatenation with speed:', options.speedMultiplier);

    // Concatenate videos with speed adjustment and progress reporting
    const resultBlob = await concatVideos(
      videoBlobs,
      options.speedMultiplier,
      'output.mp4',
      (ffmpegProgress) => {
        // Map FFmpeg progress (0-100) to our range (35-70)
        const mappedProgress = 35 + (ffmpegProgress * 0.35);
        console.log('[VideoProcessor] FFmpeg concat progress:', ffmpegProgress, '-> mapped:', mappedProgress);
        if (options.onProgress) {
          options.onProgress(Math.floor(mappedProgress));
        }
      }
    );

    console.log('[VideoProcessor] Concatenation complete, starting transcode check');

    // Transcode to apply quality settings if needed
    let finalBlob = resultBlob;
    if (options.format !== 'mp4' || options.quality !== 'medium') {
      console.log('[VideoProcessor] Starting transcode to format:', options.format, 'quality:', options.quality);
      
      finalBlob = await transcodeVideo(resultBlob, {
        format: options.format,
        quality: options.quality,
        speedMultiplier: 1, // Speed already applied in concat
        removeAudio: true, // Always remove audio for timelapse
        onProgress: (ffmpegProgress) => {
          // Map FFmpeg progress (0-100) to our range (70-95)
          const mappedProgress = 70 + (ffmpegProgress * 0.25);
          console.log('[VideoProcessor] FFmpeg transcode progress:', ffmpegProgress, '-> mapped:', mappedProgress);
          if (options.onProgress) {
            options.onProgress(Math.floor(mappedProgress));
          }
        }
      });
      
      console.log('[VideoProcessor] Transcode complete');
    } else {
      console.log('[VideoProcessor] Skipping transcode (already mp4 medium quality)');
      // Still report progress to 95% even if we skip transcode
      if (options.onProgress) {
        options.onProgress(95);
      }
    }

    // Report completion
    if (options.onProgress) {
      options.onProgress(100);
    }

    // Calculate output duration based on speed multiplier
    const totalDuration = clips.reduce((sum, clip) => sum + clip.duration, 0);
    const outputDuration = totalDuration / options.speedMultiplier;

    return {
      blob: finalBlob,
      duration: outputDuration,
      size: finalBlob.size
    };
  } catch (error) {
    logError(error as Error, { clips: clips.length, files: files.length });
    throw error;
  }
}

/**
 * Process videos sequentially using a queue
 */
export async function processBatchSequentially(
  batches: { clips: TimelineClipSchema[]; files: VideoFileSchema[] }[],
  options: VideoProcessingOptions,
  onProgress: (batchIndex: number, progress: number) => void
): Promise<ProcessingResult[]> {
  const results: ProcessingResult[] = [];
  const queue = createQueue(1); // Sequential processing

  const promises = batches.map((batch, i) =>
    queue.add(async () => {
      try {
        const result = await concatenateVideos(batch.clips, batch.files, {
          ...options,
          onProgress: (p) => {
            onProgress(i, p);
          }
        });
        results.push(result);
        return result;
      } catch (error) {
        logError(error as Error, { batchIndex: i });
        throw error;
      }
    })
  );

  await Promise.all(promises);
  return results;
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