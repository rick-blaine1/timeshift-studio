/**
 * WebCodecs API Compatibility and Fallback Mechanism
 *
 * This module provides utilities for detecting WebCodecs API support and managing
 * the fallback to FFmpeg.wasm when WebCodecs is unavailable or fails.
 *
 * FALLBACK STRATEGY:
 * 1. Initial Detection: Check for all required WebCodecs APIs at startup
 * 2. Graceful Degradation: If WebCodecs is unavailable, use FFmpeg.wasm
 * 3. Runtime Fallback: If WebCodecs operations fail mid-execution, catch errors
 *    and retry with FFmpeg.wasm
 * 4. Explicit Override: Allow forcing FFmpeg usage via forceFFmpeg parameter
 *
 * SUPPORTED OPERATIONS:
 * - Video trimming (trim segments with speed adjustment)
 * - Video concatenation (join multiple clips)
 * - Video transcoding (format/quality conversion)
 * - Thumbnail generation (extract frame at timestamp)
 *
 * ERROR HANDLING:
 * - All WebCodecs operations are wrapped in try-catch blocks
 * - Errors are logged with context for debugging
 * - Automatic fallback to FFmpeg on any WebCodecs failure
 * - User experience remains seamless during fallback
 */

import { VideoProcessingError, ErrorCodes, logError } from './errorHandling';
import { isFeatureEnabled, FeatureFlag } from './featureFlags';

/**
 * Checks if the WebCodecs API is fully supported in the current browser environment.
 * Verifies all required WebCodecs components are available.
 * @returns {boolean} True if WebCodecs API is fully supported, false otherwise.
 */
export function isWebCodecsSupported(): boolean {
  try {
    // Check for all required WebCodecs APIs
    const hasVideoDecoder = typeof VideoDecoder !== 'undefined';
    const hasVideoEncoder = typeof VideoEncoder !== 'undefined';
    const hasAudioDecoder = typeof AudioDecoder !== 'undefined';
    const hasAudioEncoder = typeof AudioEncoder !== 'undefined';
    const hasEncodedVideoChunk = typeof EncodedVideoChunk !== 'undefined';
    const hasEncodedAudioChunk = typeof EncodedAudioChunk !== 'undefined';
    const hasVideoFrame = typeof VideoFrame !== 'undefined';
    const hasAudioData = typeof AudioData !== 'undefined';
    
    const isSupported = hasVideoDecoder && hasVideoEncoder &&
                       hasAudioDecoder && hasAudioEncoder &&
                       hasEncodedVideoChunk && hasEncodedAudioChunk &&
                       hasVideoFrame && hasAudioData;
    
    if (!isSupported) {
      console.warn('[WebCodecs] Partial or no WebCodecs support detected:', {
        VideoDecoder: hasVideoDecoder,
        VideoEncoder: hasVideoEncoder,
        AudioDecoder: hasAudioDecoder,
        AudioEncoder: hasAudioEncoder,
        EncodedVideoChunk: hasEncodedVideoChunk,
        EncodedAudioChunk: hasEncodedAudioChunk,
        VideoFrame: hasVideoFrame,
        AudioData: hasAudioData
      });
    }
    
    return isSupported;
  } catch (error) {
    console.error('[WebCodecs] Error checking WebCodecs support:', error);
    return false;
  }
}

import type { WebCodecsProcessor as IWebCodecsProcessor, VideoFileReader, VideoProcessingOptions } from './webcodecsProcessor';
import type { WorkerMessage } from './webcodecsWorker';

/**
 * Interface for video processor. This allows for a common interface between WebCodecs and FFmpeg fallback.
 */
export interface VideoProcessor {
  type: 'webcodecs' | 'ffmpeg';
  init?: () => Promise<void>;
  processVideo?: (file: File, options: VideoProcessingOptions) => Promise<Blob>;
  createVideoFileReader?: (file: File) => VideoFileReader;
  trimWithWebCodecs?: (fileReader: VideoFileReader, startTime: number, endTime: number, speedMultiplier: number) => AsyncGenerator<EncodedVideoChunk>;
  concatWithWebCodecs?: (fileReaders: VideoFileReader[], speedMultiplier: number) => AsyncGenerator<EncodedVideoChunk>;
  transcodeVideo?: (fileReader: VideoFileReader, options: any) => Promise<Blob>; // General options
  generateThumbnailWithWebCodecs?: (fileReader: VideoFileReader, timestamp: number) => Promise<ImageBitmap | null>;
  muxEncodedChunks?: (videoChunks: AsyncGenerator<EncodedVideoChunk>, audioChunks: AsyncGenerator<EncodedAudioChunk>) => Promise<Blob>;
}

/**
 * WebCodecs Worker Wrapper
 * Provides a proxy interface to the WebCodecs processor running in a Web Worker
 */
class WebCodecsWorkerWrapper implements VideoProcessor {
  public readonly type: 'webcodecs' = 'webcodecs';
  private worker: Worker | null = null;
  private messageId = 0;
  private pendingMessages = new Map<string, {
    resolve: (value: any) => void;
    reject: (error: Error) => void;
    onProgress?: (progress: number) => void;
  }>();

  constructor() {
    this.initWorker();
  }

  /**
   * Initialize the Web Worker
   */
  private initWorker(): void {
    try {
      // Create worker from the webcodecsWorker.ts file
      this.worker = new Worker(
        new URL('./webcodecsWorker.ts', import.meta.url),
        { type: 'module' }
      );

      // Set up message handler
      this.worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
        this.handleWorkerMessage(event.data);
      };

      // Set up error handler
      this.worker.onerror = (error) => {
        console.error('[WebCodecsWorkerWrapper] Worker error:', error);
      };

      console.log('[WebCodecsWorkerWrapper] Worker created successfully');
    } catch (error) {
      console.error('[WebCodecsWorkerWrapper] Failed to create worker:', error);
      throw error;
    }
  }

  /**
   * Handle messages from the worker
   */
  private handleWorkerMessage(message: WorkerMessage): void {
    const pending = this.pendingMessages.get(message.id);
    
    if (!pending) {
      console.warn('[WebCodecsWorkerWrapper] Received message for unknown ID:', message.id);
      return;
    }

    switch (message.type) {
      case 'response':
        // Resolve the promise with the result
        pending.resolve(message.data);
        this.pendingMessages.delete(message.id);
        break;

      case 'progress':
        // Call progress callback if provided
        if (pending.onProgress && typeof message.progress === 'number') {
          pending.onProgress(message.progress);
        }
        // Note: Don't delete the pending message on progress updates
        // The message stays pending until we get a 'response' or 'error'
        break;

      case 'error':
        // Create a proper error object with code and details
        const errorData = message.data || {};
        const error = new VideoProcessingError(
          message.error || 'Unknown worker error',
          errorData.code || ErrorCodes.PROCESSING_FAILED,
          errorData.details
        );
        
        logError(error, {
          messageId: message.id,
          recoverable: errorData.recoverable
        });
        
        pending.reject(error);
        this.pendingMessages.delete(message.id);
        break;
    }
  }

  /**
   * Send a command to the worker and wait for response
   */
  private sendCommand<T>(
    command: string,
    data: any,
    onProgress?: (progress: number) => void
  ): Promise<T> {
    if (!this.worker) {
      return Promise.reject(new Error('Worker not initialized'));
    }

    const id = `msg_${this.messageId++}`;

    return new Promise<T>((resolve, reject) => {
      // Store the promise handlers
      this.pendingMessages.set(id, { resolve, reject, onProgress });

      // Send the message to the worker
      const message: WorkerMessage = {
        id,
        type: 'command',
        command,
        data
      };

      this.worker!.postMessage(message);
    });
  }

  /**
   * Initialize the WebCodecs processor in the worker
   */
  public async init(): Promise<void> {
    try {
      await this.sendCommand('init', {});
      console.log('[WebCodecsWorkerWrapper] Worker processor initialized');
    } catch (error) {
      logError(error as Error, { operation: 'workerInit' });
      throw new VideoProcessingError(
        'Failed to initialize WebCodecs worker',
        ErrorCodes.WEBCODECS_INIT_FAILED,
        { originalError: (error as Error).message }
      );
    }
  }

  /**
   * Process a video file with the given options
   */
  public async processVideo(file: File, options: VideoProcessingOptions): Promise<Blob> {
    return this.sendCommand<Blob>(
      'processVideo',
      { file, options },
      options.onProgress
    );
  }

  /**
   * Terminate the worker
   */
  public terminate(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
      console.log('[WebCodecsWorkerWrapper] Worker terminated');
    }
  }
}

/**
 * Returns a video processing instance based on WebCodecs support and feature flags.
 * Falls back to FFmpeg.wasm if WebCodecs is not supported, disabled via feature flag, or fails to initialize.
 *
 * FEATURE FLAG INTEGRATION:
 * - Checks the 'webcodecs_enabled' feature flag before attempting WebCodecs initialization
 * - If the flag is disabled, immediately returns FFmpeg fallback
 * - Feature flag can be controlled via:
 *   1. URL parameter: ?feature_webcodecs=true/false
 *   2. localStorage: feature_webcodecs
 *   3. Environment variable: VITE_FEATURE_WEBCODECS_ENABLED
 *   4. Default: true (WebCodecs enabled)
 *
 * @param {boolean} forceFFmpeg - Force FFmpeg fallback even if WebCodecs is supported
 * @returns {Promise<VideoProcessor>} A promise that resolves to an instance of WebCodecsWorkerWrapper or an FFmpeg fallback.
 */
export async function getVideoProcessor(forceFFmpeg: boolean = false): Promise<VideoProcessor> {
  // Check if WebCodecs feature flag is disabled
  const isWebCodecsFeatureEnabled = isFeatureEnabled(FeatureFlag.WEBCODECS_ENABLED);
  console.log(`[VideoProcessor] WebCodecs feature flag status: ${isWebCodecsFeatureEnabled}`);
  if (!isWebCodecsFeatureEnabled) {
    console.log('[VideoProcessor] WebCodecs feature flag is DISABLED, using FFmpeg fallback');
    return createFFmpegFallback();
  }

  if (forceFFmpeg) {
    console.log('[VideoProcessor] FFmpeg explicitly requested, skipping WebCodecs');
    return createFFmpegFallback();
  }

  if (isWebCodecsSupported()) {
    try {
      console.log('[VideoProcessor] WebCodecs API detected, initializing WebCodecs Worker...');
      
      // Create the worker wrapper
      const workerWrapper = new WebCodecsWorkerWrapper();
      
      // Initialize the processor in the worker with retry logic
      await workerWrapper.init();
      
      console.log('[VideoProcessor] ✓ WebCodecs Worker initialized successfully');
      return workerWrapper;
    } catch (error) {
      logError(error as Error, { operation: 'getVideoProcessor', method: 'webcodecs' });
      
      // Check if this is a non-recoverable error
      if (error instanceof VideoProcessingError) {
        const nonRecoverableErrors = [
          ErrorCodes.WEBCODECS_NOT_SUPPORTED,
          ErrorCodes.CODEC_NOT_SUPPORTED
        ];
        
        if (nonRecoverableErrors.includes(error.code as ErrorCodes)) {
          console.warn('[VideoProcessor] WebCodecs not supported, using FFmpeg fallback');
        } else {
          console.warn('[VideoProcessor] WebCodecs initialization failed, falling back to FFmpeg');
        }
      } else {
        console.error('[VideoProcessor] ✗ Unexpected error initializing WebCodecs:', error);
        console.warn('[VideoProcessor] Falling back to FFmpeg due to initialization error');
      }
      
      return createFFmpegFallback();
    }
  } else {
    console.warn('[VideoProcessor] WebCodecs API not supported in this browser');
    console.log('[VideoProcessor] Using FFmpeg.wasm fallback');
    return createFFmpegFallback();
  }
}

/**
 * Creates an FFmpeg fallback processor object.
 * This object has the same interface as WebCodecsProcessor but indicates FFmpeg usage.
 * @returns {VideoProcessor} An FFmpeg fallback processor
 */
function createFFmpegFallback(): VideoProcessor {
  return {
    type: 'ffmpeg',
    // FFmpeg operations are handled directly in videoProcessor.ts
    // This object serves as a marker to indicate FFmpeg should be used
  };
}

// Additional WebCodecs related utilities can be added here in the future.