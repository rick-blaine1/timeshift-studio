/**
 * Error handling utilities for the video processing pipeline
 */

export class VideoProcessingError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'VideoProcessingError';
  }
}

export class StorageError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'StorageError';
  }
}

export class MemoryError extends Error {
  constructor(
    message: string,
    public availableMemory?: number,
    public requiredMemory?: number
  ) {
    super(message);
    this.name = 'MemoryError';
  }
}

export enum ErrorCodes {
  // Video Processing Errors
  UNSUPPORTED_FORMAT = 'UNSUPPORTED_FORMAT',
  CORRUPTED_FILE = 'CORRUPTED_FILE',
  PROCESSING_FAILED = 'PROCESSING_FAILED',
  ENCODING_FAILED = 'ENCODING_FAILED',
  FFMPEG_INIT_FAILED = 'FFMPEG_INIT_FAILED',
  TRIM_FAILED = 'TRIM_FAILED',
  CONCAT_FAILED = 'CONCAT_FAILED',
  TRANSCODE_FAILED = 'TRANSCODE_FAILED',
  
  // Storage Errors
  STORAGE_QUOTA_EXCEEDED = 'STORAGE_QUOTA_EXCEEDED',
  STORAGE_ACCESS_DENIED = 'STORAGE_ACCESS_DENIED',
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  
  // Memory Errors
  INSUFFICIENT_MEMORY = 'INSUFFICIENT_MEMORY',
  MEMORY_ALLOCATION_FAILED = 'MEMORY_ALLOCATION_FAILED',
  
  // Network Errors
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT = 'TIMEOUT',
}

/**
 * Get user-friendly error message for display
 */
export function getUserFriendlyErrorMessage(error: Error): string {
  if (error instanceof VideoProcessingError) {
    switch (error.code) {
      case ErrorCodes.UNSUPPORTED_FORMAT:
        return 'This video format is not supported. Please use MP4 or WebM files.';
      case ErrorCodes.CORRUPTED_FILE:
        return 'The video file appears to be corrupted. Please try a different file.';
      case ErrorCodes.PROCESSING_FAILED:
        return 'Video processing failed. Please try reducing the video quality or file size.';
      case ErrorCodes.ENCODING_FAILED:
        return 'Failed to encode the video. Please try a different export format.';
      default:
        return 'An error occurred while processing the video.';
    }
  }
  
  if (error instanceof StorageError) {
    switch (error.code) {
      case ErrorCodes.STORAGE_QUOTA_EXCEEDED:
        return 'Not enough storage space. Please free up some space and try again.';
      case ErrorCodes.STORAGE_ACCESS_DENIED:
        return 'Unable to access storage. Please check your browser permissions.';
      case ErrorCodes.FILE_NOT_FOUND:
        return 'Video file not found. It may have been moved or deleted.';
      default:
        return 'A storage error occurred.';
    }
  }
  
  if (error instanceof MemoryError) {
    return 'Not enough memory to process this video. Please try with smaller files or close other browser tabs.';
  }
  
  // Generic error message
  return error.message || 'An unexpected error occurred.';
}

/**
 * Get error recovery suggestions
 */
export function getErrorRecoverySuggestions(error: Error): string[] {
  if (error instanceof VideoProcessingError) {
    switch (error.code) {
      case ErrorCodes.UNSUPPORTED_FORMAT:
        return [
          'Convert your video to MP4 or WebM format',
          'Use a different video file',
        ];
      case ErrorCodes.CORRUPTED_FILE:
        return [
          'Try re-downloading or re-recording the video',
          'Use a different video file',
          'Check if the file opens in other video players',
        ];
      case ErrorCodes.PROCESSING_FAILED:
        return [
          'Reduce the video resolution or quality',
          'Try with fewer clips',
          'Close other browser tabs to free up memory',
          'Restart your browser and try again',
        ];
      case ErrorCodes.ENCODING_FAILED:
        return [
          'Try a different export format (MP4 vs WebM)',
          'Reduce the export quality setting',
          'Try exporting fewer clips at once',
        ];
    }
  }
  
  if (error instanceof StorageError) {
    switch (error.code) {
      case ErrorCodes.STORAGE_QUOTA_EXCEEDED:
        return [
          'Clear browser cache and data',
          'Delete old projects from the app',
          'Use smaller video files',
        ];
      case ErrorCodes.STORAGE_ACCESS_DENIED:
        return [
          'Check browser permissions for this site',
          'Try using a different browser',
          'Disable browser extensions that might block storage',
        ];
      case ErrorCodes.FILE_NOT_FOUND:
        return [
          'Re-upload the video file',
          'Check if the file still exists on your device',
          'Start a new project',
        ];
    }
  }
  
  if (error instanceof MemoryError) {
    return [
      'Close other browser tabs and applications',
      'Use smaller video files',
      'Try processing fewer clips at once',
      'Restart your browser',
      'Use a device with more RAM',
    ];
  }
  
  return [
    'Refresh the page and try again',
    'Check your internet connection',
    'Try using a different browser',
  ];
}

/**
 * Monitor memory usage and throw error if approaching limits
 */
export function checkMemoryUsage(): void {
  if ('memory' in performance) {
    const memInfo = (performance as any).memory;
    const usedMemory = memInfo.usedJSHeapSize;
    const totalMemory = memInfo.totalJSHeapSize;
    const memoryLimit = memInfo.jsHeapSizeLimit;
    
    // Warn if using more than 80% of available memory
    if (usedMemory / memoryLimit > 0.8) {
      throw new MemoryError(
        'Approaching memory limit',
        memoryLimit - usedMemory,
        usedMemory
      );
    }
  }
}

/**
 * Retry function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt === maxRetries) {
        throw lastError;
      }
      
      // Don't retry certain types of errors
      if (error instanceof VideoProcessingError && 
          [ErrorCodes.UNSUPPORTED_FORMAT, ErrorCodes.CORRUPTED_FILE].includes(error.code as ErrorCodes)) {
        throw error;
      }
      
      // Exponential backoff
      const delay = baseDelay * Math.pow(2, attempt);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
}

/**
 * Log error with context for debugging
 */
export function logError(error: Error, context: Record<string, any> = {}): void {
  console.error('Error occurred:', {
    name: error.name,
    message: error.message,
    stack: error.stack,
    context,
    timestamp: new Date().toISOString(),
  });
  
  // In production, you might want to send this to an error tracking service
  // like Sentry, LogRocket, etc.
}