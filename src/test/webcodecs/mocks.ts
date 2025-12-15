/**
 * Mock WebCodecs API Objects for Testing
 * These mocks simulate the behavior of the WebCodecs API
 */

export class MockVideoDecoder {
  state: 'unconfigured' | 'configured' | 'closed' = 'unconfigured';
  protected outputCallback: (frame: VideoFrame) => void;
  protected errorCallback: (error: Error) => void;

  constructor(init: VideoDecoderInit) {
    this.outputCallback = init.output;
    this.errorCallback = init.error;
  }

  configure(config: VideoDecoderConfig): void {
    this.state = 'configured';
  }

  decode(chunk: EncodedVideoChunk): void {
    // Simulate decoding by creating a mock VideoFrame
    const mockFrame = new MockVideoFrame({
      timestamp: chunk.timestamp,
      duration: 33333,
    });
    this.outputCallback(mockFrame as unknown as VideoFrame);
  }

  async flush(): Promise<void> {
    return Promise.resolve();
  }

  close(): void {
    this.state = 'closed';
  }
}

export class MockVideoEncoder {
  state: 'unconfigured' | 'configured' | 'closed' = 'unconfigured';
  private outputCallback: (chunk: EncodedVideoChunk, metadata?: EncodedVideoChunkMetadata) => void;
  private errorCallback: (error: Error) => void;

  constructor(init: VideoEncoderInit) {
    this.outputCallback = init.output;
    this.errorCallback = init.error;
  }

  configure(config: VideoEncoderConfig): void {
    this.state = 'configured';
  }

  encode(frame: VideoFrame, options?: VideoEncoderEncodeOptions): void {
    const mockChunk = new MockEncodedVideoChunk({
      type: 'key',
      timestamp: frame.timestamp,
      duration: frame.duration || 33333,
      data: new ArrayBuffer(1024),
    });
    this.outputCallback(mockChunk as unknown as EncodedVideoChunk, {});
  }

  async flush(): Promise<void> {
    return Promise.resolve();
  }

  close(): void {
    this.state = 'closed';
  }

  static isConfigSupported(config: VideoEncoderConfig): Promise<VideoEncoderSupport> {
    return Promise.resolve({
      supported: true,
      config: config,
    });
  }
}

export class MockVideoFrame {
  timestamp: number;
  duration: number | null;
  codedWidth: number = 1920;
  codedHeight: number = 1080;
  displayWidth: number = 1920;
  displayHeight: number = 1080;
  format: VideoPixelFormat | null = 'I420';

  constructor(init: { timestamp: number; duration?: number }) {
    this.timestamp = init.timestamp;
    this.duration = init.duration || null;
  }

  close(): void {
    // Cleanup
  }

  clone(): VideoFrame {
    return new MockVideoFrame({
      timestamp: this.timestamp,
      duration: this.duration || undefined,
    }) as unknown as VideoFrame;
  }
}

export class MockEncodedVideoChunk {
  type: 'key' | 'delta';
  timestamp: number;
  duration: number | null;
  byteLength: number;
  private data: ArrayBuffer;

  constructor(init: EncodedVideoChunkInit) {
    this.type = init.type;
    this.timestamp = init.timestamp;
    this.duration = init.duration || null;
    this.data = init.data as ArrayBuffer;
    this.byteLength = this.data.byteLength;
  }

  copyTo(destination: BufferSource): void {
    const dest = new Uint8Array(destination as ArrayBuffer);
    const src = new Uint8Array(this.data);
    dest.set(src);
  }
}

export class MockAudioDecoder {
  state: 'unconfigured' | 'configured' | 'closed' = 'unconfigured';
  private outputCallback: (data: AudioData) => void;
  private errorCallback: (error: Error) => void;

  constructor(init: AudioDecoderInit) {
    this.outputCallback = init.output;
    this.errorCallback = init.error;
  }

  configure(config: AudioDecoderConfig): void {
    this.state = 'configured';
  }

  decode(chunk: EncodedAudioChunk): void {
    // Simulate audio decoding
  }

  async flush(): Promise<void> {
    return Promise.resolve();
  }

  close(): void {
    this.state = 'closed';
  }
}

export class MockAudioEncoder {
  state: 'unconfigured' | 'configured' | 'closed' = 'unconfigured';
  private outputCallback: (chunk: EncodedAudioChunk, metadata?: EncodedAudioChunkMetadata) => void;
  private errorCallback: (error: Error) => void;

  constructor(init: AudioEncoderInit) {
    this.outputCallback = init.output;
    this.errorCallback = init.error;
  }

  configure(config: AudioEncoderConfig): void {
    this.state = 'configured';
  }

  encode(data: AudioData): void {
    // Simulate audio encoding
  }

  async flush(): Promise<void> {
    return Promise.resolve();
  }

  close(): void {
    this.state = 'closed';
  }

  static isConfigSupported(config: AudioEncoderConfig): Promise<AudioEncoderSupport> {
    return Promise.resolve({
      supported: true,
      config: config,
    });
  }
}