import { vi, describe, it, expect, beforeEach } from 'vitest';
import {
  VideoProcessingError,
  StorageError,
  MemoryError,
  ErrorCodes,
  getUserFriendlyErrorMessage,
  getErrorRecoverySuggestions,
  checkMemoryUsage,
  retryWithBackoff,
  logError,
} from '../errorHandling';

// Mock performance.memory
const mockMemory = {
  usedJSHeapSize: 100 * 1024 * 1024, // 100MB
  totalJSHeapSize: 200 * 1024 * 1024, // 200MB
  jsHeapSizeLimit: 1000 * 1024 * 1024, // 1GB
};

Object.defineProperty(performance, 'memory', {
  value: mockMemory,
  configurable: true,
});

// Mock console methods
const mockConsole = {
  error: vi.fn(),
  warn: vi.fn(),
};

Object.defineProperty(console, 'error', { value: mockConsole.error });
Object.defineProperty(console, 'warn', { value: mockConsole.warn });

describe('errorHandling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset memory values
    mockMemory.usedJSHeapSize = 100 * 1024 * 1024;
    mockMemory.totalJSHeapSize = 200 * 1024 * 1024;
    mockMemory.jsHeapSizeLimit = 1000 * 1024 * 1024;
  });

  describe('Error Classes', () => {
    it('creates VideoProcessingError correctly', () => {
      const error = new VideoProcessingError('Processing failed', ErrorCodes.PROCESSING_FAILED, { fileId: 'test' });
      
      expect(error.name).toBe('VideoProcessingError');
      expect(error.message).toBe('Processing failed');
      expect(error.code).toBe(ErrorCodes.PROCESSING_FAILED);
      expect(error.details).toEqual({ fileId: 'test' });
      expect(error instanceof Error).toBe(true);
    });

    it('creates StorageError correctly', () => {
      const error = new StorageError('Storage full', ErrorCodes.STORAGE_QUOTA_EXCEEDED, { available: 0 });
      
      expect(error.name).toBe('StorageError');
      expect(error.message).toBe('Storage full');
      expect(error.code).toBe(ErrorCodes.STORAGE_QUOTA_EXCEEDED);
      expect(error.details).toEqual({ available: 0 });
      expect(error instanceof Error).toBe(true);
    });

    it('creates MemoryError correctly', () => {
      const error = new MemoryError('Out of memory', 100, 200);
      
      expect(error.name).toBe('MemoryError');
      expect(error.message).toBe('Out of memory');
      expect(error.availableMemory).toBe(100);
      expect(error.requiredMemory).toBe(200);
      expect(error instanceof Error).toBe(true);
    });
  });

  describe('getUserFriendlyErrorMessage', () => {
    it('returns friendly message for VideoProcessingError', () => {
      const error = new VideoProcessingError('Test', ErrorCodes.UNSUPPORTED_FORMAT);
      const message = getUserFriendlyErrorMessage(error);
      
      expect(message).toBe('This video format is not supported. Please use MP4 or WebM files.');
    });

    it('returns friendly message for corrupted file error', () => {
      const error = new VideoProcessingError('Test', ErrorCodes.CORRUPTED_FILE);
      const message = getUserFriendlyErrorMessage(error);
      
      expect(message).toBe('The video file appears to be corrupted. Please try a different file.');
    });

    it('returns friendly message for processing failed error', () => {
      const error = new VideoProcessingError('Test', ErrorCodes.PROCESSING_FAILED);
      const message = getUserFriendlyErrorMessage(error);
      
      expect(message).toBe('Video processing failed. Please try reducing the video quality or file size.');
    });

    it('returns friendly message for encoding failed error', () => {
      const error = new VideoProcessingError('Test', ErrorCodes.ENCODING_FAILED);
      const message = getUserFriendlyErrorMessage(error);
      
      expect(message).toBe('Failed to encode the video. Please try a different export format.');
    });

    it('returns generic message for unknown VideoProcessingError code', () => {
      const error = new VideoProcessingError('Test', 'UNKNOWN_CODE' as ErrorCodes);
      const message = getUserFriendlyErrorMessage(error);
      
      expect(message).toBe('An error occurred while processing the video.');
    });

    it('returns friendly message for StorageError', () => {
      const error = new StorageError('Test', ErrorCodes.STORAGE_QUOTA_EXCEEDED);
      const message = getUserFriendlyErrorMessage(error);
      
      expect(message).toBe('Not enough storage space. Please free up some space and try again.');
    });

    it('returns friendly message for storage access denied error', () => {
      const error = new StorageError('Test', ErrorCodes.STORAGE_ACCESS_DENIED);
      const message = getUserFriendlyErrorMessage(error);
      
      expect(message).toBe('Unable to access storage. Please check your browser permissions.');
    });

    it('returns friendly message for file not found error', () => {
      const error = new StorageError('Test', ErrorCodes.FILE_NOT_FOUND);
      const message = getUserFriendlyErrorMessage(error);
      
      expect(message).toBe('Video file not found. It may have been moved or deleted.');
    });

    it('returns generic message for unknown StorageError code', () => {
      const error = new StorageError('Test', 'UNKNOWN_CODE' as ErrorCodes);
      const message = getUserFriendlyErrorMessage(error);
      
      expect(message).toBe('A storage error occurred.');
    });

    it('returns friendly message for MemoryError', () => {
      const error = new MemoryError('Out of memory');
      const message = getUserFriendlyErrorMessage(error);
      
      expect(message).toBe('Not enough memory to process this video. Please try with smaller files or close other browser tabs.');
    });

    it('returns original message for generic Error', () => {
      const error = new Error('Generic error message');
      const message = getUserFriendlyErrorMessage(error);
      
      expect(message).toBe('Generic error message');
    });

    it('returns default message for Error without message', () => {
      const error = new Error('');
      const message = getUserFriendlyErrorMessage(error);
      
      expect(message).toBe('An unexpected error occurred.');
    });
  });

  describe('getErrorRecoverySuggestions', () => {
    it('returns suggestions for unsupported format error', () => {
      const error = new VideoProcessingError('Test', ErrorCodes.UNSUPPORTED_FORMAT);
      const suggestions = getErrorRecoverySuggestions(error);
      
      expect(suggestions).toEqual([
        'Convert your video to MP4 or WebM format',
        'Use a different video file',
      ]);
    });

    it('returns suggestions for corrupted file error', () => {
      const error = new VideoProcessingError('Test', ErrorCodes.CORRUPTED_FILE);
      const suggestions = getErrorRecoverySuggestions(error);
      
      expect(suggestions).toEqual([
        'Try re-downloading or re-recording the video',
        'Use a different video file',
        'Check if the file opens in other video players',
      ]);
    });

    it('returns suggestions for processing failed error', () => {
      const error = new VideoProcessingError('Test', ErrorCodes.PROCESSING_FAILED);
      const suggestions = getErrorRecoverySuggestions(error);
      
      expect(suggestions).toEqual([
        'Reduce the video resolution or quality',
        'Try with fewer clips',
        'Close other browser tabs to free up memory',
        'Restart your browser and try again',
      ]);
    });

    it('returns suggestions for encoding failed error', () => {
      const error = new VideoProcessingError('Test', ErrorCodes.ENCODING_FAILED);
      const suggestions = getErrorRecoverySuggestions(error);
      
      expect(suggestions).toEqual([
        'Try a different export format (MP4 vs WebM)',
        'Reduce the export quality setting',
        'Try exporting fewer clips at once',
      ]);
    });

    it('returns suggestions for storage quota exceeded error', () => {
      const error = new StorageError('Test', ErrorCodes.STORAGE_QUOTA_EXCEEDED);
      const suggestions = getErrorRecoverySuggestions(error);
      
      expect(suggestions).toEqual([
        'Clear browser cache and data',
        'Delete old projects from the app',
        'Use smaller video files',
      ]);
    });

    it('returns suggestions for storage access denied error', () => {
      const error = new StorageError('Test', ErrorCodes.STORAGE_ACCESS_DENIED);
      const suggestions = getErrorRecoverySuggestions(error);
      
      expect(suggestions).toEqual([
        'Check browser permissions for this site',
        'Try using a different browser',
        'Disable browser extensions that might block storage',
      ]);
    });

    it('returns suggestions for file not found error', () => {
      const error = new StorageError('Test', ErrorCodes.FILE_NOT_FOUND);
      const suggestions = getErrorRecoverySuggestions(error);
      
      expect(suggestions).toEqual([
        'Re-upload the video file',
        'Check if the file still exists on your device',
        'Start a new project',
      ]);
    });

    it('returns suggestions for MemoryError', () => {
      const error = new MemoryError('Out of memory');
      const suggestions = getErrorRecoverySuggestions(error);
      
      expect(suggestions).toEqual([
        'Close other browser tabs and applications',
        'Use smaller video files',
        'Try processing fewer clips at once',
        'Restart your browser',
        'Use a device with more RAM',
      ]);
    });

    it('returns generic suggestions for unknown error', () => {
      const error = new Error('Unknown error');
      const suggestions = getErrorRecoverySuggestions(error);
      
      expect(suggestions).toEqual([
        'Refresh the page and try again',
        'Check your internet connection',
        'Try using a different browser',
      ]);
    });
  });

  describe('checkMemoryUsage', () => {
    it('does not throw when memory usage is normal', () => {
      mockMemory.usedJSHeapSize = 500 * 1024 * 1024; // 50% usage
      
      expect(() => checkMemoryUsage()).not.toThrow();
    });

    it('throws MemoryError when approaching memory limit', () => {
      mockMemory.usedJSHeapSize = 850 * 1024 * 1024; // 85% usage
      
      expect(() => checkMemoryUsage()).toThrow(MemoryError);
      expect(() => checkMemoryUsage()).toThrow('Approaching memory limit');
    });

    it('handles missing performance.memory gracefully', () => {
      Object.defineProperty(performance, 'memory', { value: undefined });
      
      expect(() => checkMemoryUsage()).not.toThrow();
    });
  });

  describe('retryWithBackoff', () => {
    it('succeeds on first attempt', async () => {
      const mockFn = vi.fn().mockResolvedValue('success');
      
      const result = await retryWithBackoff(mockFn, 3, 100);
      
      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('retries on failure and eventually succeeds', async () => {
      const mockFn = vi.fn()
        .mockRejectedValueOnce(new Error('Attempt 1 failed'))
        .mockRejectedValueOnce(new Error('Attempt 2 failed'))
        .mockResolvedValue('success');
      
      const result = await retryWithBackoff(mockFn, 3, 10);
      
      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(3);
    });

    it('throws last error after max retries', async () => {
      const mockFn = vi.fn().mockRejectedValue(new Error('Always fails'));
      
      await expect(retryWithBackoff(mockFn, 2, 10)).rejects.toThrow('Always fails');
      expect(mockFn).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });

    it('does not retry for unsupported format errors', async () => {
      const error = new VideoProcessingError('Unsupported', ErrorCodes.UNSUPPORTED_FORMAT);
      const mockFn = vi.fn().mockRejectedValue(error);
      
      await expect(retryWithBackoff(mockFn, 3, 10)).rejects.toThrow(error);
      expect(mockFn).toHaveBeenCalledTimes(1); // No retries
    });

    it('does not retry for corrupted file errors', async () => {
      const error = new VideoProcessingError('Corrupted', ErrorCodes.CORRUPTED_FILE);
      const mockFn = vi.fn().mockRejectedValue(error);
      
      await expect(retryWithBackoff(mockFn, 3, 10)).rejects.toThrow(error);
      expect(mockFn).toHaveBeenCalledTimes(1); // No retries
    });

    it('uses exponential backoff delays', async () => {
      const mockFn = vi.fn()
        .mockRejectedValueOnce(new Error('Fail 1'))
        .mockRejectedValueOnce(new Error('Fail 2'))
        .mockResolvedValue('success');
      
      const startTime = Date.now();
      await retryWithBackoff(mockFn, 3, 50);
      const endTime = Date.now();
      
      // Should have delays of 50ms and 100ms (exponential backoff)
      // Total minimum delay should be around 150ms
      expect(endTime - startTime).toBeGreaterThan(140);
    });
  });

  describe('logError', () => {
    it('logs error with basic information', () => {
      const error = new Error('Test error');
      
      logError(error);
      
      expect(mockConsole.error).toHaveBeenCalledWith('Error occurred:', {
        name: 'Error',
        message: 'Test error',
        stack: error.stack,
        context: {},
        timestamp: expect.any(String),
      });
    });

    it('logs error with context', () => {
      const error = new VideoProcessingError('Processing failed', ErrorCodes.PROCESSING_FAILED);
      const context = { fileId: 'test-file', operation: 'encode' };
      
      logError(error, context);
      
      expect(mockConsole.error).toHaveBeenCalledWith('Error occurred:', {
        name: 'VideoProcessingError',
        message: 'Processing failed',
        stack: error.stack,
        context,
        timestamp: expect.any(String),
      });
    });

    it('includes timestamp in ISO format', () => {
      const error = new Error('Test error');
      
      logError(error);
      
      const logCall = mockConsole.error.mock.calls[0][1];
      expect(logCall.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });
  });

  describe('ErrorCodes enum', () => {
    it('contains all expected error codes', () => {
      expect(ErrorCodes.UNSUPPORTED_FORMAT).toBe('UNSUPPORTED_FORMAT');
      expect(ErrorCodes.CORRUPTED_FILE).toBe('CORRUPTED_FILE');
      expect(ErrorCodes.PROCESSING_FAILED).toBe('PROCESSING_FAILED');
      expect(ErrorCodes.ENCODING_FAILED).toBe('ENCODING_FAILED');
      expect(ErrorCodes.STORAGE_QUOTA_EXCEEDED).toBe('STORAGE_QUOTA_EXCEEDED');
      expect(ErrorCodes.STORAGE_ACCESS_DENIED).toBe('STORAGE_ACCESS_DENIED');
      expect(ErrorCodes.FILE_NOT_FOUND).toBe('FILE_NOT_FOUND');
      expect(ErrorCodes.INSUFFICIENT_MEMORY).toBe('INSUFFICIENT_MEMORY');
      expect(ErrorCodes.MEMORY_ALLOCATION_FAILED).toBe('MEMORY_ALLOCATION_FAILED');
      expect(ErrorCodes.NETWORK_ERROR).toBe('NETWORK_ERROR');
      expect(ErrorCodes.TIMEOUT).toBe('TIMEOUT');
    });
  });
});