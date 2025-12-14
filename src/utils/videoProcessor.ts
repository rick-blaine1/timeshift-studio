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
  onFrameProgress?: (frame: number, fps: number, fullLogLine?: string) => void;
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
  console.log('[VideoProcessor] Clips received:', clips.map(c => ({ id: c.id, fileId: c.fileId, trimStart: c.trimStart, trimEnd: c.trimEnd, duration: c.duration, order: c.order })));
  console.log('[VideoProcessor] Files received:', files.map(f => ({ id: f.id, name: f.name, duration: f.duration })));

  try {
    console.log('[VideoProcessor] Initializing FFmpeg...');
    await initFFmpeg();
    console.log('[VideoProcessor] FFmpeg initialized successfully');

    // Report initial progress
    if (options.onProgress) {
      options.onProgress(5);
    }

    // Prepare input files - retrieve blobs from storage and trim each clip
    const videoBlobs: Blob[] = [];
    let progressStep = 0;
    const progressPerClip = clips.length > 0 ? 30 / clips.length : 0; // Avoid division by zero
    
    for (let i = 0; i < clips.length; i++) {
      const clip = clips[i];
      const file = files.find(f => f.id === clip.fileId);
      if (!file) {
        throw new VideoProcessingError(
          `File not found for clip ${clip.id}`,
          ErrorCodes.FILE_NOT_FOUND
        );
      }
      console.log('[VideoProcessor] Processing clip', {
        clipId: clip.id,
        fileId: clip.fileId,
        trimStart: clip.trimStart,
        trimEnd: clip.trimEnd,
        duration: clip.duration,
        order: i
      });
  
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

      // Trim the clip if needed (trimStart and trimEnd are defined)
      let processedBlob = blob;
      if (clip.trimStart !== undefined && clip.trimEnd !== undefined &&
          (clip.trimStart > 0 || clip.trimEnd < file.duration)) {
        console.log(`[VideoProcessor] Trimming clip ${clip.id} from ${clip.trimStart}s to ${clip.trimEnd}s`);
        
        // Use the clip's individual speed multiplier if set, otherwise use 1 (no speed change during trim)
        const clipSpeed = clip.speedMultiplier || 1;
        
        // Simulate progress for this clip since FFmpeg doesn't report accurate progress with speed changes
        const clipStartProgress = 5 + progressStep;
        const clipDuration = clip.trimEnd - clip.trimStart;
        const estimatedProcessingTime = clipDuration * 100; // Rough estimate: 100ms per second of video
        
        // Start a progress simulation
        let simulatedProgress = 0;
        const progressInterval = setInterval(() => {
          simulatedProgress += 2; // Increment by 2% every interval
          console.log(`[VideoProcessor][Clip ${clip.id}] Simulated Progress Update: simulatedProgress=${simulatedProgress}`);
          if (simulatedProgress < 90) { // Cap at 90% until actual completion
            const constrainedSimulatedProgress = Math.min(simulatedProgress, 99); // Cap simulated progress at 99
            const mappedProgress = clipStartProgress + (constrainedSimulatedProgress / 100) * progressPerClip;
            if (options.onProgress) {
              console.log(`[VideoProcessor][Clip ${clip.id}] Reporting Mapped Progress: ${Math.floor(mappedProgress)}`);
              options.onProgress(Math.floor(mappedProgress));
            }
          }
        }, estimatedProcessingTime / 100); // Update 100 times during processing for smoother animation
        
        try {
          processedBlob = await trimVideo(
            blob,
            clip.trimStart,
            clip.trimEnd,
            clipSpeed,
            `clip_${clip.id}.mp4`,
            (trimProgress) => {
              // Map trim progress to overall progress range for this clip
              const mappedProgress = clipStartProgress + (trimProgress / 100) * progressPerClip;
              if (options.onProgress) {
                console.log(`[VideoProcessor][Clip ${clip.id}] Reporting Mapped (FFmpeg Trim) Progress: ${Math.floor(mappedProgress)} (trimProgress: ${trimProgress})`);
                options.onProgress(Math.floor(mappedProgress));
              }
            },
            options.onFrameProgress
          );
        } finally {
          clearInterval(progressInterval);
          console.log(`[VideoProcessor][Clip ${clip.id}] Cleared trim progress interval.`);
        }
      }

      videoBlobs.push(processedBlob);
      console.log('[VideoProcessor] Added blob for clip', clip.id, 'size', processedBlob.size, 'type', processedBlob.type, 'processedBlob:', processedBlob);
      
      progressStep += progressPerClip;
      if (options.onProgress) {
        options.onProgress(5 + Math.floor(progressStep));
      }
    }

    console.log('[VideoProcessor] Final videoBlobs array before concatenation:', videoBlobs.length, 'blobs:', videoBlobs.map((b, index) => ({ index: index, size: b.size, type: b.type })));

    console.log('[VideoProcessor] Starting concatenation with speed:', options.speedMultiplier);
    console.log('[VideoProcessor] Number of processed clips to concatenate:', videoBlobs.length);

    // Blend simulated and native FFmpeg progress for concatenation
    const concatStartProgress = 35;
    const concatEndProgress = 70;
    const estimatedConcatDuration = Math.max(videoBlobs.length * 500, 5000); // At least 5 seconds, rough estimate: 500ms per video

    let simulatedConcatProgress = 0;
    let nativeConcatProgress = 0;
    let concatProgressInterval: NodeJS.Timeout | undefined;

    // Start simulated progress immediately
    if (options.onProgress) {
      // Report initial progress
      options.onProgress(concatStartProgress);
      
      concatProgressInterval = setInterval(() => {
        simulatedConcatProgress += 2; // Increment by 2% every interval
        console.log(`[VideoProcessor][Concat] Simulated Progress Update: simulatedConcatProgress=${simulatedConcatProgress}`);
        if (simulatedConcatProgress < 90) { // Cap at 90% until actual completion
          // Report the maximum of simulated or native progress
          const constrainedSimulatedProgress = Math.min(simulatedConcatProgress, 99); // Cap simulated progress at 99
          const effectiveProgress = Math.max(constrainedSimulatedProgress, nativeConcatProgress);
          const mappedProgress = concatStartProgress + (effectiveProgress / 100) * (concatEndProgress - concatStartProgress);
          if (options.onProgress) {
            console.log(`[VideoProcessor][Concat] Reporting Mapped Progress: ${Math.floor(mappedProgress)} (simulated: ${simulatedConcatProgress}, native: ${nativeConcatProgress})`);
            options.onProgress(Math.floor(mappedProgress));
          }
        }
      }, estimatedConcatDuration / 100); // Update 100 times during processing for smoother animation
    }

    let resultBlob: Blob;
    try {
      // Concatenate videos with speed adjustment
      // Note: Individual clip speeds were already applied during trimming
      // The global speed multiplier is applied here for any clips that didn't have individual speeds
      resultBlob = await concatVideos(
        videoBlobs,
        options.speedMultiplier,
        'output.mp4',
        (nativeProgress) => {
          // Update native progress from FFmpeg
          nativeConcatProgress = nativeProgress;
          console.log(`[VideoProcessor][Concat] Native FFmpeg Progress: ${nativeConcatProgress}`);
          // Report the maximum of simulated or native progress
          const constrainedSimulatedProgress = Math.min(simulatedConcatProgress, 99); // Cap simulated progress at 99
          const effectiveProgress = Math.max(constrainedSimulatedProgress, nativeConcatProgress);
          const mappedProgress = concatStartProgress + (effectiveProgress / 100) * (concatEndProgress - concatStartProgress);
          if (options.onProgress) {
            console.log(`[VideoProcessor][Concat] Reporting Mapped (FFmpeg Concat) Progress: ${Math.floor(mappedProgress)} (simulated: ${simulatedConcatProgress}, native: ${nativeConcatProgress})`);
            options.onProgress(Math.floor(mappedProgress));
          }
        },
        options.onFrameProgress
      );
      if (options.onProgress) {
        console.log(`[VideoProcessor][Concat] Explicitly reporting concatEndProgress: ${concatEndProgress}`);
        options.onProgress(concatEndProgress); // Jump to end of concat range
      }
    } finally {
      if (concatProgressInterval) {
        clearInterval(concatProgressInterval);
      }
    }

    console.log('[VideoProcessor] Concatenation complete, starting transcode check');

    // Transcode to apply quality settings if needed
    let finalBlob = resultBlob;
    if (options.format !== 'mp4' || options.quality !== 'medium') {
      console.log('[VideoProcessor] Starting transcode to format:', options.format, 'quality:', options.quality);

      // Blend simulated and native FFmpeg progress for transcode
      const transcodeStartProgress = concatEndProgress; // 70
      const transcodeEndProgress = 95;
      // Estimate transcode duration (e.g., 10 seconds per minute of video, adjusted for quality)
      const estimatedTranscodeDuration = Math.max((resultBlob.size / (1024 * 1024)) * 1000 * (options.quality === 'low' ? 0.5 : options.quality === 'medium' ? 1 : 2), 5000); // At least 5 seconds
      
      let simulatedTranscodeProgress = 0;
      let nativeTranscodeProgress = 0;
      let transcodeProgressInterval: NodeJS.Timeout | undefined;

      // Start simulated progress immediately
      if (options.onProgress) {
        // Report initial progress
        options.onProgress(transcodeStartProgress);
        
        transcodeProgressInterval = setInterval(() => {
          simulatedTranscodeProgress += 2; // Increment by 2% every interval
          console.log(`[VideoProcessor][Transcode] Simulated Progress Update: simulatedTranscodeProgress=${simulatedTranscodeProgress}`);
          if (simulatedTranscodeProgress < 90) { // Cap at 90% until actual completion
            // Report the maximum of simulated or native progress
            const constrainedSimulatedProgress = Math.min(simulatedTranscodeProgress, 99); // Cap simulated progress at 99
            const effectiveProgress = Math.max(constrainedSimulatedProgress, nativeTranscodeProgress);
            const mappedProgress = transcodeStartProgress + (effectiveProgress / 100) * (transcodeEndProgress - transcodeStartProgress);
            if (options.onProgress) {
              console.log(`[VideoProcessor][Transcode] Reporting Mapped Progress: ${Math.floor(mappedProgress)} (simulated: ${simulatedTranscodeProgress}, native: ${nativeTranscodeProgress})`);
              options.onProgress(Math.floor(mappedProgress));
            }
          }
        }, estimatedTranscodeDuration / 100); // Update 100 times during processing for smoother animation
      }

      try {
        finalBlob = await transcodeVideo(resultBlob, {
          format: options.format,
          quality: options.quality,
          speedMultiplier: 1, // Speed already applied in concat
          removeAudio: true, // Always remove audio for timelapse
          onProgress: (nativeProgress) => {
            // Update native progress from FFmpeg
            nativeTranscodeProgress = nativeProgress;
            console.log(`[VideoProcessor][Transcode] Native FFmpeg Progress: ${nativeTranscodeProgress}`);
            // Report the maximum of simulated or native progress
            const constrainedSimulatedProgress = Math.min(simulatedTranscodeProgress, 99); // Cap simulated progress at 99
            const effectiveProgress = Math.max(constrainedSimulatedProgress, nativeTranscodeProgress);
            const mappedProgress = transcodeStartProgress + (effectiveProgress / 100) * (transcodeEndProgress - transcodeStartProgress);
            if (options.onProgress) {
              console.log(`[VideoProcessor][Transcode] Reporting Mapped (FFmpeg Transcode) Progress: ${Math.floor(mappedProgress)} (simulated: ${simulatedTranscodeProgress}, native: ${nativeTranscodeProgress})`);
              options.onProgress(Math.floor(mappedProgress));
            }
          },
          onFrameProgress: options.onFrameProgress
        });
        if (options.onProgress) {
          console.log(`[VideoProcessor][Transcode] Explicitly reporting transcodeEndProgress: ${transcodeEndProgress}`);
          options.onProgress(transcodeEndProgress); // Jump to end of transcode range
        }
      } finally {
        if (transcodeProgressInterval) {
          clearInterval(transcodeProgressInterval);
        }
      }
      
      console.log('[VideoProcessor] Transcode complete');
    } else {
      console.log('[VideoProcessor] Skipping transcode (already mp4 medium quality)');
      // Still report progress to 95% even if we skip transcode
      if (options.onProgress) {
        console.log('[VideoProcessor] Skipping transcode, explicitly reporting 95% progress.');
        options.onProgress(95);
      }
    }

    // Report completion
    if (options.onProgress) {
      console.log('[VideoProcessor] Explicitly reporting final 100% progress.');
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