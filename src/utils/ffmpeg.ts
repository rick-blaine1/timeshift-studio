import { createFFmpeg, fetchFile } from '@ffmpeg/ffmpeg';
import { VideoProcessingError, ErrorCodes } from './errorHandling';

let ffmpegInstance: any = null;
let currentOnProgress: ((progress: number) => void) | undefined;

/**
 * Initialize FFmpeg.wasm instance
 */
export async function initFFmpeg(): Promise<any> {
  console.log('[FFmpeg] ========================================');
  console.log('[FFmpeg] initFFmpeg called');
  console.log('[FFmpeg] Existing instance:', !!ffmpegInstance);
  console.log('[FFmpeg] FFmpeg version:', '@ffmpeg/ffmpeg@0.11.6');
  console.log('[FFmpeg] @ffmpeg/core version:', '@ffmpeg/core@0.11.0');
  
  if (ffmpegInstance) {
    console.log('[FFmpeg] Returning cached instance');
    return ffmpegInstance;
  }

  try {
    // Check if SharedArrayBuffer is available
    console.log('[FFmpeg] Checking SharedArrayBuffer availability...');
    if (typeof SharedArrayBuffer === 'undefined') {
      console.error('[FFmpeg] ❌ SharedArrayBuffer is NOT available');
      console.error('[FFmpeg] Cross-origin isolation headers may be missing');
      console.error('[FFmpeg] Required headers:');
      console.error('[FFmpeg]   - Cross-Origin-Opener-Policy: same-origin');
      console.error('[FFmpeg]   - Cross-Origin-Embedder-Policy: require-corp OR credentialless');
      throw new Error('SharedArrayBuffer is not available. Cross-origin isolation headers may be missing.');
    }
    console.log('[FFmpeg] ✓ SharedArrayBuffer is available');
    
    // Check cross-origin isolation status
    console.log('[FFmpeg] Checking cross-origin isolation...');
    console.log('[FFmpeg] crossOriginIsolated:', self.crossOriginIsolated);
    if (!self.crossOriginIsolated) {
      console.warn('[FFmpeg] ⚠️ crossOriginIsolated is false - this may cause issues');
    } else {
      console.log('[FFmpeg] ✓ crossOriginIsolated is true');
    }
    
    console.log('[FFmpeg] Creating new FFmpeg instance...');
    const ffmpeg = createFFmpeg({
      log: true,
      corePath: 'https://unpkg.com/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js',
      progress: ({ ratio }) => {
        console.log('[FFmpeg Progress]', { progress: ratio });
        if (currentOnProgress) {
          const progressPercent = Math.min(Math.max(ratio * 100, 0), 100);
          currentOnProgress(progressPercent);
        }
      },
    });
    console.log('[FFmpeg] ✓ FFmpeg instance created');
    console.log('[FFmpeg] Instance type:', typeof ffmpeg);
    console.log('[FFmpeg] Instance methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(ffmpeg)));
    
    console.log('[FFmpeg] ========================================');
    console.log('[FFmpeg] Starting FFmpeg.wasm load...');
    console.log('[FFmpeg] Using CDN files (0.11.x compatible)');
    console.log('[FFmpeg] Expected files from unpkg.com:');
    console.log('[FFmpeg]   - @ffmpeg/core@0.11.0/dist/ffmpeg-core.js');
    console.log('[FFmpeg]   - @ffmpeg/core@0.11.0/dist/ffmpeg-core.wasm');
    console.log('[FFmpeg]   - @ffmpeg/core@0.11.0/dist/ffmpeg-core.worker.js');
    console.log('[FFmpeg] This may take 10-30 seconds on first load...');
    console.log('[FFmpeg] ========================================');
    
    try {
      const startTime = Date.now();
      console.log('[FFmpeg] Calling ffmpeg.load() at', new Date().toISOString());
      console.log('[FFmpeg] Note: corePath was set in createFFmpeg() options');
      
      const loadPromise = ffmpeg.load();
      console.log('[FFmpeg] load() promise created, waiting for resolution...');
      
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          const elapsed = Date.now() - startTime;
          console.error('[FFmpeg] ❌ Timeout reached after 120 seconds');
          console.error('[FFmpeg] Elapsed time:', elapsed, 'ms');
          reject(new Error('FFmpeg load timeout after 120 seconds'));
        }, 120000);
      });
      
      await Promise.race([loadPromise, timeoutPromise]);
      
      const elapsed = Date.now() - startTime;
      console.log('[FFmpeg] ========================================');
      console.log('[FFmpeg] ✓ FFmpeg core loaded successfully!');
      console.log('[FFmpeg] Load time:', elapsed, 'ms');
      console.log('[FFmpeg] ========================================');
    } catch (loadError) {
      console.error('[FFmpeg] ========================================');
      console.error('[FFmpeg] ❌ Load error occurred');
      console.error('[FFmpeg] Error type:', loadError?.constructor?.name);
      console.error('[FFmpeg] Error message:', (loadError as Error)?.message);
      console.error('[FFmpeg] Error stack:', (loadError as Error)?.stack);
      console.error('[FFmpeg] Full error object:', loadError);
      console.error('[FFmpeg] ========================================');
      throw loadError;
    }
    ffmpegInstance = ffmpeg;
    return ffmpeg;
  } catch (error) {
    console.error('[FFmpeg] ========================================');
    console.error('[FFmpeg] ❌ Initialization failed');
    console.error('[FFmpeg] Error:', error);
    console.error('[FFmpeg] ========================================');
    throw new VideoProcessingError(
      'FFmpeg initialization failed',
      ErrorCodes.FFMPEG_INIT_FAILED,
      error
    );
  }
}

/**
 * Trim video to specified time range with optional speed adjustment
 */
export async function trimVideo(
  input: File | Blob,
  start: number,
  end: number,
  speedMultiplier: number = 1,
  outputName: string = 'output.mp4',
  onProgress?: (progress: number) => void
): Promise<Blob> {
  const ffmpeg = await initFFmpeg();
  const inputName = 'input.mp4';

  console.log('[FFmpeg] Starting trim operation');

  try {
    const arrayBuffer = await input.arrayBuffer();
    ffmpeg.FS('writeFile', inputName, new Uint8Array(arrayBuffer));
    
    const command = [
      '-i', inputName,
      '-ss', start.toString(),
      '-to', end.toString(),
    ];

    // Apply speed adjustment if needed
    if (speedMultiplier !== 1) {
      const videoSpeed = 1 / speedMultiplier;
      command.push(
        '-filter:v', `setpts=${videoSpeed}*PTS`,
        '-an', // Remove audio for speed changes
        '-c:v', 'libx264',
        '-pix_fmt', 'yuv420p', // Convert to 8-bit for High profile compatibility
        '-profile:v', 'high',
        '-level', '4.1',
        '-preset', 'medium',
        '-crf', '23'
      );
    } else {
      command.push('-c', 'copy');
    }

    command.push(outputName);

    console.log('[FFmpeg] Executing trim command:', command.join(' '));
    
    currentOnProgress = onProgress;
    await ffmpeg.run(...command);
    currentOnProgress = undefined;
    
    console.log('[FFmpeg] Trim complete');
    const data = ffmpeg.FS('readFile', outputName);
    return new Blob([data.buffer], { type: 'video/mp4' });
  } catch (error) {
    throw new VideoProcessingError(
      'Video trimming failed',
      ErrorCodes.TRIM_FAILED,
      error
    );
  } finally {
    try {
      ffmpeg.FS('unlink', inputName);
    } catch (e) {
      console.warn('[FFmpeg] Failed to delete', inputName, e);
    }
    try {
      ffmpeg.FS('unlink', outputName);
    } catch (e) {
      console.warn('[FFmpeg] Failed to delete', outputName, e);
    }
  }
}

/**
 * Concatenate multiple videos with speed adjustment and audio removal
 */
export async function concatVideos(
  inputs: (File | Blob)[],
  speedMultiplier: number = 1,
  outputName: string = 'output.mp4',
  onProgress?: (progress: number) => void
): Promise<Blob> {
  const ffmpeg = await initFFmpeg();
  const concatFile = 'filelist.txt';
  const fileNames: string[] = [];
  
  console.log('[FFmpeg] Starting concatenation of', inputs.length, 'videos');
  
  try {
    // Write input files
    for (let i = 0; i < inputs.length; i++) {
      const fileName = `input${i}.mp4`;
      const arrayBuffer = await inputs[i].arrayBuffer();
      ffmpeg.FS('writeFile', fileName, new Uint8Array(arrayBuffer));
      fileNames.push(fileName);
    }

    // Create concat file
    const fileListContent = fileNames.map(name => `file '${name}'`).join('\n');
    ffmpeg.FS('writeFile', concatFile, fileListContent);

    const command = [
      '-f', 'concat',
      '-safe', '0',
      '-i', concatFile,
    ];

    // Apply speed adjustment and remove audio for timelapse
    if (speedMultiplier !== 1) {
      const videoSpeed = 1 / speedMultiplier;
      command.push(
        '-filter:v', `setpts=${videoSpeed}*PTS`,
        '-an', // Remove audio
        '-c:v', 'libx264',
        '-pix_fmt', 'yuv420p', // Convert to 8-bit for High profile compatibility
        '-profile:v', 'high',
        '-level', '4.1',
        '-preset', 'medium',
        '-crf', '23'
      );
    } else {
      // Even at 1x speed, remove audio for timelapse consistency
      command.push(
        '-an',
        '-c:v', 'copy'
      );
    }

    command.push(outputName);

    console.log('[FFmpeg] Executing concat command:', command.join(' '));
    
    currentOnProgress = onProgress;
    await ffmpeg.run(...command);
    currentOnProgress = undefined;
    
    console.log('[FFmpeg] Concatenation complete');

    const data = ffmpeg.FS('readFile', outputName);
    return new Blob([data.buffer], { type: 'video/mp4' });
  } catch (error) {
    throw new VideoProcessingError(
      'Video concatenation failed',
      ErrorCodes.CONCAT_FAILED,
      error
    );
  } finally {
    // Remove progress listener (FFmpeg.wasm doesn't require explicit cleanup)
    
    // Cleanup
    for (const name of fileNames) {
      try {
        ffmpeg.FS('unlink', name);
      } catch (e) {
        console.warn('[FFmpeg] Failed to delete', name, e);
      }
    }
    try {
      ffmpeg.FS('unlink', concatFile);
    } catch (e) {
      console.warn('[FFmpeg] Failed to delete', concatFile, e);
    }
    try {
      ffmpeg.FS('unlink', outputName);
    } catch (e) {
      console.warn('[FFmpeg] Failed to delete', outputName, e);
    }
  }
}

/**
 * Transcode video to different format/quality with speed adjustment
 */
export async function transcodeVideo(
  input: File | Blob,
  options: {
    format?: 'mp4' | 'webm';
    quality?: 'low' | 'medium' | 'high';
    resolution?: string;
    speedMultiplier?: number;
    removeAudio?: boolean;
    onProgress?: (progress: number) => void;
  },
  outputName: string = 'output'
): Promise<Blob> {
  const ffmpeg = await initFFmpeg();
  const inputName = 'input.mp4';

  console.log('[FFmpeg] Starting transcode operation');

  try {
    const arrayBuffer = await input.arrayBuffer();
    ffmpeg.FS('writeFile', inputName, new Uint8Array(arrayBuffer));
    
    const format = options.format || 'mp4';
    const quality = options.quality || 'medium';
    const resolution = options.resolution || '';
    const speedMultiplier = options.speedMultiplier || 1;
    const removeAudio = options.removeAudio !== false; // Default true

    // Set output format
    const outputExt = format === 'mp4' ? 'mp4' : 'webm';
    const outputFile = `${outputName}.${outputExt}`;

    // Quality presets
    const qualityMap = {
      low: 'ultrafast',
      medium: 'medium',
      high: 'slow'
    };

    // Build command
    const command = ['-i', inputName];

    // Apply speed adjustment if needed
    let filterComplex = '';
    if (speedMultiplier !== 1) {
      const videoSpeed = 1 / speedMultiplier;
      filterComplex = `setpts=${videoSpeed}*PTS`;
    }

    if (resolution) {
      filterComplex = filterComplex
        ? `${filterComplex},scale=${resolution}`
        : `scale=${resolution}`;
    }

    if (filterComplex) {
      command.push('-filter:v', filterComplex);
    }

    // Video codec settings
    if (format === 'mp4') {
      command.push(
        '-c:v', 'libx264',
        '-pix_fmt', 'yuv420p', // Convert to 8-bit for High profile compatibility
        '-profile:v', 'high',
        '-level', '4.1',
        '-preset', qualityMap[quality],
        '-crf', quality === 'low' ? '32' : quality === 'medium' ? '23' : '18'
      );
    } else {
      command.push(
        '-c:v', 'libvpx-vp9',
        '-preset', qualityMap[quality],
        '-crf', quality === 'low' ? '32' : quality === 'medium' ? '23' : '18'
      );
    }

    // Audio handling
    if (removeAudio) {
      command.push('-an');
    } else {
      command.push('-c:a', 'copy');
    }

    command.push(outputFile);

    console.log('[FFmpeg] Executing transcode command:', command.join(' '));
    
    currentOnProgress = options.onProgress;
    await ffmpeg.run(...command);
    currentOnProgress = undefined;
    
    console.log('[FFmpeg] Transcode complete');
    const data = ffmpeg.FS('readFile', outputFile);
    return new Blob([data.buffer], { type: `video/${outputExt}` });
  } catch (error) {
    throw new VideoProcessingError(
      'Video transcoding failed',
      ErrorCodes.TRANSCODE_FAILED,
      error
    );
  } finally {
    try {
      ffmpeg.FS('unlink', inputName);
    } catch (e) {
      console.warn('[FFmpeg] Failed to delete', inputName, e);
    }
    const outputExt = options.format === 'webm' ? 'webm' : 'mp4';
    try {
      ffmpeg.FS('unlink', `${outputName}.${outputExt}`);
    } catch (e) {
      console.warn('[FFmpeg] Failed to delete', `${outputName}.${outputExt}`, e);
    }
  }
}