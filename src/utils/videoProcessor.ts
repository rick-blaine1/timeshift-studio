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
    try {
      if (clips.length === 0) {
        throw new VideoProcessingError(
          'No clips to process',
          ErrorCodes.PROCESSING_FAILED
        );
      }

      // Initialize FFmpeg
      await initFFmpeg();

      // Prepare input files
      const videoFiles: Blob[] = [];
      for (const clip of clips) {
        const file = files.find(f => f.id === clip.fileId);
        if (!file) {
          throw new VideoProcessingError(
            `File not found for clip ${clip.id}`,
            ErrorCodes.FILE_NOT_FOUND
          );
        }
        videoFiles.push(file.blob);
      }

      // Process clips
      let resultBlob: Blob;
      if (clips.length === 1) {
        const clip = clips[0];
        resultBlob = await trimVideo(
          videoFiles[0],
          clip.trimStart,
          clip.trimEnd,
          clip.speedMultiplier || 1,
          'output.mp4'
        );
      } else {
        resultBlob = await concatVideos(videoFiles, clips);
      }

      // Transcode if needed
      if (options.format !== 'mp4') {
        resultBlob = await transcodeVideo(resultBlob, {
          format: options.format,
          quality: options.quality
        });
      }

      return {
        blob: resultBlob,
        duration: clips.reduce((sum, clip) => sum + (clip.end - clip.start), 0),
        size: resultBlob.size
      };
    } catch (error) {
      throw new VideoProcessingError(
        'FFmpeg processing failed',
        ErrorCodes.PROCESSING_FAILED,
        error
      );
    }
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    // No resources to clean up
  }
}

/**
 * Simple video concatenation using FFmpeg
 */
export async function concatenateVideos(
  clips: TimelineClipSchema[],
  files: VideoFileSchema[],
  options: VideoProcessingOptions
): Promise<ProcessingResult> {
  // Initialize FFmpeg
  await initFFmpeg();

  // Prepare input files
  const videoFiles: Blob[] = [];
  for (const clip of clips) {
    const file = files.find(f => f.id === clip.fileId);
    if (!file) {
      throw new VideoProcessingError(
        `File not found for clip ${clip.id}`,
        ErrorCodes.FILE_NOT_FOUND
      );
    }
    videoFiles.push(file.blob);
  }

  const resultBlob = await concatVideos(videoFiles);
  
  // Transcode if needed
  // Always transcode to apply quality settings
  const transcodedBlob = await transcodeVideo(resultBlob, {
    format: options.format,
    quality: options.quality
  });
  
  return {
    blob: transcodedBlob,
    duration: clips.reduce((sum, clip) => sum + (clip.duration), 0),
    size: transcodedBlob.size
  };
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
  const queue = createQueue();

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    await queue.enqueue(async () => {
      try {
        let progress = 0;
        const result = await concatenateVideos(batch.clips, batch.files, {
          ...options,
          onProgress: (p) => {
            progress = p;
            onProgress(i, p);
          }
        });
        results.push(result);
        return result;
      } catch (error) {
        logError(error as Error, { batchIndex: i });
        throw error;
      }
    });
  }

  await queue.process();
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