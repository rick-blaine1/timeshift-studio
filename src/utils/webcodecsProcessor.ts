
import { isWebCodecsSupported } from './webcodecs';
import {
  VideoProcessingError,
  ErrorCodes,
  logError,
  retryWithBackoff
} from './errorHandling';

// Import VideoProcessingOptions type
export interface VideoProcessingOptions {
  speedMultiplier: number;
  quality: 'low' | 'medium' | 'high';
  format: 'mp4' | 'webm';
  targetResolution?: { width: number; height: number };
  onProgress?: (progress: number) => void;
  onFrameProgress?: (frame: number, fps: number, fullLogLine?: string) => void;
  maxMemoryUsage?: number;
}

/**
 * VideoFileReader class for reading video files and extracting video/audio streams.
 * This is a placeholder implementation that would integrate with a demuxer library.
 */
export class VideoFileReader {
  private file: File;

  constructor(file: File) {
    this.file = file;
  }

  /**
   * Returns an async generator that yields EncodedVideoChunks from the video stream.
   */
  async *getVideoStream(): AsyncGenerator<EncodedVideoChunk> {
    // Placeholder: In a real implementation, this would use a demuxer library
    // to extract video chunks from the file
    console.warn('[VideoFileReader] getVideoStream is a placeholder implementation');
    // This would typically use mp4box.js or similar to demux the video file
    return;
  }

  /**
   * Returns an async generator that yields EncodedAudioChunks from the audio stream.
   */
  async *getAudioStream(): AsyncGenerator<EncodedAudioChunk> {
    // Placeholder: In a real implementation, this would use a demuxer library
    // to extract audio chunks from the file
    console.warn('[VideoFileReader] getAudioStream is a placeholder implementation');
    // This would typically use mp4box.js or similar to demux the video file
    return;
  }
}

/**
 * WebCodecsProcessor class for handling video and audio processing using WebCodecs API.
 * This class implements a singleton pattern to ensure only one instance is created.
 */
class WebCodecsProcessor {
  public readonly type: 'webcodecs' = 'webcodecs';
  private static instance: WebCodecsProcessor;
  private isInitialized: boolean = false;
  private videoDecodingConfig: VideoDecoderConfig | null = null;
  private audioDecodingConfig: AudioDecoderConfig | undefined;
  private videoEncodingConfig: VideoEncoderConfig | undefined;
  private audioEncodingConfig: AudioEncoderConfig | undefined;

  private constructor() {
    // Private constructor to enforce singleton pattern
  }

  /**
   * Returns the singleton instance of WebCodecsProcessor.
   * If the instance does not exist, it creates one.
   * @returns {WebCodecsProcessor} The singleton instance.
   */
  public static getInstance(): WebCodecsProcessor {
    if (!WebCodecsProcessor.instance) {
      WebCodecsProcessor.instance = new WebCodecsProcessor();
    }
    return WebCodecsProcessor.instance;
  }

  /**
   * Configures video decoding capabilities and stores the most optimal configuration.
   * @param {string} codec The video codec string (e.g., 'vp09.00.10.08', 'avc1.42001E').
   * @param {BufferSource | undefined} description Codec-specific configuration data.
   */
  public async configureVideoDecoding(codec: string, description: BufferSource | undefined = undefined): Promise<void> {
    if (!isWebCodecsSupported()) {
      throw new VideoProcessingError(
        'WebCodecs not supported in this browser',
        ErrorCodes.WEBCODECS_NOT_SUPPORTED
      );
    }
    
    try {
      // Determine the proper container format and MIME type based on codec
      let contentType: string;
      if (codec.startsWith('avc1') || codec.startsWith('avc3')) {
        // H.264 codec - use MP4 container
        contentType = `video/mp4; codecs="${codec}"`;
      } else if (codec.startsWith('vp09') || codec.startsWith('vp08')) {
        // VP9/VP8 codec - use WebM container
        contentType = `video/webm; codecs="${codec}"`;
      } else if (codec.startsWith('av01')) {
        // AV1 codec - use MP4 or WebM container
        contentType = `video/mp4; codecs="${codec}"`;
      } else {
        // Default to MP4 container for unknown codecs
        console.warn(`[WebCodecsProcessor] Unknown codec format: ${codec}, defaulting to MP4 container`);
        contentType = `video/mp4; codecs="${codec}"`;
      }
      
      const decodingConfig: MediaDecodingConfiguration = {
        type: 'file',
        video: {
          contentType: contentType,
          width: 1920,
          height: 1080,
          bitrate: 5000000,
          framerate: 30,
        },
      };
      
      console.log(`[WebCodecsProcessor] Checking decoding support for: ${contentType}`);
      const { supported, smooth, powerEfficient } = await navigator.mediaCapabilities.decodingInfo(decodingConfig);

      if (supported) {
        this.videoDecodingConfig = {
          codec: codec,
          description: description,
          hardwareAcceleration: powerEfficient ? 'prefer-hardware' : 'prefer-software',
        };
        console.log(`Video codec '${codec}' supported. Hardware efficient: ${powerEfficient}, Smooth: ${smooth}`);
      } else {
        throw new VideoProcessingError(
          `Video codec '${codec}' not supported`,
          ErrorCodes.CODEC_NOT_SUPPORTED,
          { codec }
        );
      }
    } catch (error) {
      if (error instanceof VideoProcessingError) {
        throw error;
      }
      logError(error as Error, { operation: 'configureVideoDecoding', codec });
      throw new VideoProcessingError(
        `Failed to configure video decoding for codec ${codec}`,
        ErrorCodes.WEBCODECS_CONFIG_FAILED,
        { codec, originalError: (error as Error).message }
      );
    }
  }

  /**
   * Configures audio decoding capabilities and stores the actual AudioDecoderConfig.
   * @param {string} codec The audio codec string (e.g., 'mp4a.40.2').
   * @param {number} sampleRate The sample rate in Hz (e.g., 48000).
   * @param {number} numberOfChannels The number of audio channels (e.g., 2 for stereo).
   */
  public async configureAudioDecoding(codec: string, sampleRate: number, numberOfChannels: number): Promise<void> {
    if (!isWebCodecsSupported()) {
      console.warn('WebCodecs not supported, cannot configure audio decoding.');
      return;
    }
    
    // Use MediaCapabilities API to check audio decoding support
    try {
      const decodingConfig: MediaDecodingConfiguration = {
        type: 'file', // or 'media-source'
        audio: {
          contentType: `audio/${codec}`,
          channels: numberOfChannels.toString(),
          bitrate: 128000, // Example bitrate
          samplerate: sampleRate,
        },
      };
      
      const { supported, smooth, powerEfficient } = await navigator.mediaCapabilities.decodingInfo(decodingConfig);

      if (supported) {
        // Store the actual AudioDecoderConfig if supported
        this.audioDecodingConfig = {
          codec: codec,
          numberOfChannels: numberOfChannels,
          sampleRate: sampleRate,
        };
        console.log(`Audio codec '${codec}' supported. Hardware efficient: ${powerEfficient}, Smooth: ${smooth}`);
      } else {
        console.warn(`Audio codec '${codec}' not supported.`);
        this.audioDecodingConfig = undefined;
      }
    } catch (error) {
      console.error(`Error querying audio decoding capabilities for codec ${codec}:`, error);
      this.audioDecodingConfig = undefined;
    }
  }

  /**
   * Configures video encoding capabilities and stores the most optimal configuration.
   * @param {string} codec The video codec string (e.g., 'vp09.00.10.08', 'avc1.42001E').
   * @param {number} width The width of the video.
   * @param {number} height The height of the video.
   * @param {number} baseBitrate The base target bitrate in bits per second.
   * @param {number} framerate The target framerate.
   * @param {number | 'low' | 'medium' | 'high'} [quality] Optional quality setting.
   *   If a number, it's a multiplier for baseBitrate (0-1).
   *   If 'low', 'medium', or 'high', a predefined bitrate will be used.
   */
  public async configureVideoEncoding(
    codec: string,
    width: number,
    height: number,
    baseBitrate: number,
    framerate: number,
    quality?: number | 'low' | 'medium' | 'high'
  ): Promise<void> {
    if (!isWebCodecsSupported()) {
      console.warn('WebCodecs not supported, cannot configure video encoding.');
      return;
    }

    let targetBitrate = baseBitrate;

    if (quality !== undefined) {
      if (typeof quality === 'number') {
        targetBitrate = baseBitrate * quality;
      } else {
        // Simple mapping for quality strings to bitrates (example values)
        switch (quality) {
          case 'low':
            targetBitrate = 1_000_000; // 1 Mbps
            break;
          case 'medium':
            targetBitrate = 2_500_000; // 2.5 Mbps
            break;
          case 'high':
            targetBitrate = 5_000_000; // 5 Mbps
            break;
          default:
            console.warn(`Unknown quality setting: ${quality}. Using base bitrate.`);
        }
      }
    }

    // Conceptual: Format conversion via different codec.
    // To support different output formats (e.g., MP4, WebM), the 'codec' parameter
    // would be changed here (e.g., 'avc1.42001E' for H.264 in MP4, 'vp09' for VP9 in WebM).
    // Muxing (packaging into a container format) would happen at a later stage,
    // potentially involving a library like mp4box.js or similar based on the chosen codec.
    // The current VideoEncoderConfig only specifies the video stream's properties.

    const encodingConfig: VideoEncoderConfig = {
      codec: codec,
      width: width,
      height: height,
      bitrate: targetBitrate,
      framerate: framerate,
      hardwareAcceleration: 'prefer-hardware', // Attempt to use hardware acceleration
    };

    try {
      const support = await VideoEncoder.isConfigSupported(encodingConfig);
      if (support.supported) {
        this.videoEncodingConfig = support.config; // Use the optimized config returned by the browser
        console.log(`Video encoding codec '${codec}' supported with config:`, this.videoEncodingConfig);
      } else {
        console.warn(`Video encoding codec '${codec}' not supported with current configuration.`);
        this.videoEncodingConfig = undefined;
      }
    } catch (error) {
      console.error(`Error checking video encoding capabilities for codec ${codec}:`, error);
      this.videoEncodingConfig = undefined;
    }
  }

  /**
   * Configures audio encoding capabilities and stores the AudioEncoderConfig.
   * @param {string} codec The audio codec string (e.g., 'mp4a.40.2' for AAC-LC).
   * @param {number} sampleRate The sample rate in Hz (e.g., 48000).
   * @param {number} numberOfChannels The number of audio channels (e.g., 2 for stereo).
   * @param {number} bitrate The target bitrate in bits per second (e.g., 128000).
   */
  public async configureAudioEncoding(
    codec: string,
    sampleRate: number,
    numberOfChannels: number,
    bitrate: number
  ): Promise<void> {
    if (!isWebCodecsSupported()) {
      console.warn('WebCodecs not supported, cannot configure audio encoding.');
      return;
    }

    const encodingConfig: AudioEncoderConfig = {
      codec: codec,
      sampleRate: sampleRate,
      numberOfChannels: numberOfChannels,
      bitrate: bitrate,
    };

    try {
      const support = await AudioEncoder.isConfigSupported(encodingConfig);
      if (support.supported) {
        this.audioEncodingConfig = support.config; // Use the optimized config returned by the browser
        console.log(`Audio encoding codec '${codec}' supported with config:`, this.audioEncodingConfig);
      } else {
        console.warn(`Audio encoding codec '${codec}' not supported with current configuration.`);
        this.audioEncodingConfig = undefined;
      }
    } catch (error) {
      console.error(`Error checking audio encoding capabilities for codec ${codec}:`, error);
      this.audioEncodingConfig = undefined;
    }
  }

  /**
   * Initializes WebCodecs configuration by checking codec support and hardware acceleration preferences.
   */
  public async init(): Promise<void> {
    if (this.isInitialized) {
      console.warn('WebCodecsProcessor already initialized.');
      return;
    }
    console.log('Initializing WebCodecsProcessor...');

    // Example codecs to check. These would typically come from detected file metadata.
    await this.configureVideoDecoding('vp09.00.10.08'); // Example VP9 codec
    await this.configureVideoDecoding('avc1.42001E'); // Example H.264 codec
    await this.configureAudioDecoding('mp4a.40.2', 48000, 2); // Example AAC codec, 48kHz, stereo

    // Placeholder call for video encoding configuration.
    // In a real application, these parameters would be dynamic,
    // based on user export settings or detected video properties.
    await this.configureVideoEncoding('avc1.42001E', 1920, 1080, 2000000, 30, 'medium'); // H.264, 1080p, 2Mbps, 30fps, medium quality

    // Placeholder call for audio encoding configuration.
    // In a real application, these parameters would be dynamic,
    // based on user export settings or detected audio properties.
    await this.configureAudioEncoding('mp4a.40.2', 48000, 2, 128000); // AAC-LC, 48kHz, stereo, 128kbps

    this.isInitialized = true;
    console.log('WebCodecsProcessor initialization complete.');
  }

  /**
   * Creates a ReadableStream from a File object, reading it in chunks.
   * This stream can then be fed to a demuxer.
   * @param {File} file The input File object.
   * @returns {ReadableStream<Uint8Array>} A ReadableStream of Uint8Array chunks.
   */
  public createSourceStream(file: File): ReadableStream<Uint8Array> {
    const fileSize = file.size;
    let offset = 0;
    const chunkSize = 64 * 1024; // 64KB chunks

    return new ReadableStream({
      async pull(controller) {
        if (offset < fileSize) {
          const slice = file.slice(offset, offset + chunkSize);
          const buffer = await slice.arrayBuffer();
          controller.enqueue(new Uint8Array(buffer));
          offset += buffer.byteLength;
        } else {
          controller.close();
        }
      },
    });
  }

  /**
   * Creates a video file reader that uses a demuxer to extract video and audio tracks.
   *
   * @param {File} file The input video file.
   * @returns {VideoFileReader} A VideoFileReader instance with video and audio stream generators.
   */
  public createVideoFileReader(file: File): VideoFileReader {
    console.log(`Creating video file reader for file: ${file.name}`);
    return new VideoFileReader(file);
  }

  /**
   * Decodes a video file using WebCodecs VideoDecoder.
   * @param {VideoFileReader} fileReader A video file reader providing video and audio streams.
   * @param {(percentage: number, message?: string) => void} progressCallback Optional callback for progress updates.
   * @returns {AsyncGenerator<VideoFrame>} An async generator that yields decoded VideoFrames.
   */
  public async *decodeVideoFile(
    fileReader: VideoFileReader,
    progressCallback?: (percentage: number, message?: string) => void
  ): AsyncGenerator<VideoFrame> {
    if (!isWebCodecsSupported()) {
      throw new VideoProcessingError(
        'WebCodecs not supported, cannot decode video',
        ErrorCodes.WEBCODECS_NOT_SUPPORTED
      );
    }

    if (!this.videoDecodingConfig) {
      throw new VideoProcessingError(
        'Video decoding configuration not set',
        ErrorCodes.WEBCODECS_CONFIG_FAILED
      );
    }

    let frameQueue: VideoFrame[] = [];
    let decoderError: Error | null = null;
    let frameCount = 0;
    let lastProgressReport = 0;
    
    const videoDecoder = new VideoDecoder({
      output: (frame) => {
        frameQueue.push(frame);
      },
      error: (e) => {
        console.error('[WebCodecsProcessor] VideoDecoder error:', e);
        decoderError = e instanceof Error ? e : new Error(String(e));
      },
    });

    try {
      videoDecoder.configure(this.videoDecodingConfig);

      const videoStreamGenerator = fileReader.getVideoStream();

      // Read encoded chunks from the async generator and enqueue them
      for await (const chunk of videoStreamGenerator) {
        // Check for decoder errors before continuing
        if (decoderError) {
          throw new VideoProcessingError(
            'Video decoder encountered an error',
            ErrorCodes.WEBCODECS_DECODE_FAILED,
            { originalError: decoderError.message }
          );
        }
        
        if (chunk) {
          try {
            videoDecoder.decode(chunk);
          } catch (error) {
            logError(error as Error, { operation: 'decode', frameCount });
            throw new VideoProcessingError(
              'Failed to decode video chunk',
              ErrorCodes.WEBCODECS_DECODE_FAILED,
              { frameCount, originalError: (error as Error).message }
            );
          }
        }

        // Yield frames that are ready
        while (frameQueue.length > 0) {
          const frame = frameQueue.shift()!;
          frameCount++;
          
          // Report progress every 30 frames (approximately once per second at 30fps)
          if (progressCallback && frameCount - lastProgressReport >= 30) {
            // We don't know total frames during decoding, so report activity
            progressCallback(0, `Decoding frame ${frameCount}`);
            lastProgressReport = frameCount;
          }
          
          yield frame;
        }
      }

      // After all chunks are enqueued, flush the decoder
      await videoDecoder.flush();

      // Check for errors one final time
      if (decoderError) {
        throw decoderError;
      }

      // Yield any remaining frames after flushing
      while (frameQueue.length > 0) {
        const frame = frameQueue.shift()!;
        frameCount++;
        yield frame;
      }
      
      if (progressCallback) {
        progressCallback(100, `Decoded ${frameCount} frames`);
      }

    } catch (error) {
      // Clean up any remaining frames
      while (frameQueue.length > 0) {
        frameQueue.shift()!.close();
      }
      
      if (error instanceof VideoProcessingError) {
        throw error;
      }
      
      logError(error as Error, { operation: 'decodeVideoFile', frameCount });
      throw new VideoProcessingError(
        'Video decoding failed',
        ErrorCodes.WEBCODECS_DECODE_FAILED,
        { frameCount, originalError: (error as Error).message }
      );
    } finally {
      // Ensure decoder is closed even if errors occur
      if (videoDecoder.state !== 'closed') {
        videoDecoder.close();
      }
      console.log('[WebCodecsProcessor] VideoDecoder closed.');
    }
  }

  /**
   * Encodes video frames using WebCodecs VideoEncoder.
   * @param {AsyncGenerator<VideoFrame>} frames An async generator that yields VideoFrames to be encoded.
   * @param {(percentage: number, message?: string) => void} progressCallback Optional callback for progress updates.
   * @returns {AsyncGenerator<EncodedVideoChunk>} An async generator that yields EncodedVideoChunks.
   */
  public async *encodeVideoFrames(
    frames: AsyncGenerator<VideoFrame>,
    progressCallback?: (percentage: number, message?: string) => void
  ): AsyncGenerator<EncodedVideoChunk> {
    if (!isWebCodecsSupported()) {
      throw new VideoProcessingError(
        'WebCodecs not supported, cannot encode video',
        ErrorCodes.WEBCODECS_NOT_SUPPORTED
      );
    }

    if (!this.videoEncodingConfig) {
      throw new VideoProcessingError(
        'Video encoding configuration not set',
        ErrorCodes.WEBCODECS_CONFIG_FAILED
      );
    }

    let videoEncoder: VideoEncoder | undefined;
    const outputQueue: EncodedVideoChunk[] = [];
    let resolveOutput: (() => void) | undefined;
    let encoderError: Error | null = null;
    let frameCount = 0;
    let lastProgressReport = 0;

    try {
      videoEncoder = new VideoEncoder({
        output: (chunk, metadata) => {
          outputQueue.push(chunk);
          if (resolveOutput) {
            resolveOutput();
            resolveOutput = undefined;
          }
        },
        error: (e) => {
          console.error('[WebCodecsProcessor] VideoEncoder error:', e);
          encoderError = e instanceof Error ? e : new Error(String(e));
        },
      });

      videoEncoder.configure(this.videoEncodingConfig);

      for await (const frame of frames) {
        // Check for encoder errors before continuing
        if (encoderError) {
          frame.close();
          throw new VideoProcessingError(
            'Video encoder encountered an error',
            ErrorCodes.WEBCODECS_ENCODE_FAILED,
            { frameCount, originalError: encoderError.message }
          );
        }
        
        try {
          videoEncoder.encode(frame);
          frame.close();
          frameCount++;
          
          if (progressCallback && frameCount - lastProgressReport >= 30) {
            progressCallback(0, `Encoding frame ${frameCount}`);
            lastProgressReport = frameCount;
          }
        } catch (error) {
          frame.close();
          logError(error as Error, { operation: 'encode', frameCount });
          throw new VideoProcessingError(
            'Failed to encode video frame',
            ErrorCodes.WEBCODECS_ENCODE_FAILED,
            { frameCount, originalError: (error as Error).message }
          );
        }

        // Yield available chunks
        while (outputQueue.length > 0) {
          yield outputQueue.shift()!;
        }
        // If no chunks are available, wait for the next output
        if (outputQueue.length === 0 && videoEncoder.state !== 'closed') {
          await new Promise<void>(resolve => resolveOutput = resolve);
        }
      }

      await videoEncoder.flush();

      // Check for errors one final time
      if (encoderError) {
        throw encoderError;
      }

      // Yield any remaining chunks after flushing
      while (outputQueue.length > 0) {
        yield outputQueue.shift()!;
      }
      
      if (progressCallback) {
        progressCallback(100, `Encoded ${frameCount} frames`);
      }

    } catch (error) {
      if (error instanceof VideoProcessingError) {
        throw error;
      }
      
      logError(error as Error, { operation: 'encodeVideoFrames', frameCount });
      throw new VideoProcessingError(
        'Video encoding failed',
        ErrorCodes.WEBCODECS_ENCODE_FAILED,
        { frameCount, originalError: (error as Error).message }
      );
    } finally {
      if (videoEncoder && videoEncoder.state !== 'closed') {
        videoEncoder.close();
        console.log('[WebCodecsProcessor] VideoEncoder closed.');
      }
    }
  }

  /**
   * Scales a video frame to a target resolution using Canvas API.
   * @param {VideoFrame} frame The input VideoFrame to scale.
   * @param {number} targetWidth The target width.
   * @param {number} targetHeight The target height.
   * @returns {Promise<VideoFrame>} A Promise that resolves to a new scaled VideoFrame.
   */
  public async scaleVideoFrame(frame: VideoFrame, targetWidth: number, targetHeight: number): Promise<VideoFrame> {
    const canvas = new OffscreenCanvas(targetWidth, targetHeight);
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      throw new Error('Failed to get 2D context from OffscreenCanvas');
    }

    let imageBitmap: ImageBitmap | null = null;
    
    try {
      // Draw the frame onto the canvas, scaling it
      ctx.drawImage(frame, 0, 0, targetWidth, targetHeight);

      // Create an ImageBitmap from the canvas
      imageBitmap = await createImageBitmap(canvas);

      // Create a new VideoFrame from the ImageBitmap with the original timestamp
      const scaledFrame = new VideoFrame(imageBitmap, {
        timestamp: frame.timestamp,
        duration: frame.duration,
      });

      return scaledFrame;
    } finally {
      // Always clean up the ImageBitmap to release resources
      if (imageBitmap) {
        imageBitmap.close();
      }
    }
  }

  /**
   * Generates a thumbnail from a video file at a specific timestamp using WebCodecs VideoDecoder.
   * @param {VideoFileReader} fileReader A video file reader providing video and audio streams.
   * @param {number} timestamp The target timestamp in seconds for the thumbnail.
   * @returns {Promise<ImageBitmap | null>} A Promise that resolves to an ImageBitmap of the thumbnail, or null if no frame is found.
   */
  public async generateThumbnailWithWebCodecs(
    fileReader: VideoFileReader,
    timestamp: number
  ): Promise<ImageBitmap | null> {
    if (!isWebCodecsSupported()) {
      console.error('WebCodecs not supported, cannot generate thumbnail.');
      return null;
    }

    const targetTimestampUs = Math.round(timestamp * 1_000_000); // Convert seconds to microseconds
    const decodedFramesGenerator = this.decodeVideoFile(fileReader);
    let thumbnailImageBitmap: ImageBitmap | null = null;
    let foundTarget = false;

    try {
      for await (const videoFrame of decodedFramesGenerator) {
        try {
          if (videoFrame.timestamp >= targetTimestampUs) {
            thumbnailImageBitmap = await createImageBitmap(videoFrame);
            foundTarget = true;
            videoFrame.close(); // Close the frame after creating the ImageBitmap
            break; // Found the target frame, no need to decode further
          }
          videoFrame.close(); // Close frames that are not the target to prevent memory leaks
        } catch (frameError) {
          // Ensure frame is closed even if ImageBitmap creation fails
          videoFrame.close();
          throw frameError;
        }
      }
      
      // If we broke out of the loop early, we need to consume and close remaining frames
      if (foundTarget) {
        for await (const videoFrame of decodedFramesGenerator) {
          videoFrame.close();
        }
      }
    } catch (error) {
      console.error('Error generating thumbnail with WebCodecs:', error);
      // Clean up the ImageBitmap if it was created before the error
      if (thumbnailImageBitmap) {
        thumbnailImageBitmap.close();
        thumbnailImageBitmap = null;
      }
    }

    return thumbnailImageBitmap;
  }

  /**
   * Trims a video segment using WebCodecs, orchestrating decoding and encoding.
   * @param {VideoFileReader} fileReader A video file reader providing video and audio streams.
   * @param {number} startTime The start time of the segment to trim, in seconds.
   * @param {number} endTime The end time of the segment to trim, in seconds.
   * @param {number} [speedMultiplier=1] An optional speed multiplier for the trimmed segment.
   * @param {(percentage: number, message?: string) => void} progressCallback Optional callback for progress updates.
   * @returns {AsyncGenerator<EncodedVideoChunk>} An async generator that yields EncodedVideoChunks of the trimmed segment.
   */
  public async *trimWithWebCodecs(
    fileReader: VideoFileReader,
    startTime: number,
    endTime: number,
    speedMultiplier: number = 1,
    progressCallback?: (percentage: number, message?: string) => void
  ): AsyncGenerator<EncodedVideoChunk> {
    if (!isWebCodecsSupported()) {
      console.error('WebCodecs not supported, cannot trim video.');
      return;
    }

    const startTimeUs = Math.round(startTime * 1_000_000);
    const endTimeUs = Math.round(endTime * 1_000_000);

    // Create a progress proxy for decoding (0-50% of total progress)
    const decodingProgressCallback = progressCallback ? (percentage: number, message?: string) => {
      progressCallback(percentage * 0.5, message ? `Decoding: ${message}` : 'Decoding video');
    } : undefined;

    const decodedFramesGenerator = this.decodeVideoFile(fileReader, decodingProgressCallback);

    const trimmedFramesGenerator = (async function* (): AsyncGenerator<VideoFrame> {
      let firstFrameTimestampUs: number | null = null;
      try {
        for await (const originalFrame of decodedFramesGenerator) {
          try {
            // Conceptual: Apply resolution scaling here if different output resolution is desired for trimmed segment
            // For example:
            // const targetWidth = originalFrame.codedWidth / 2; // Example: Half resolution
            // const targetHeight = originalFrame.codedHeight / 2; // Example: Half resolution
            // const scaledFrame = await processor.scaleVideoFrame(originalFrame, targetWidth, targetHeight);

            if (originalFrame.timestamp >= startTimeUs && originalFrame.timestamp < endTimeUs) {
              if (firstFrameTimestampUs === null) {
                firstFrameTimestampUs = originalFrame.timestamp;
              }
              // Adjust timestamp for trimming and speed multiplier
              const newTimestampUs = (originalFrame.timestamp - firstFrameTimestampUs) / speedMultiplier;
              
              // Create a new VideoFrame with the adjusted timestamp
              const newFrame = new VideoFrame(originalFrame, { timestamp: newTimestampUs });
              originalFrame.close(); // Close the original frame after creating a new one
              yield newFrame;
            } else {
              originalFrame.close(); // Close frames outside the trimming range
            }
          } catch (frameError) {
            // Ensure frame is closed even if processing fails
            originalFrame.close();
            throw frameError;
          }
        }
      } catch (error) {
        console.error('[WebCodecsProcessor] Error in trimmedFramesGenerator:', error);
        throw error;
      }
    })();

    // Create a progress proxy for encoding (50-100% of total progress)
    const encodingProgressCallback = progressCallback ? (percentage: number, message?: string) => {
      progressCallback(50 + percentage * 0.5, message ? `Encoding: ${message}` : 'Encoding video');
    } : undefined;

    yield* this.encodeVideoFrames(trimmedFramesGenerator, encodingProgressCallback);
  }

  /**
   * Concatenates multiple video segments using WebCodecs, orchestrating decoding and encoding.
   * @param {VideoFileReader[]} fileReaders An array of video file readers providing video and audio streams.
   * @param {number} [speedMultiplier=1] An optional speed multiplier for the concatenated video.
   * @param {(percentage: number, message?: string) => void} progressCallback Optional callback for progress updates.
   * @returns {AsyncGenerator<EncodedVideoChunk>} An async generator that yields EncodedVideoChunks of the concatenated video.
   */
  public async *concatWithWebCodecs(
    fileReaders: VideoFileReader[],
    speedMultiplier: number = 1,
    progressCallback?: (percentage: number, message?: string) => void
  ): AsyncGenerator<EncodedVideoChunk> {
    if (!isWebCodecsSupported()) {
      console.error('WebCodecs not supported, cannot concatenate video.');
      return;
    }

    let currentTimestampUs = 0; // Cumulative timestamp for concatenation
    const totalFiles = fileReaders.length;

    // This generator will combine frames from all input videos, adjusting timestamps
    const combinedFramesGenerator = (async function* (processor: WebCodecsProcessor): AsyncGenerator<VideoFrame> {
      try {
        for (let fileIndex = 0; fileIndex < fileReaders.length; fileIndex++) {
          const fileReader = fileReaders[fileIndex];
          
          // Create a progress proxy for each file's decoding (split progress across all files)
          const fileProgressCallback = progressCallback ? (percentage: number, message?: string) => {
            const fileProgressStart = (fileIndex / totalFiles) * 50; // First 50% for decoding all files
            const fileProgressRange = (1 / totalFiles) * 50;
            const overallProgress = fileProgressStart + (percentage / 100) * fileProgressRange;
            progressCallback(overallProgress, message ? `File ${fileIndex + 1}/${totalFiles}: ${message}` : `Processing file ${fileIndex + 1}/${totalFiles}`);
          } : undefined;
          
          const decodedFramesGenerator = processor.decodeVideoFile(fileReader, fileProgressCallback);
          let firstFrameOfCurrentVideoTimestampUs: number | null = null;
          let lastFrameOfCurrentVideoTimestampUs: number | null = null;

          try {
            for await (const originalFrame of decodedFramesGenerator) {
              try {
                // Conceptual: Apply resolution scaling here if different output resolution is desired for concatenated video
                // For example:
                // const targetWidth = originalFrame.codedWidth / 2; // Example: Half resolution
                // const targetHeight = originalFrame.codedHeight / 2; // Example: Half resolution
                // const scaledFrame = await processor.scaleVideoFrame(originalFrame, targetWidth, targetHeight);

                if (firstFrameOfCurrentVideoTimestampUs === null) {
                  firstFrameOfCurrentVideoTimestampUs = originalFrame.timestamp;
                }
                lastFrameOfCurrentVideoTimestampUs = originalFrame.timestamp;
                
                // Adjust timestamp for concatenation and speed multiplier
                const newTimestampUs = currentTimestampUs + ((originalFrame.timestamp - firstFrameOfCurrentVideoTimestampUs) / speedMultiplier);
                
                // Create a new VideoFrame with the adjusted timestamp
                const newFrame = new VideoFrame(originalFrame, { timestamp: newTimestampUs });
                originalFrame.close(); // Close the original frame after creating a new one
                yield newFrame;
              } catch (frameError) {
                // Ensure frame is closed even if processing fails
                originalFrame.close();
                throw frameError;
              }
            }
          } catch (fileError) {
            console.error(`[WebCodecsProcessor] Error processing file ${fileIndex + 1}/${totalFiles}:`, fileError);
            throw fileError;
          }

          // Update currentTimestampUs for the next video segment
          if (firstFrameOfCurrentVideoTimestampUs !== null && lastFrameOfCurrentVideoTimestampUs !== null) {
            const durationOfCurrentVideoUs = lastFrameOfCurrentVideoTimestampUs - firstFrameOfCurrentVideoTimestampUs;
            currentTimestampUs += (durationOfCurrentVideoUs / speedMultiplier);
          }
        }
      } catch (error) {
        console.error('[WebCodecsProcessor] Error in combinedFramesGenerator:', error);
        throw error;
      }
    })(this); // Pass 'this' (WebCodecsProcessor instance) to the generator

    // Create a progress proxy for encoding (50-100% of total progress)
    const encodingProgressCallback = progressCallback ? (percentage: number, message?: string) => {
      progressCallback(50 + percentage * 0.5, message ? `Encoding: ${message}` : 'Encoding concatenated video');
    } : undefined;

    yield* this.encodeVideoFrames(combinedFramesGenerator, encodingProgressCallback);
  }

  /**
   * Decodes audio chunks using WebCodecs AudioDecoder.
   * @param {AsyncGenerator<EncodedAudioChunk>} audioChunks An async generator that yields EncodedAudioChunks to be decoded.
   * @returns {AsyncGenerator<AudioData>} An async generator that yields decoded AudioData objects.
   */
  public async *decodeAudioFile(audioChunks: AsyncGenerator<EncodedAudioChunk>): AsyncGenerator<AudioData> {
    if (!isWebCodecsSupported()) {
      console.error('WebCodecs not supported, cannot decode audio.');
      return;
    }

    if (!this.audioDecodingConfig) {
      console.error('Audio decoding configuration not set. Call configureAudioDecoding first.');
      throw new Error('Audio decoding configuration is missing.');
    }

    let audioQueue: AudioData[] = [];
    const audioDecoder = new AudioDecoder({
      output: (audioData) => {
        audioQueue.push(audioData);
      },
      error: (e) => {
        console.error('AudioDecoder error:', e);
        throw e;
      },
    });

    try {
      audioDecoder.configure(this.audioDecodingConfig);

      // Read encoded chunks from the async generator and enqueue them
      for await (const chunk of audioChunks) {
        if (chunk) {
          audioDecoder.decode(chunk);
        }

        // Yield audio data that is ready
        while (audioQueue.length > 0) {
          const audioData = audioQueue.shift()!;
          yield audioData;
          // Note: The consumer of this generator is responsible for closing the AudioData
        }
      }

      // After all chunks are enqueued, flush the decoder
      await audioDecoder.flush();

      // Yield any remaining audio data after flushing
      while (audioQueue.length > 0) {
        const audioData = audioQueue.shift()!;
        yield audioData;
        // Note: The consumer of this generator is responsible for closing the AudioData
      }

    } catch (error) {
      console.error('[WebCodecsProcessor] Error in decodeAudioFile:', error);
      // Clean up any remaining audio data in the queue
      while (audioQueue.length > 0) {
        audioQueue.shift()!.close();
      }
      throw error;
    } finally {
      // Ensure decoder is closed even if errors occur
      audioDecoder.close();
      console.log('[WebCodecsProcessor] AudioDecoder closed.');
    }
  }

  /**
   * Strips audio from video by returning an empty audio stream.
   * When speed adjustments are applied, audio is completely removed from the output.
   *
   * @param {AsyncGenerator<AudioData>} audioData The input audio data stream (will be discarded).
   * @param {number} speedMultiplier The desired speed multiplier (informational only).
   * @returns {AsyncGenerator<AudioData>} An empty async generator (no audio output).
   */
  public async *processAudioForSpeedChange(
    audioData: AsyncGenerator<AudioData>,
    speedMultiplier: number
  ): AsyncGenerator<AudioData> {
    console.log(`[WebCodecsProcessor] Stripping audio for speed change (${speedMultiplier}x) - audio will be removed from output`);

    // AUDIO STRIPPING IMPLEMENTATION:
    // When speed adjustments are applied, we strip all audio from the video.
    // This is accomplished by:
    // 1. Consuming the input audio stream to prevent memory leaks
    // 2. Closing all AudioData objects to release resources
    // 3. Not yielding any audio data to the output
    //
    // The result is that when this generator is consumed by the muxer,
    // no audio chunks will be written to the output file.

    for await (const audio of audioData) {
      // Close the audio data to release resources, but don't yield it
      audio.close();
    }
    
    console.log(`[WebCodecsProcessor] Audio stripping complete - no audio data yielded`);
    
    // Generator completes without yielding any audio data
    // This results in a video-only output when muxed
  }

  /**
   * Encodes audio data using WebCodecs AudioEncoder.
   * @param {AsyncGenerator<AudioData>} audioData An async generator that yields AudioData objects to be encoded.
   * @returns {AsyncGenerator<EncodedAudioChunk>} An async generator that yields EncodedAudioChunks.
   */
  public async *encodeAudioData(audioData: AsyncGenerator<AudioData>): AsyncGenerator<EncodedAudioChunk> {
    if (!isWebCodecsSupported()) {
      console.error('WebCodecs not supported, cannot encode audio.');
      return;
    }

    if (!this.audioEncodingConfig) {
      console.error('Audio encoding configuration not set. Call configureAudioEncoding first.');
      throw new Error('Audio encoding configuration is missing.');
    }

    let audioEncoder: AudioEncoder | undefined;
    const outputQueue: EncodedAudioChunk[] = [];
    let resolveOutput: (() => void) | undefined;
    let encoderError: Error | null = null;

    try {
      audioEncoder = new AudioEncoder({
        output: (chunk, metadata) => {
          outputQueue.push(chunk);
          if (resolveOutput) {
            resolveOutput();
            resolveOutput = undefined;
          }
        },
        error: (e) => {
          console.error('[WebCodecsProcessor] AudioEncoder error:', e);
          encoderError = e instanceof Error ? e : new Error(String(e));
        },
      });

      audioEncoder.configure(this.audioEncodingConfig);

      for await (const audio of audioData) {
        // Check for encoder errors before continuing
        if (encoderError) {
          audio.close();
          throw encoderError;
        }
        
        try {
          audioEncoder.encode(audio);
          audio.close(); // Important: Close the audio data after encoding
        } catch (error) {
          console.error('[WebCodecsProcessor] Error encoding audio:', error);
          audio.close();
          throw error;
        }

        // Yield available chunks
        while (outputQueue.length > 0) {
          yield outputQueue.shift()!;
        }
        // If no chunks are available, wait for the next output
        if (outputQueue.length === 0 && audioEncoder.state !== 'closed') {
          await new Promise<void>(resolve => resolveOutput = resolve);
        }
      }

      await audioEncoder.flush();

      // Check for errors one final time
      if (encoderError) {
        throw encoderError;
      }

      // Yield any remaining chunks after flushing
      while (outputQueue.length > 0) {
        yield outputQueue.shift()!;
      }

    } catch (error) {
      console.error('[WebCodecsProcessor] Error in encodeAudioData:', error);
      throw error;
    } finally {
      if (audioEncoder && audioEncoder.state !== 'closed') {
        audioEncoder.close();
        console.log('[WebCodecsProcessor] AudioEncoder closed.');
      }
    }
  }

  /**
   * Muxes encoded video and audio chunks into a container format.
   * This is a placeholder that would integrate with a muxing library like mp4box.js.
   * @param {AsyncGenerator<EncodedVideoChunk>} videoChunks An async generator yielding encoded video chunks.
   * @param {AsyncGenerator<EncodedAudioChunk>} audioChunks An async generator yielding encoded audio chunks.
   * @param {string} format The output container format ('mp4' or 'webm').
   * @returns {Promise<Blob>} A Promise that resolves to a Blob containing the muxed video file.
   */
  public async muxEncodedChunks(
    videoChunks: AsyncGenerator<EncodedVideoChunk>,
    audioChunks: AsyncGenerator<EncodedAudioChunk>,
    format: 'mp4' | 'webm'
  ): Promise<Blob> {
    console.log(`[WebCodecsProcessor] Muxing video and audio chunks into ${format} format`);
    
    // Placeholder implementation
    // In a real implementation, this would use a library like mp4box.js for MP4
    // or webm-muxer for WebM to package the encoded chunks into a container format
    
    const chunks: BlobPart[] = [];
    
    // Collect video chunks
    for await (const chunk of videoChunks) {
      const buffer = new ArrayBuffer(chunk.byteLength);
      chunk.copyTo(buffer);
      chunks.push(buffer);
    }
    
    // Collect audio chunks
    for await (const chunk of audioChunks) {
      const buffer = new ArrayBuffer(chunk.byteLength);
      chunk.copyTo(buffer);
      chunks.push(buffer);
    }
    
    console.warn('[WebCodecsProcessor] muxEncodedChunks is a placeholder - real muxing library needed');
    
    // Return a blob (this would be properly muxed in a real implementation)
    return new Blob(chunks, { type: format === 'mp4' ? 'video/mp4' : 'video/webm' });
  }

  /**
   * Processes a video file with the given options.
   * This is the main entry point for video processing operations.
   * @param {File} file The input video file.
   * @param {VideoProcessingOptions} options Processing options including speed, quality, format, etc.
   * @returns {Promise<Blob>} A Promise that resolves to a Blob containing the processed video.
   */
  public async processVideo(file: File, options: VideoProcessingOptions): Promise<Blob> {
    console.log('[WebCodecsProcessor] Starting video processing with options:', options);
    
    if (!isWebCodecsSupported()) {
      throw new Error('WebCodecs not supported in this browser');
    }

    // Initialize if not already done
    if (!this.isInitialized) {
      await this.init();
    }

    // Create file reader
    const fileReader = this.createVideoFileReader(file);

    // Create a progress proxy for decoding (0-50% of total progress)
    const decodingProgressCallback = options.onProgress ? (percentage: number, message?: string) => {
      options.onProgress!(percentage * 0.5);
    } : undefined;

    // Decode video frames
    const decodedFrames = this.decodeVideoFile(fileReader, decodingProgressCallback);

    // Apply speed multiplier if needed
    const processedFrames = (async function* (
      frames: AsyncGenerator<VideoFrame>,
      speed: number
    ): AsyncGenerator<VideoFrame> {
      let frameIndex = 0;
      try {
        for await (const frame of frames) {
          try {
            // Adjust timestamp based on speed multiplier
            const newTimestamp = frame.timestamp / speed;
            const newFrame = new VideoFrame(frame, { timestamp: newTimestamp });
            frame.close();
            
            if (options.onFrameProgress) {
              options.onFrameProgress(frameIndex++, 30, `Processing frame ${frameIndex}`);
            }
            
            yield newFrame;
          } catch (frameError) {
            // Ensure frame is closed even if processing fails
            frame.close();
            throw frameError;
          }
        }
      } catch (error) {
        console.error('[WebCodecsProcessor] Error in processedFrames generator:', error);
        throw error;
      }
    })(decodedFrames, options.speedMultiplier);

    // Create a progress proxy for encoding (50-100% of total progress)
    const encodingProgressCallback = options.onProgress ? (percentage: number, message?: string) => {
      options.onProgress!(50 + percentage * 0.5);
    } : undefined;

    // Encode frames
    const encodedChunks = this.encodeVideoFrames(processedFrames, encodingProgressCallback);

    // For now, create an empty audio generator (audio processing to be implemented)
    const emptyAudioGenerator = (async function* (): AsyncGenerator<EncodedAudioChunk> {
      // Empty generator - no audio chunks
      return;
    })();

    // Mux the encoded chunks
    const outputBlob = await this.muxEncodedChunks(encodedChunks, emptyAudioGenerator, options.format);

    console.log('[WebCodecsProcessor] Video processing complete');
    
    if (options.onProgress) {
      options.onProgress(100);
    }

    return outputBlob;
  }
}

// Export the singleton instance
export const webCodecsProcessor = WebCodecsProcessor.getInstance();

// Export the class for type checking
export { WebCodecsProcessor };