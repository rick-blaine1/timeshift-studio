import { vi, describe, it, expect, beforeEach } from 'vitest';
import { extractVideoMetadata, getDetailedVideoMetadata } from '../videoMetadata';

// Mock DOM elements
const mockVideo = {
  preload: '',
  muted: false,
  playsInline: false,
  autoplay: false,
  src: '',
  duration: 120,
  videoWidth: 1920,
  videoHeight: 1080,
  onloadedmetadata: null as any,
  onerror: null as any,
  load: vi.fn(),
};

Object.defineProperty(document, 'createElement', {
  value: vi.fn((tagName: string) => {
    if (tagName === 'video') {
      return mockVideo;
    }
    return {};
  }),
});

// Mock URL methods
global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
global.URL.revokeObjectURL = vi.fn();

describe('videoMetadata', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mock video element
    mockVideo.preload = '';
    mockVideo.muted = false;
    mockVideo.playsInline = false;
    mockVideo.autoplay = false;
    mockVideo.src = '';
    mockVideo.duration = 120;
    mockVideo.videoWidth = 1920;
    mockVideo.videoHeight = 1080;
    mockVideo.onloadedmetadata = null;
    mockVideo.onerror = null;
  });

  describe('extractVideoMetadata', () => {
    it('extracts metadata successfully', async () => {
      const mockFile = new File(['video content'], 'test.mp4', { type: 'video/mp4' });
      
      // Mock successful metadata loading
      const metadataPromise = extractVideoMetadata(mockFile);
      
      // Simulate metadata loaded event
      setTimeout(() => {
        if (mockVideo.onloadedmetadata) {
          mockVideo.onloadedmetadata();
        }
      }, 0);
      
      const metadata = await metadataPromise;
      
      expect(metadata).toEqual({
        duration: 120,
        width: 1920,
        height: 1080,
      });
      
      expect(document.createElement).toHaveBeenCalledWith('video');
      expect(global.URL.createObjectURL).toHaveBeenCalledWith(mockFile);
      expect(global.URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
    });

    it('sets correct video element properties', async () => {
      const mockFile = new File(['video content'], 'test.mp4', { type: 'video/mp4' });
      
      const metadataPromise = extractVideoMetadata(mockFile);
      
      // Check that video element is configured correctly
      expect(mockVideo.preload).toBe('metadata');
      expect(mockVideo.muted).toBe(true);
      expect(mockVideo.playsInline).toBe(true);
      expect(mockVideo.autoplay).toBe(false);
      expect(mockVideo.src).toBe('blob:mock-url');
      expect(mockVideo.load).toHaveBeenCalled();
      
      // Complete the promise
      setTimeout(() => {
        if (mockVideo.onloadedmetadata) {
          mockVideo.onloadedmetadata();
        }
      }, 0);
      
      await metadataPromise;
    });

    it('handles video loading errors', async () => {
      const mockFile = new File(['video content'], 'test.mp4', { type: 'video/mp4' });
      
      const metadataPromise = extractVideoMetadata(mockFile);
      
      // Simulate error event
      setTimeout(() => {
        if (mockVideo.onerror) {
          const mockError = {
            target: {
              error: {
                message: 'Failed to load video',
              },
            },
          };
          mockVideo.onerror(mockError as any);
        }
      }, 0);
      
      await expect(metadataPromise).rejects.toThrow('Failed to load video metadata: Failed to load video');
      expect(global.URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
    });

    it('handles error without specific message', async () => {
      const mockFile = new File(['video content'], 'test.mp4', { type: 'video/mp4' });
      
      const metadataPromise = extractVideoMetadata(mockFile);
      
      // Simulate error event without specific error message
      setTimeout(() => {
        if (mockVideo.onerror) {
          const mockError = {
            target: {},
          };
          mockVideo.onerror(mockError as any);
        }
      }, 0);
      
      await expect(metadataPromise).rejects.toThrow('Failed to load video metadata: Unknown error');
      expect(global.URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
    });

    it('extracts different video dimensions', async () => {
      const mockFile = new File(['video content'], 'test.mp4', { type: 'video/mp4' });
      
      // Set different video dimensions
      mockVideo.videoWidth = 1280;
      mockVideo.videoHeight = 720;
      mockVideo.duration = 90;
      
      const metadataPromise = extractVideoMetadata(mockFile);
      
      setTimeout(() => {
        if (mockVideo.onloadedmetadata) {
          mockVideo.onloadedmetadata();
        }
      }, 0);
      
      const metadata = await metadataPromise;
      
      expect(metadata).toEqual({
        duration: 90,
        width: 1280,
        height: 720,
      });
    });

    it('handles zero duration videos', async () => {
      const mockFile = new File(['video content'], 'test.mp4', { type: 'video/mp4' });
      
      mockVideo.duration = 0;
      
      const metadataPromise = extractVideoMetadata(mockFile);
      
      setTimeout(() => {
        if (mockVideo.onloadedmetadata) {
          mockVideo.onloadedmetadata();
        }
      }, 0);
      
      const metadata = await metadataPromise;
      
      expect(metadata.duration).toBe(0);
    });

    it('handles very long duration videos', async () => {
      const mockFile = new File(['video content'], 'test.mp4', { type: 'video/mp4' });
      
      mockVideo.duration = 3600; // 1 hour
      
      const metadataPromise = extractVideoMetadata(mockFile);
      
      setTimeout(() => {
        if (mockVideo.onloadedmetadata) {
          mockVideo.onloadedmetadata();
        }
      }, 0);
      
      const metadata = await metadataPromise;
      
      expect(metadata.duration).toBe(3600);
    });

    it('cleans up resources on success', async () => {
      const mockFile = new File(['video content'], 'test.mp4', { type: 'video/mp4' });
      
      const metadataPromise = extractVideoMetadata(mockFile);
      
      setTimeout(() => {
        if (mockVideo.onloadedmetadata) {
          mockVideo.onloadedmetadata();
        }
      }, 0);
      
      await metadataPromise;
      
      expect(global.URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
    });
  });

  describe('getDetailedVideoMetadata', () => {
    it('returns basic metadata for now', async () => {
      const mockFile = new File(['video content'], 'test.mp4', { type: 'video/mp4' });
      
      const metadataPromise = getDetailedVideoMetadata(mockFile);
      
      // Since it currently just calls extractVideoMetadata, simulate that
      setTimeout(() => {
        if (mockVideo.onloadedmetadata) {
          mockVideo.onloadedmetadata();
        }
      }, 0);
      
      const metadata = await metadataPromise;
      
      expect(metadata).toEqual({
        duration: 120,
        width: 1920,
        height: 1080,
      });
    });

    it('is a placeholder for future FFmpeg integration', async () => {
      // This test documents the current behavior and intention
      const mockFile = new File(['video content'], 'test.mp4', { type: 'video/mp4' });
      
      // Currently just calls extractVideoMetadata
      const basicMetadata = extractVideoMetadata(mockFile);
      const detailedMetadata = getDetailedVideoMetadata(mockFile);
      
      // Both should behave the same for now
      setTimeout(() => {
        if (mockVideo.onloadedmetadata) {
          mockVideo.onloadedmetadata();
        }
      }, 0);
      
      const [basic, detailed] = await Promise.all([basicMetadata, detailedMetadata]);
      
      expect(basic).toEqual(detailed);
    });
  });

  describe('error handling edge cases', () => {
    it('handles null error target', async () => {
      const mockFile = new File(['video content'], 'test.mp4', { type: 'video/mp4' });
      
      const metadataPromise = extractVideoMetadata(mockFile);
      
      setTimeout(() => {
        if (mockVideo.onerror) {
          const mockError = {
            target: null,
          };
          mockVideo.onerror(mockError as any);
        }
      }, 0);
      
      await expect(metadataPromise).rejects.toThrow('Failed to load video metadata: Unknown error');
    });

    it('handles undefined error', async () => {
      const mockFile = new File(['video content'], 'test.mp4', { type: 'video/mp4' });
      
      const metadataPromise = extractVideoMetadata(mockFile);
      
      setTimeout(() => {
        if (mockVideo.onerror) {
          const mockError = {
            target: {
              error: undefined,
            },
          };
          mockVideo.onerror(mockError as any);
        }
      }, 0);
      
      await expect(metadataPromise).rejects.toThrow('Failed to load video metadata: Unknown error');
    });
  });
});