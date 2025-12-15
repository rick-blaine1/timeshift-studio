import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WebCodecsProcessor, VideoFileReader, VideoProcessingOptions } from '@/utils/webcodecsProcessor';
import { VideoProcessingError, ErrorCodes } from '@/utils/errorHandling';
import * as webcodecs from '@/utils/webcodecs';
import {
  MockVideoDecoder,
  MockVideoEncoder,
  MockVideoFrame,
  MockEncodedVideoChunk,
  MockAudioDecoder,
  MockAudioEncoder,
} from './mocks';

// Setup global mocks before each test
beforeEach(() => {
  // Mock isWebCodecsSupported to return true
  vi.spyOn(webcodecs, 'isWebCodecsSupported').mockReturnValue(true);
  
  // Mock WebCodecs API
  global.VideoDecoder = MockVideoDecoder as any;
  global.VideoEncoder = MockVideoEncoder as any;
  global.VideoFrame = MockVideoFrame as any;
  global.EncodedVideoChunk = MockEncodedVideoChunk as any;
  global.AudioDecoder = MockAudioDecoder as any;
  global.AudioEncoder = MockAudioEncoder as any;
  global.EncodedAudioChunk = class {} as any;
  global.AudioData = class {} as any;
  
  // Mock createImageBitmap
  global.createImageBitmap = vi.fn().mockResolvedValue({
    width: 1920,
    height: 1080,
    close: vi.fn(),
  }) as any;

  // Mock OffscreenCanvas
  global.OffscreenCanvas = class {
    width: number;
    height: number;
    constructor(width: number, height: number) {
      this.width = width;
      this.height = height;
    }
    getContext() {
      return {
        drawImage: vi.fn(),
      };
    }
  } as any;

  // Mock navigator.mediaCapabilities
  if (!global.navigator) {
    global.navigator = {} as any;
  }
  Object.defineProperty(global.navigator, 'mediaCapabilities', {
    value: {
      decodingInfo: vi.fn().mockResolvedValue({
        supported: true,
        smooth: true,
        powerEfficient: true,
      }),
    },
    writable: true,
    configurable: true,
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('WebCodecsProcessor', () => {
  describe('Singleton Pattern', () => {
    it('should return the same instance on multiple calls', () => {
      const instance1 = WebCodecsProcessor.getInstance();
      const instance2 = WebCodecsProcessor.getInstance();
      
      expect(instance1).toBe(instance2);
    });

    it('should have type "webcodecs"', () => {
      const processor = WebCodecsProcessor.getInstance();
      expect(processor.type).toBe('webcodecs');
    });
  });

  describe('init()', () => {
    it('should initialize successfully when WebCodecs is supported', async () => {
      const processor = WebCodecsProcessor.getInstance();
      
      await expect(processor.init()).resolves.not.toThrow();
    });

    it('should not reinitialize if already initialized', async () => {
      const processor = WebCodecsProcessor.getInstance();
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      await processor.init();
      await processor.init();
      
      expect(consoleSpy).toHaveBeenCalledWith('WebCodecsProcessor already initialized.');
      consoleSpy.mockRestore();
    });
  });

  describe('configureVideoDecoding()', () => {
    it('should configure video decoding for supported codec', async () => {
      const processor = WebCodecsProcessor.getInstance();
      
      await expect(
        processor.configureVideoDecoding('vp09.00.10.08')
      ).resolves.not.toThrow();
    });
  });

  describe('configureVideoEncoding()', () => {
    it('should configure video encoding with quality settings', async () => {
      const processor = WebCodecsProcessor.getInstance();
      
      await expect(
        processor.configureVideoEncoding('avc1.42001E', 1920, 1080, 2000000, 30, 'medium')
      ).resolves.not.toThrow();
    });

    it('should handle low/medium/high quality presets', async () => {
      const processor = WebCodecsProcessor.getInstance();
      const isConfigSupportedSpy = vi.spyOn(MockVideoEncoder, 'isConfigSupported');
      
      await processor.configureVideoEncoding('avc1.42001E', 1920, 1080, 2000000, 30, 'low');
      expect(isConfigSupportedSpy).toHaveBeenCalledWith(
        expect.objectContaining({ bitrate: 1_000_000 })
      );
      
      await processor.configureVideoEncoding('avc1.42001E', 1920, 1080, 2000000, 30, 'medium');
      expect(isConfigSupportedSpy).toHaveBeenCalledWith(
        expect.objectContaining({ bitrate: 2_500_000 })
      );
      
      await processor.configureVideoEncoding('avc1.42001E', 1920, 1080, 2000000, 30, 'high');
      expect(isConfigSupportedSpy).toHaveBeenCalledWith(
        expect.objectContaining({ bitrate: 5_000_000 })
      );
    });
  });

  describe('createVideoFileReader()', () => {
    it('should create a VideoFileReader instance', () => {
      const processor = WebCodecsProcessor.getInstance();
      const mockFile = new File(['test'], 'test.mp4', { type: 'video/mp4' });
      
      const reader = processor.createVideoFileReader(mockFile);
      
      expect(reader).toBeInstanceOf(VideoFileReader);
    });
  });

  describe('createSourceStream()', () => {
    it('should create a ReadableStream from a File', async () => {
      const processor = WebCodecsProcessor.getInstance();
      const mockFile = new File(['test data'], 'test.mp4', { type: 'video/mp4' });
      
      const stream = processor.createSourceStream(mockFile);
      
      expect(stream).toBeInstanceOf(ReadableStream);
      
      // Read the stream to verify it works
      const reader = stream.getReader();
      const { value, done } = await reader.read();
      
      expect(done).toBe(false);
      expect(value).toBeInstanceOf(Uint8Array);
    });

    it('should read file in chunks', async () => {
      const processor = WebCodecsProcessor.getInstance();
      const largeData = new Uint8Array(128 * 1024); // 128KB
      const mockFile = new File([largeData], 'test.mp4', { type: 'video/mp4' });
      
      const stream = processor.createSourceStream(mockFile);
      const reader = stream.getReader();
      
      let chunkCount = 0;
      let totalBytes = 0;
      
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        
        chunkCount++;
        totalBytes += value.byteLength;
      }
      
      expect(chunkCount).toBeGreaterThan(1);
      expect(totalBytes).toBe(largeData.byteLength);
    });
  });

  describe('scaleVideoFrame()', () => {
    it('should scale a video frame to target resolution', async () => {
      const processor = WebCodecsProcessor.getInstance();
      const mockFrame = new MockVideoFrame({
        timestamp: 0,
        duration: 33333,
      }) as unknown as VideoFrame;
      
      const scaledFrame = await processor.scaleVideoFrame(mockFrame, 1280, 720);
      
      expect(scaledFrame).toBeDefined();
      expect(scaledFrame.timestamp).toBe(0);
    });

    it('should preserve timestamp and duration when scaling', async () => {
      const processor = WebCodecsProcessor.getInstance();
      const mockFrame = new MockVideoFrame({
        timestamp: 1000000,
        duration: 33333,
      }) as unknown as VideoFrame;
      
      const scaledFrame = await processor.scaleVideoFrame(mockFrame, 640, 360);
      
      expect(scaledFrame.timestamp).toBe(1000000);
      expect(scaledFrame.duration).toBe(33333);
    });
  });
});

/**
 * INTEGRATION TEST STRUCTURE DOCUMENTATION
 * 
 * The following describes the structure for integration tests that compare
 * WebCodecs output with FFmpeg.wasm output. These tests would require:
 * 
 * 1. Sample video files (small test videos in various formats)
 * 2. Actual browser environment (Playwright or similar)
 * 3. Both WebCodecs and FFmpeg.wasm implementations available
 * 
 * Test Categories:
 * - Trim Operation Comparison: Compare trimmed video outputs
 * - Concatenation Operation Comparison: Compare concatenated video outputs
 * - Thumbnail Generation Comparison: Compare generated thumbnails
 * - Performance Comparison: Measure processing time for both methods
 * - Error Handling Comparison: Verify both handle errors similarly
 * 
 * Each test would:
 * 1. Load test video(s)
 * 2. Process with WebCodecs
 * 3. Process with FFmpeg
 * 4. Compare outputs (duration, file size, metadata, visual similarity)
 * 
 * Helper functions needed:
 * - loadTestVideo(path): Load video file from test fixtures
 * - processWithWebCodecs(file, options): Process using WebCodecs
 * - processWithFFmpeg(file, options): Process using FFmpeg
 * - compareVideoFrames(video1, video2): Compare visual similarity
 * - compareImages(img1, img2): Compare image similarity
 */

describe('Integration Test Structure Documentation', () => {
  it('should document the integration test approach', () => {
    // This test serves as documentation for the integration test structure
    // See the block comment above for the full integration test plan
    expect(true).toBe(true);
  });
});