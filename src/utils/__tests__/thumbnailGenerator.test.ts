import { vi, describe, it, expect, beforeEach } from 'vitest';
import { generateThumbnail, generateMultipleThumbnails } from '../thumbnailGenerator';

// Mock DOM elements
const mockVideo = {
  preload: '',
  muted: false,
  playsInline: false,
  autoplay: false,
  src: '',
  currentTime: 0,
  duration: 120,
  videoWidth: 1920,
  videoHeight: 1080,
  onloadedmetadata: null as any,
  onseeked: null as any,
  onerror: null as any,
  load: vi.fn(),
};

const mockCanvas = {
  width: 0,
  height: 0,
  getContext: vi.fn(),
  toDataURL: vi.fn(),
};

const mockContext = {
  drawImage: vi.fn(),
};

Object.defineProperty(document, 'createElement', {
  value: vi.fn((tagName: string) => {
    if (tagName === 'video') {
      return { ...mockVideo };
    }
    if (tagName === 'canvas') {
      return { ...mockCanvas };
    }
    return {};
  }),
});

// Mock URL methods
global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
global.URL.revokeObjectURL = vi.fn();

describe('thumbnailGenerator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCanvas.getContext.mockReturnValue(mockContext);
    mockCanvas.toDataURL.mockReturnValue('data:image/jpeg;base64,mock-thumbnail');
    
    // Reset mock objects
    Object.assign(mockVideo, {
      preload: '',
      muted: false,
      playsInline: false,
      autoplay: false,
      src: '',
      currentTime: 0,
      duration: 120,
      videoWidth: 1920,
      videoHeight: 1080,
      onloadedmetadata: null,
      onseeked: null,
      onerror: null,
    });
    
    Object.assign(mockCanvas, {
      width: 0,
      height: 0,
    });
  });

  describe('generateThumbnail', () => {
    it('generates thumbnail successfully', async () => {
      const mockFile = new File(['video content'], 'test.mp4', { type: 'video/mp4' });
      
      const thumbnailPromise = generateThumbnail(mockFile, 10);
      
      // Simulate video metadata loaded
      setTimeout(() => {
        if (mockVideo.onloadedmetadata) {
          mockVideo.onloadedmetadata();
        }
      }, 0);
      
      // Simulate seek completed
      setTimeout(() => {
        if (mockVideo.onseeked) {
          mockVideo.onseeked();
        }
      }, 10);
      
      const thumbnail = await thumbnailPromise;
      
      expect(thumbnail).toBe('data:image/jpeg;base64,mock-thumbnail');
      expect(mockCanvas.width).toBe(1920);
      expect(mockCanvas.height).toBe(1080);
      expect(mockVideo.currentTime).toBe(10);
      expect(mockContext.drawImage).toHaveBeenCalledWith(mockVideo, 0, 0, 1920, 1080);
      expect(mockCanvas.toDataURL).toHaveBeenCalledWith('image/jpeg', 0.8);
    });

    it('uses default timestamp when not provided', async () => {
      const mockFile = new File(['video content'], 'test.mp4', { type: 'video/mp4' });
      
      const thumbnailPromise = generateThumbnail(mockFile);
      
      setTimeout(() => {
        if (mockVideo.onloadedmetadata) {
          mockVideo.onloadedmetadata();
        }
      }, 0);
      
      setTimeout(() => {
        if (mockVideo.onseeked) {
          mockVideo.onseeked();
        }
      }, 10);
      
      await thumbnailPromise;
      
      expect(mockVideo.currentTime).toBe(5); // Default timestamp
    });

    it('clamps timestamp to video duration', async () => {
      const mockFile = new File(['video content'], 'test.mp4', { type: 'video/mp4' });
      mockVideo.duration = 60;
      
      const thumbnailPromise = generateThumbnail(mockFile, 100); // Timestamp beyond duration
      
      setTimeout(() => {
        if (mockVideo.onloadedmetadata) {
          mockVideo.onloadedmetadata();
        }
      }, 0);
      
      setTimeout(() => {
        if (mockVideo.onseeked) {
          mockVideo.onseeked();
        }
      }, 10);
      
      await thumbnailPromise;
      
      expect(mockVideo.currentTime).toBe(60); // Clamped to duration
    });

    it('sets correct video element properties', async () => {
      const mockFile = new File(['video content'], 'test.mp4', { type: 'video/mp4' });
      
      const thumbnailPromise = generateThumbnail(mockFile);
      
      expect(mockVideo.preload).toBe('metadata');
      expect(mockVideo.muted).toBe(true);
      expect(mockVideo.playsInline).toBe(true);
      expect(mockVideo.autoplay).toBe(false);
      expect(mockVideo.src).toBe('blob:mock-url');
      expect(mockVideo.load).toHaveBeenCalled();
      
      setTimeout(() => {
        if (mockVideo.onloadedmetadata) {
          mockVideo.onloadedmetadata();
        }
      }, 0);
      
      setTimeout(() => {
        if (mockVideo.onseeked) {
          mockVideo.onseeked();
        }
      }, 10);
      
      await thumbnailPromise;
    });

    it('handles canvas context not available', async () => {
      mockCanvas.getContext.mockReturnValue(null);
      
      const mockFile = new File(['video content'], 'test.mp4', { type: 'video/mp4' });
      
      await expect(generateThumbnail(mockFile)).rejects.toThrow('Could not get canvas 2D context');
    });

    it('handles video loading error', async () => {
      const mockFile = new File(['video content'], 'test.mp4', { type: 'video/mp4' });
      
      const thumbnailPromise = generateThumbnail(mockFile);
      
      setTimeout(() => {
        if (mockVideo.onerror) {
          const mockError = {
            target: {
              error: {
                message: 'Video load failed',
              },
            },
          };
          mockVideo.onerror(mockError as any);
        }
      }, 0);
      
      await expect(thumbnailPromise).rejects.toThrow('Failed to load video for thumbnail: Video load failed');
      expect(global.URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
    });

    it('handles canvas drawing error', async () => {
      mockContext.drawImage.mockImplementation(() => {
        throw new Error('Canvas drawing failed');
      });
      
      const mockFile = new File(['video content'], 'test.mp4', { type: 'video/mp4' });
      
      const thumbnailPromise = generateThumbnail(mockFile);
      
      setTimeout(() => {
        if (mockVideo.onloadedmetadata) {
          mockVideo.onloadedmetadata();
        }
      }, 0);
      
      setTimeout(() => {
        if (mockVideo.onseeked) {
          mockVideo.onseeked();
        }
      }, 10);
      
      await expect(thumbnailPromise).rejects.toThrow('Failed to generate thumbnail: Canvas drawing failed');
      expect(global.URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
    });

    it('cleans up resources on success', async () => {
      const mockFile = new File(['video content'], 'test.mp4', { type: 'video/mp4' });
      
      const thumbnailPromise = generateThumbnail(mockFile);
      
      setTimeout(() => {
        if (mockVideo.onloadedmetadata) {
          mockVideo.onloadedmetadata();
        }
      }, 0);
      
      setTimeout(() => {
        if (mockVideo.onseeked) {
          mockVideo.onseeked();
        }
      }, 10);
      
      await thumbnailPromise;
      
      expect(global.URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
    });
  });

  describe('generateMultipleThumbnails', () => {
    it('generates multiple thumbnails successfully', async () => {
      const mockFile = new File(['video content'], 'test.mp4', { type: 'video/mp4' });
      mockVideo.duration = 120;
      
      let seekCount = 0;
      const thumbnailPromise = generateMultipleThumbnails(mockFile, 3);
      
      setTimeout(() => {
        if (mockVideo.onloadedmetadata) {
          mockVideo.onloadedmetadata();
        }
      }, 0);
      
      // Simulate multiple seek events
      const simulateSeek = () => {
        setTimeout(() => {
          if (mockVideo.onseeked) {
            seekCount++;
            mockCanvas.toDataURL.mockReturnValue(`data:image/jpeg;base64,thumbnail-${seekCount}`);
            mockVideo.onseeked();
          }
        }, seekCount * 10);
      };
      
      // Simulate 3 seek events
      simulateSeek();
      simulateSeek();
      simulateSeek();
      
      const thumbnails = await thumbnailPromise;
      
      expect(thumbnails).toHaveLength(3);
      expect(thumbnails[0]).toBe('data:image/jpeg;base64,thumbnail-1');
      expect(thumbnails[1]).toBe('data:image/jpeg;base64,thumbnail-2');
      expect(thumbnails[2]).toBe('data:image/jpeg;base64,thumbnail-3');
    });

    it('calculates correct timestamps for thumbnails', async () => {
      const mockFile = new File(['video content'], 'test.mp4', { type: 'video/mp4' });
      mockVideo.duration = 120;
      
      const timestamps: number[] = [];
      let seekCount = 0;
      
      // Override currentTime setter to capture timestamps
      Object.defineProperty(mockVideo, 'currentTime', {
        set: (value: number) => {
          timestamps.push(value);
        },
        get: () => timestamps[timestamps.length - 1] || 0,
      });
      
      const thumbnailPromise = generateMultipleThumbnails(mockFile, 3);
      
      setTimeout(() => {
        if (mockVideo.onloadedmetadata) {
          mockVideo.onloadedmetadata();
        }
      }, 0);
      
      const simulateSeek = () => {
        setTimeout(() => {
          if (mockVideo.onseeked) {
            seekCount++;
            mockVideo.onseeked();
          }
        }, seekCount * 10);
      };
      
      simulateSeek();
      simulateSeek();
      simulateSeek();
      
      await thumbnailPromise;
      
      // For 3 thumbnails in 120s video: interval = 120/(3+1) = 30
      // Timestamps should be: 30, 60, 90
      expect(timestamps).toEqual([30, 60, 90]);
    });

    it('uses default count when not provided', async () => {
      const mockFile = new File(['video content'], 'test.mp4', { type: 'video/mp4' });
      
      let seekCount = 0;
      const thumbnailPromise = generateMultipleThumbnails(mockFile);
      
      setTimeout(() => {
        if (mockVideo.onloadedmetadata) {
          mockVideo.onloadedmetadata();
        }
      }, 0);
      
      const simulateSeek = () => {
        setTimeout(() => {
          if (mockVideo.onseeked) {
            seekCount++;
            mockVideo.onseeked();
          }
        }, seekCount * 10);
      };
      
      // Simulate 3 seek events (default count)
      simulateSeek();
      simulateSeek();
      simulateSeek();
      
      const thumbnails = await thumbnailPromise;
      
      expect(thumbnails).toHaveLength(3); // Default count
    });

    it('handles canvas context not available', async () => {
      mockCanvas.getContext.mockReturnValue(null);
      
      const mockFile = new File(['video content'], 'test.mp4', { type: 'video/mp4' });
      
      await expect(generateMultipleThumbnails(mockFile, 2)).rejects.toThrow('Could not get canvas 2D context');
    });

    it('handles video loading error', async () => {
      const mockFile = new File(['video content'], 'test.mp4', { type: 'video/mp4' });
      
      const thumbnailPromise = generateMultipleThumbnails(mockFile, 2);
      
      setTimeout(() => {
        if (mockVideo.onerror) {
          const mockError = {
            target: {
              error: {
                message: 'Video load failed',
              },
            },
          };
          mockVideo.onerror(mockError as any);
        }
      }, 0);
      
      await expect(thumbnailPromise).rejects.toThrow('Failed to load video for thumbnails: Video load failed');
      expect(global.URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
    });

    it('handles canvas drawing error during multiple generation', async () => {
      mockContext.drawImage.mockImplementation(() => {
        throw new Error('Canvas drawing failed');
      });
      
      const mockFile = new File(['video content'], 'test.mp4', { type: 'video/mp4' });
      
      const thumbnailPromise = generateMultipleThumbnails(mockFile, 2);
      
      setTimeout(() => {
        if (mockVideo.onloadedmetadata) {
          mockVideo.onloadedmetadata();
        }
      }, 0);
      
      setTimeout(() => {
        if (mockVideo.onseeked) {
          mockVideo.onseeked();
        }
      }, 10);
      
      await expect(thumbnailPromise).rejects.toThrow('Failed to generate thumbnail: Canvas drawing failed');
      expect(global.URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
    });

    it('cleans up resources on completion', async () => {
      const mockFile = new File(['video content'], 'test.mp4', { type: 'video/mp4' });
      
      let seekCount = 0;
      const thumbnailPromise = generateMultipleThumbnails(mockFile, 2);
      
      setTimeout(() => {
        if (mockVideo.onloadedmetadata) {
          mockVideo.onloadedmetadata();
        }
      }, 0);
      
      const simulateSeek = () => {
        setTimeout(() => {
          if (mockVideo.onseeked) {
            seekCount++;
            mockVideo.onseeked();
          }
        }, seekCount * 10);
      };
      
      simulateSeek();
      simulateSeek();
      
      await thumbnailPromise;
      
      expect(global.URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
    });
  });
});