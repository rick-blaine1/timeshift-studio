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
import { initFFmpeg, trimVideo as trimVideoFFmpeg, concatVideos as concatVideosFFmpeg, transcodeVideo as transcodeVideoFFmpeg, getThumbnail as getThumbnailFFmpeg } from './ffmpeg';
import { getVideoProcessor, VideoProcessor as BaseVideoProcessor } from '../utils/webcodecs';
import type { WebCodecsProcessor as IWebCodecsProcessor, VideoFileReader } from '../utils/webcodecsProcessor';
import { createQueue } from './queue';
import { storageService } from '@/services/storage';

export interface VideoProcessingOptions {
  speedMultiplier: number;
  quality: 'low' | 'medium' | 'high';
  format: 'mp4' | 'webm';
  targetResolution?: { width: number; height: number }; // New property for resolution scaling
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
 * Interface for video processing implementations.
 * This allows for a common interface between WebCodecs and FFmpeg fallback.
 */
export interface IVideoProcessor extends BaseVideoProcessor {
  // Add any additional properties specific to the local IVideoProcessor if needed
  // This interface will be used by videoProcessor.ts, extending the base one from webcodecs.ts
}

/**
 * Helper function to retrieve a video file's Blob or File object.
 * This abstracts away the storage retrieval logic.
 */
async function getVideoFileSource(file: VideoFileSchema): Promise<File> {
  if (file.fileHandle) {
    return await file.fileHandle.getFile();
  } else if (file.indexedDBKey) {
    const blob = await storageService.loadVideoFile(file.id);
    // Convert Blob to File-like object for WebCodecsProcessor
    return new File([blob], file.name, { type: blob.type, lastModified: Date.now() });
  } else {
    throw new VideoProcessingError(
      `No storage reference found for file ${file.id}`,
      ErrorCodes.FILE_NOT_FOUND
    );
  }
}

/**
 * Trims a video segment using either WebCodecs or FFmpeg.
 * Automatically falls back to FFmpeg if WebCodecs fails.
 */
async function trimVideo(
  file: VideoFileSchema,
  blob: Blob,
  trimStart: number,
  trimEnd: number,
  speedMultiplier: number,
  outputFileName: string,
  onProgress?: (progress: number) => void,
  onFrameProgress?: (frame: number, fps: number, fullLogLine?: string) => void
): Promise<Blob> {
  const processor = await getVideoProcessor();

  if (processor.type === 'webcodecs' && processor.processVideo) {
    try {
      console.log('[VideoProcessor] Using WebCodecs Worker for trimming.');
      
      // Create a File object from the blob for WebCodecs Worker
      const sourceFile = new File([blob], file.name, { type: blob.type });
      
      // Use processVideo with appropriate options
      // Note: The worker doesn't directly support trimming yet, so we fall back to FFmpeg for now
      // This will be enhanced in future iterations
      throw new VideoProcessingError(
        'WebCodecs Worker trimming not yet implemented',
        ErrorCodes.PROCESSING_FAILED
      );
    } catch (error) {
      // Check if this is a non-recoverable WebCodecs error
      if (error instanceof VideoProcessingError) {
        const shouldFallback = [
          ErrorCodes.WEBCODECS_NOT_SUPPORTED,
          ErrorCodes.CODEC_NOT_SUPPORTED,
          ErrorCodes.WEBCODECS_DECODE_FAILED,
          ErrorCodes.WEBCODECS_ENCODE_FAILED,
          ErrorCodes.PROCESSING_FAILED
        ].includes(error.code as ErrorCodes);
        
        if (shouldFallback) {
          console.warn('[VideoProcessor] WebCodecs error, falling back to FFmpeg:', error.code);
          logError(error, { operation: 'trimVideo', file: file.id, method: 'webcodecs', fallback: true });
          return await trimVideoFFmpeg(blob, trimStart, trimEnd, speedMultiplier, outputFileName, onProgress, onFrameProgress);
        }
      }
      
      // For other errors, log and fall back
      console.error('[VideoProcessor] ✗ WebCodecs trimming failed:', error);
      logError(error as Error, { operation: 'trimVideo', file: file.id, method: 'webcodecs' });
      return await trimVideoFFmpeg(blob, trimStart, trimEnd, speedMultiplier, outputFileName, onProgress, onFrameProgress);
    }
  } else {
    console.log('[VideoProcessor] Using FFmpeg for trimming (fallback).');
    return await trimVideoFFmpeg(blob, trimStart, trimEnd, speedMultiplier, outputFileName, onProgress, onFrameProgress);
  }
}

/**
 * Simple video concatenation using WebCodecs or FFmpeg with speed adjustment and audio removal.
 * Automatically falls back to FFmpeg if WebCodecs fails.
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
    const processor = await getVideoProcessor();

    if (processor.type === 'webcodecs' && processor.processVideo) {
      try {
        console.log('[VideoProcessor] Using WebCodecs Worker for concatenation.');
        
        // Note: The worker doesn't directly support concatenation yet, so we fall back to FFmpeg for now
        // This will be enhanced in future iterations when we add concat support to the worker
        throw new VideoProcessingError(
          'WebCodecs Worker concatenation not yet implemented',
          ErrorCodes.PROCESSING_FAILED
        );
      } catch (error) {
        // Check if this is a non-recoverable WebCodecs error
        if (error instanceof VideoProcessingError) {
          const shouldFallback = [
            ErrorCodes.WEBCODECS_NOT_SUPPORTED,
            ErrorCodes.CODEC_NOT_SUPPORTED,
            ErrorCodes.WEBCODECS_DECODE_FAILED,
            ErrorCodes.WEBCODECS_ENCODE_FAILED,
            ErrorCodes.PROCESSING_FAILED
          ].includes(error.code as ErrorCodes);
          
          if (shouldFallback) {
            console.warn('[VideoProcessor] WebCodecs error, falling back to FFmpeg:', error.code);
            logError(error, { operation: 'concatenateVideos', clipsCount: clips.length, method: 'webcodecs', fallback: true });
            // Fall through to FFmpeg fallback below
          } else {
            // Re-throw non-fallback errors
            throw error;
          }
        } else {
          console.error('[VideoProcessor] ✗ WebCodecs concatenation failed:', error);
          logError(error as Error, { operation: 'concatenateVideos', clipsCount: clips.length, method: 'webcodecs' });
          // Fall through to FFmpeg fallback below
        }
      }
    }
    
    // FFmpeg fallback path (either processor.type === 'ffmpeg' or WebCodecs failed)
    if (processor.type === 'ffmpeg' || true) { // Always execute if we reach here
      console.log('[VideoProcessor] Initializing FFmpeg (fallback)...');
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
        const blob = await getVideoFileSource(file);

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
            processedBlob = await trimVideoFFmpeg(
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
        resultBlob = await concatVideosFFmpeg(
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
          finalBlob = await transcodeVideoFFmpeg(resultBlob, {
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
    }
  } catch (error) {
    logError(error as Error, { clips: clips.length, files: files.length, operation: 'concatenateVideos' });
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