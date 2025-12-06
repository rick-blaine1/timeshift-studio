import { vi, describe, it, expect, beforeEach } from 'vitest';
import { VideoProcessor, concatenateVideos } from '../videoProcessor';
import { VideoFileStatus } from '@/types/schema/VideoFile';

// Mock canvas and MediaRecorder
const mockCanvas = {
  getContext: vi.fn(() => ({
    drawImage: vi.fn(),
  })),
  captureStream: vi.fn(() => ({
    getTracks: vi.fn(() => []),
  })),
  width: 1920,
  height: 1080,
};

const mockMediaRecorder = {
  start: vi.fn(),
  stop: vi.fn(),
  state: 'inactive',
  ondataavailable: null,
  onstop: null,
  onerror: null,
};

// Mock DOM elements
Object.defineProperty(document, 'createElement', {
  value: vi.fn((tagName: string) => {
    if (tagName === 'canvas') {
      return mockCanvas;
    }
    if (tagName === 'video') {
      return {
        muted: false,
        playsInline: false,
        crossOrigin: null,
        onloadedmetadata: null,
        onseeked: null,
        onerror: null,
        currentTime: 0,
        duration: 120,
        src: '',
        load: vi.fn(),
      };
    }
    return {};
  }),
});

// Mock MediaRecorder
global.MediaRecorder = vi.fn().mockImplementation(() => mockMediaRecorder) as any;
(global.MediaRecorder as any).isTypeSupported = vi.fn().mockReturnValue(true);

// Mock URL.createObjectURL and revokeObjectURL
global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
global.URL.revokeObjectURL = vi.fn();

// Mock storage service
vi.mock('@/services/storage', () => ({
  storageService: {
    loadVideoFile: vi.fn().mockResolvedValue(new Blob(['mock video data'], { type: 'video/mp4' })),
  },
}));

describe('VideoProcessor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates processor with canvas context', () => {
    expect(() => new VideoProcessor()).not.toThrow();
    expect(document.createElement).toHaveBeenCalledWith('canvas');
    expect(mockCanvas.getContext).toHaveBeenCalledWith('2d');
  });

  it('throws error if canvas context is not available', () => {
    mockCanvas.getContext.mockReturnValueOnce(null);
    
    expect(() => new VideoProcessor()).toThrow('Could not get canvas 2D context');
  });

  it('sets correct video bitrate based on quality', () => {
    const processor = new VideoProcessor();
    
    // Test private method through reflection (for testing purposes)
    const getBitrate = (processor as any).getVideoBitrate;
    
    expect(getBitrate('low')).toBe(1000000);
    expect(getBitrate('medium')).toBe(2500000);
    expect(getBitrate('high')).toBe(5000000);
  });

  it('disposes resources correctly', () => {
    const processor = new VideoProcessor();
    
    processor.dispose();
    
    expect(mockMediaRecorder.stop).not.toHaveBeenCalled(); // Should not stop if not recording
  });
});

describe('concatenateVideos', () => {
  const mockClips = [
    {
      id: 'clip-1',
      fileId: 'file-1',
      startTime: 0,
      duration: 60,
      trimStart: 0,
      trimEnd: 60,
      speedMultiplier: 1,
      order: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    {
      id: 'clip-2',
      fileId: 'file-2',
      startTime: 60,
      duration: 90,
      trimStart: 0,
      trimEnd: 90,
      speedMultiplier: 1,
      order: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
  ];

  const mockFiles = [
    {
      id: 'file-1',
      name: 'video1.mp4',
      size: 1024 * 1024,
      type: 'video/mp4',
      lastModified: Date.now(),
      duration: 60,
      width: 1920,
      height: 1080,
      framerate: 30,
      thumbnail: 'data:image/jpeg;base64,test1',
      thumbnailTimestamp: 5,
      status: VideoFileStatus.READY,
      indexedDBKey: 'file-1',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    {
      id: 'file-2',
      name: 'video2.mp4',
      size: 2 * 1024 * 1024,
      type: 'video/mp4',
      lastModified: Date.now(),
      duration: 90,
      width: 1920,
      height: 1080,
      framerate: 30,
      thumbnail: 'data:image/jpeg;base64,test2',
      thumbnailTimestamp: 5,
      status: VideoFileStatus.READY,
      indexedDBKey: 'file-2',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock MediaRecorder behavior
    mockMediaRecorder.start.mockImplementation(() => {
      // Simulate recording process
      setTimeout(() => {
        if (mockMediaRecorder.ondataavailable) {
          mockMediaRecorder.ondataavailable({ data: new Blob(['mock video'], { type: 'video/mp4' }) });
        }
        if (mockMediaRecorder.onstop) {
          mockMediaRecorder.onstop();
        }
      }, 100);
    });
  });

  it('throws error for empty clips array', async () => {
    const options = {
      speedMultiplier: 1,
      quality: 'medium' as const,
      format: 'mp4' as const,
    };

    await expect(concatenateVideos([], mockFiles, options)).rejects.toThrow('No clips to process');
  });

  it('processes clips with correct speed multiplier', async () => {
    const options = {
      speedMultiplier: 2,
      quality: 'medium' as const,
      format: 'mp4' as const,
      onProgress: vi.fn(),
    };

    // Mock successful processing
    const result = await concatenateVideos(mockClips, mockFiles, options);

    expect(result).toEqual({
      blob: expect.any(Blob),
      duration: 75, // (60 + 90) / 2
      size: expect.any(Number),
    });

    expect(options.onProgress).toHaveBeenCalled();
  });

  it('handles different video formats', async () => {
    const webmOptions = {
      speedMultiplier: 1,
      quality: 'high' as const,
      format: 'webm' as const,
    };

    const result = await concatenateVideos(mockClips, mockFiles, webmOptions);

    expect(result.blob.type).toContain('webm');
  });

  it('calls progress callback during processing', async () => {
    const progressCallback = vi.fn();
    const options = {
      speedMultiplier: 1,
      quality: 'medium' as const,
      format: 'mp4' as const,
      onProgress: progressCallback,
    };

    await concatenateVideos(mockClips, mockFiles, options);

    expect(progressCallback).toHaveBeenCalled();
    expect(progressCallback).toHaveBeenCalledWith(expect.any(Number));
  });

  it('handles missing file error', async () => {
    const clipsWithMissingFile = [
      {
        id: 'clip-1',
        fileId: 'missing-file',
        startTime: 0,
        duration: 60,
        order: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ];

    const options = {
      speedMultiplier: 1,
      quality: 'medium' as const,
      format: 'mp4' as const,
    };

    await expect(concatenateVideos(clipsWithMissingFile, mockFiles, options))
      .rejects.toThrow('File not found for clip clip-1');
  });

  it('handles storage loading errors gracefully', async () => {
    // Mock storage service to throw error
    const { storageService } = await import('@/services/storage');
    vi.mocked(storageService.loadVideoFile).mockRejectedValueOnce(new Error('Storage error'));

    const options = {
      speedMultiplier: 1,
      quality: 'medium' as const,
      format: 'mp4' as const,
    };

    await expect(concatenateVideos(mockClips, mockFiles, options))
      .rejects.toThrow();
  });

  it('cleans up resources on completion', async () => {
    const options = {
      speedMultiplier: 1,
      quality: 'medium' as const,
      format: 'mp4' as const,
    };

    await concatenateVideos(mockClips, mockFiles, options);

    // Verify URL cleanup
    expect(global.URL.revokeObjectURL).toHaveBeenCalled();
  });
});

describe('FFmpeg Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mock('../ffmpeg', () => ({
      initFFmpeg: vi.fn().mockResolvedValue(undefined),
      trimVideo: vi.fn().mockResolvedValue(new Blob(['trimmed'], { type: 'video/mp4' })),
      concatVideos: vi.fn().mockResolvedValue(new Blob(['concatenated'], { type: 'video/mp4' })),
      transcodeVideo: vi.fn().mockResolvedValue(new Blob(['transcoded'], { type: 'video/webm' })),
    }));
  });

  it('initializes FFmpeg before processing', async () => {
    const { initFFmpeg } = await import('../ffmpeg');
    const processor = new VideoProcessor();
    
    await processor.processTimeline(
      mockClips,
      mockFiles,
      { speedMultiplier: 1, quality: 'medium', format: 'mp4' }
    );
    
    expect(initFFmpeg).toHaveBeenCalled();
  });

  it('trims single clip correctly', async () => {
    const { trimVideo } = await import('../ffmpeg');
    const processor = new VideoProcessor();
    
    await processor.processTimeline(
      [mockClips[0]],
      mockFiles,
      { speedMultiplier: 1, quality: 'medium', format: 'mp4' }
    );
    
    expect(trimVideo).toHaveBeenCalledWith(
      mockFiles[0].blob,
      mockClips[0].trimStart,
      mockClips[0].trimEnd,
      mockClips[0].speedMultiplier || 1,
      'output.mp4'
    );
  });

  it('concatenates multiple clips correctly', async () => {
    const { concatVideos } = await import('../ffmpeg');
    const processor = new VideoProcessor();
    
    await processor.processTimeline(
      mockClips,
      mockFiles,
      { speedMultiplier: 1, quality: 'medium', format: 'mp4' }
    );
    
    expect(concatVideos).toHaveBeenCalledWith(
      [mockFiles[0].blob, mockFiles[1].blob],
      mockClips
    );
  });

  it('transcodes video when format changes', async () => {
    const { transcodeVideo } = await import('../ffmpeg');
    const processor = new VideoProcessor();
    
    await processor.processTimeline(
      [mockClips[0]],
      mockFiles,
      { speedMultiplier: 1, quality: 'medium', format: 'webm' }
    );
    
    expect(transcodeVideo).toHaveBeenCalledWith(
      expect.any(Blob),
      { format: 'webm', quality: 'medium' }
    );
  });

  it('handles FFmpeg processing errors', async () => {
    const { trimVideo } = await import('../ffmpeg');
    trimVideo.mockRejectedValueOnce(new Error('FFmpeg error'));
    
    const processor = new VideoProcessor();
    
    await expect(
      processor.processTimeline(
        [mockClips[0]],
        mockFiles,
        { speedMultiplier: 1, quality: 'medium', format: 'mp4' }
      )
    ).rejects.toThrow('FFmpeg processing failed');
  });
});