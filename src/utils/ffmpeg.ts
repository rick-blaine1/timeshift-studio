import { FFmpeg } from '@ffmpeg/ffmpeg';
import { VideoProcessingError, ErrorCodes } from './errorHandling';

let ffmpegInstance: FFmpeg | null = null;

/**
 * Initialize FFmpeg.wasm instance
 */
export async function initFFmpeg(): Promise<FFmpeg> {
  if (ffmpegInstance) return ffmpegInstance;

  try {
    const ffmpeg = new FFmpeg();
    await ffmpeg.load({
      coreURL: 'https://unpkg.com/@ffmpeg/core@0.12.0/dist/ffmpeg-core.js',
      log: process.env.NODE_ENV === 'development',
    });
    ffmpegInstance = ffmpeg;
    return ffmpeg;
  } catch (error) {
    throw new VideoProcessingError(
      'FFmpeg initialization failed',
      ErrorCodes.FFMPEG_INIT_FAILED,
      error
    );
  }
}

/**
 * Trim video to specified time range
 */
export async function trimVideo(
  input: File | Blob,
  start: number,
  end: number,
  outputName: string = 'output.mp4'
): Promise<Blob> {
  const ffmpeg = await initFFmpeg();
  const inputName = 'input.mp4';

  try {
    const arrayBuffer = await input.arrayBuffer();
    await ffmpeg.writeFile(inputName, new Uint8Array(arrayBuffer));
    await ffmpeg.exec([
      '-i', inputName,
      '-ss', start.toString(),
      '-to', end.toString(),
      '-c', 'copy',
      outputName
    ]);
    const data = await ffmpeg.readFile(outputName, 'binary');
    return new Blob([new Uint8Array(data)]);
  } catch (error) {
    throw new VideoProcessingError(
      'Video trimming failed',
      ErrorCodes.TRIM_FAILED,
      error
    );
  } finally {
    await ffmpeg.deleteFile(inputName);
    await ffmpeg.deleteFile(outputName);
  }
}

/**
 * Concatenate multiple videos
 */
export async function concatVideos(
  inputs: (File | Blob)[],
  outputName: string = 'output.mp4'
): Promise<Blob> {
  const ffmpeg = await initFFmpeg();
  const concatFile = 'filelist.txt';
  
  try {
    // Write input files
    const fileNames: string[] = [];
    for (let i = 0; i < inputs.length; i++) {
      const fileName = `input${i}.mp4`;
      const arrayBuffer = await inputs[i].arrayBuffer();
      await ffmpeg.writeFile(fileName, new Uint8Array(arrayBuffer));
      fileNames.push(fileName);
    }

    // Create concat file
    const fileListContent = fileNames.map(name => `file '${name}'`).join('\n');
    await ffmpeg.writeFile(concatFile, fileListContent);

    await ffmpeg.exec([
      '-f', 'concat',
      '-safe', '0',
      '-i', concatFile,
      '-c', 'copy',
      outputName
    ]);

    const data = await ffmpeg.readFile(outputName, 'binary');
    return new Blob([new Uint8Array(data)]);
  } catch (error) {
    throw new VideoProcessingError(
      'Video concatenation failed',
      ErrorCodes.CONCAT_FAILED,
      error
    );
  } finally {
    // Cleanup
    for (const name of fileNames) {
      await ffmpeg.deleteFile(name);
    }
    await ffmpeg.deleteFile(concatFile);
    await ffmpeg.deleteFile(outputName);
  }
}

/**
 * Transcode video to different format/quality
 */
export async function transcodeVideo(
  input: File | Blob,
  options: {
    format?: 'mp4' | 'webm';
    quality?: 'low' | 'medium' | 'high';
    resolution?: string;
  },
  outputName: string = 'output.mp4'
): Promise<Blob> {
  const ffmpeg = await initFFmpeg();
  const inputName = 'input.mp4';

  try {
    const arrayBuffer = await input.arrayBuffer();
    await ffmpeg.writeFile(inputName, new Uint8Array(arrayBuffer));
    
    const format = options.format || 'mp4';
    const quality = options.quality || 'medium';
    const resolution = options.resolution || '';

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
    const command = [
      '-i', inputName,
      '-c:v', format === 'mp4' ? 'libx264' : 'libvpx-vp9',
      '-preset', qualityMap[quality],
      '-crf', quality === 'low' ? '32' : quality === 'medium' ? '23' : '18',
      '-c:a', 'copy'
    ];

    if (resolution) {
      command.push('-vf', `scale=${resolution}`);
    }

    command.push(outputFile);

    await ffmpeg.exec(command);
    const data = await ffmpeg.readFile(outputFile, 'binary');
    return new Blob([new Uint8Array(data)]);
  } catch (error) {
    throw new VideoProcessingError(
      'Video transcoding failed',
      ErrorCodes.TRANSCODE_FAILED,
      error
    );
  } finally {
    await ffmpeg.deleteFile(inputName);
    await ffmpeg.deleteFile(`${outputName}.${outputExt}`);
  }
}