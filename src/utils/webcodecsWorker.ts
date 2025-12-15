/**
 * WebCodecs Worker
 * 
 * This Web Worker handles computationally intensive video processing operations
 * using the WebCodecs API. It runs in a separate thread to prevent blocking the
 * main UI thread during video processing.
 * 
 * Message Protocol:
 * - Commands: 'init', 'processVideo', 'trimVideo', 'concatVideos', 'getThumbnail'
 * - Responses: Success with result data or error with error details
 * - Progress updates: Sent during long-running operations
 */

import { WebCodecsProcessor } from './webcodecsProcessor';
import type { VideoProcessingOptions } from './webcodecsProcessor';
import {
  VideoProcessingError,
  ErrorCodes,
  logError,
  retryWithBackoff
} from './errorHandling';

// Message types for communication between main thread and worker
export interface WorkerMessage {
  id: string; // Unique message ID for request/response matching
  type: 'command' | 'response' | 'progress' | 'error';
  command?: string;
  data?: any;
  error?: string;
  progress?: number;
}

export interface ProcessVideoCommand {
  file: File;
  options: VideoProcessingOptions;
}

export interface TrimVideoCommand {
  file: File;
  startTime: number;
  endTime: number;
  speedMultiplier: number;
}

export interface ConcatVideosCommand {
  files: File[];
  speedMultiplier: number;
}

export interface GetThumbnailCommand {
  file: File;
  timestamp: number;
}

// Initialize the WebCodecs processor instance
let processor: WebCodecsProcessor | null = null;

/**
 * Initialize the WebCodecs processor
 */
async function initProcessor(): Promise<void> {
  if (!processor) {
    try {
      processor = WebCodecsProcessor.getInstance();
      await retryWithBackoff(
        async () => await processor!.init(),
        2, // Max 2 retries for initialization
        500 // 500ms base delay
      );
      console.log('[WebCodecsWorker] Processor initialized successfully');
    } catch (error) {
      logError(error as Error, { operation: 'initProcessor' });
      throw new VideoProcessingError(
        'Failed to initialize WebCodecs processor',
        ErrorCodes.WEBCODECS_INIT_FAILED,
        { originalError: (error as Error).message }
      );
    }
  }
}

/**
 * Process a video file with the given options
 */
async function processVideo(messageId: string, command: ProcessVideoCommand): Promise<void> {
  if (!processor) {
    throw new VideoProcessingError(
      'Processor not initialized',
      ErrorCodes.WEBCODECS_INIT_FAILED
    );
  }

  const { file, options } = command;

  // Wrap progress callback to send progress messages to main thread
  const wrappedOptions: VideoProcessingOptions = {
    ...options,
    onProgress: (progress: number) => {
      self.postMessage({
        id: messageId,
        type: 'progress',
        progress
      } as WorkerMessage);
      
      // Also call original callback if provided
      if (options.onProgress) {
        options.onProgress(progress);
      }
    },
    onFrameProgress: (frame: number, fps: number, fullLogLine?: string) => {
      // Send frame progress updates
      self.postMessage({
        id: messageId,
        type: 'progress',
        data: { frame, fps, fullLogLine }
      } as WorkerMessage);
      
      // Also call original callback if provided
      if (options.onFrameProgress) {
        options.onFrameProgress(frame, fps, fullLogLine);
      }
    }
  };

  const result = await processor.processVideo(file, wrappedOptions);
  
  // Send result back to main thread
  self.postMessage({
    id: messageId,
    type: 'response',
    data: result
  } as WorkerMessage);
}

/**
 * Trim a video segment
 */
async function trimVideo(messageId: string, command: TrimVideoCommand): Promise<void> {
  if (!processor) {
    throw new VideoProcessingError(
      'Processor not initialized',
      ErrorCodes.WEBCODECS_INIT_FAILED
    );
  }

  const { file, startTime, endTime, speedMultiplier } = command;
  
  // Create progress callback to send progress messages to main thread
  const progressCallback = (percentage: number, message?: string) => {
    self.postMessage({
      id: messageId,
      type: 'progress',
      progress: percentage,
      data: { message }
    } as WorkerMessage);
  };
  
  const fileReader = processor.createVideoFileReader(file);
  const videoChunks = processor.trimWithWebCodecs(fileReader, startTime, endTime, speedMultiplier, progressCallback);
  
  // Empty audio generator (audio is stripped)
  const audioChunks = (async function* () {
    // Empty generator
  })();
  
  const result = await processor.muxEncodedChunks(videoChunks, audioChunks, 'mp4');
  
  // Send result back to main thread
  self.postMessage({
    id: messageId,
    type: 'response',
    data: result
  } as WorkerMessage);
}

/**
 * Concatenate multiple video files
 */
async function concatVideos(messageId: string, command: ConcatVideosCommand): Promise<void> {
  if (!processor) {
    throw new VideoProcessingError(
      'Processor not initialized',
      ErrorCodes.WEBCODECS_INIT_FAILED
    );
  }

  const { files, speedMultiplier } = command;
  
  // Create progress callback to send progress messages to main thread
  const progressCallback = (percentage: number, message?: string) => {
    self.postMessage({
      id: messageId,
      type: 'progress',
      progress: percentage,
      data: { message }
    } as WorkerMessage);
  };
  
  // Create file readers for all input files
  const fileReaders = files.map(file => processor!.createVideoFileReader(file));
  
  const videoChunks = processor.concatWithWebCodecs(fileReaders, speedMultiplier, progressCallback);
  
  // Empty audio generator (audio is stripped)
  const audioChunks = (async function* () {
    // Empty generator
  })();
  
  const result = await processor.muxEncodedChunks(videoChunks, audioChunks, 'mp4');
  
  // Send result back to main thread
  self.postMessage({
    id: messageId,
    type: 'response',
    data: result
  } as WorkerMessage);
}

/**
 * Generate a thumbnail from a video file
 */
async function getThumbnail(messageId: string, command: GetThumbnailCommand): Promise<void> {
  if (!processor) {
    throw new VideoProcessingError(
      'Processor not initialized',
      ErrorCodes.WEBCODECS_INIT_FAILED
    );
  }

  const { file, timestamp } = command;
  
  try {
    const fileReader = processor.createVideoFileReader(file);
    const imageBitmap = await processor.generateThumbnailWithWebCodecs(fileReader, timestamp);
    
    if (!imageBitmap) {
      throw new VideoProcessingError(
        'Failed to generate thumbnail - no frame found',
        ErrorCodes.PROCESSING_FAILED,
        { timestamp }
      );
    }
  
    // Convert ImageBitmap to transferable format
    // Note: ImageBitmap itself is transferable, so we can send it directly
    self.postMessage({
      id: messageId,
      type: 'response',
      data: imageBitmap
    } as WorkerMessage, { transfer: [imageBitmap] });
  } catch (error) {
    if (error instanceof VideoProcessingError) {
      throw error;
    }
    logError(error as Error, { operation: 'getThumbnail', timestamp });
    throw new VideoProcessingError(
      'Failed to generate thumbnail',
      ErrorCodes.PROCESSING_FAILED,
      { timestamp, originalError: (error as Error).message }
    );
  }
}

/**
 * Handle incoming messages from the main thread
 */
self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  const message = event.data;
  
  try {
    console.log('[WebCodecsWorker] Received message:', message.command);
    
    switch (message.command) {
      case 'init':
        await initProcessor();
        self.postMessage({
          id: message.id,
          type: 'response',
          data: { success: true }
        } as WorkerMessage);
        break;
        
      case 'processVideo':
        await processVideo(message.id, message.data as ProcessVideoCommand);
        break;
        
      case 'trimVideo':
        await trimVideo(message.id, message.data as TrimVideoCommand);
        break;
        
      case 'concatVideos':
        await concatVideos(message.id, message.data as ConcatVideosCommand);
        break;
        
      case 'getThumbnail':
        await getThumbnail(message.id, message.data as GetThumbnailCommand);
        break;
        
      default:
        throw new Error(`Unknown command: ${message.command}`);
    }
  } catch (error) {
    logError(error as Error, {
      operation: 'workerMessage',
      command: message.command,
      messageId: message.id
    });
    
    // Determine if this is a recoverable error
    const isRecoverable = error instanceof VideoProcessingError &&
      ![
        ErrorCodes.WEBCODECS_NOT_SUPPORTED,
        ErrorCodes.CODEC_NOT_SUPPORTED,
        ErrorCodes.UNSUPPORTED_FORMAT,
        ErrorCodes.CORRUPTED_FILE
      ].includes(error.code as ErrorCodes);
    
    // Send detailed error response back to main thread
    self.postMessage({
      id: message.id,
      type: 'error',
      error: error instanceof Error ? error.message : String(error),
      data: {
        code: error instanceof VideoProcessingError ? error.code : ErrorCodes.PROCESSING_FAILED,
        recoverable: isRecoverable,
        details: error instanceof VideoProcessingError ? error.details : undefined
      }
    } as WorkerMessage);
  }
};

// Log that the worker is ready
console.log('[WebCodecsWorker] Worker initialized and ready');