import { VideoFileSchema } from '@/types/schema/VideoFile';

/**
 * Extracts video metadata from a File object using a temporary video element.
 * @param file The video File object.
 * @returns A Promise that resolves with an object containing extracted metadata.
 */
export function extractVideoMetadata(file: File): Promise<Partial<VideoFileSchema>> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true; // Mute to avoid sound playing
    video.playsInline = true; // Prevent fullscreen on iOS
    video.autoplay = false; // Do not autoplay

    const timeoutId = setTimeout(() => {
      window.URL.revokeObjectURL(video.src);
      reject(new Error('Video metadata extraction timed out'));
    }, 10000); // 10 seconds timeout

    video.onloadedmetadata = () => {
      clearTimeout(timeoutId);
      window.URL.revokeObjectURL(video.src);

      // Validate metadata values - ensure they're positive numbers
      const duration = video.duration > 0 ? video.duration : 0;
      const width = video.videoWidth > 0 ? video.videoWidth : 0;
      const height = video.videoHeight > 0 ? video.videoHeight : 0;

      const metadata: Partial<VideoFileSchema> = {
        duration,
        width,
        height,
        // Framerate, bitrate, and codec are not directly available via HTMLMediaElement properties.
        // For these, more advanced libraries like FFmpeg.wasm or MediaInfo.js would be needed.
        // For now, only provide what's directly available.
      };
      resolve(metadata);
    };

    video.onerror = (e: Event) => { // Cast 'e' to Event type
      clearTimeout(timeoutId);
      window.URL.revokeObjectURL(video.src);
      // Safely access target and error message
      reject(new Error(`Failed to load video metadata: ${(e.target as HTMLVideoElement)?.error?.message || 'Unknown error'}`));
    };

    video.src = window.URL.createObjectURL(file);
    video.load();
  });
}

/**
 * Placeholder for more advanced metadata extraction (e.g., using FFmpeg.wasm) if needed in the future.
 */
export async function getDetailedVideoMetadata(file: File): Promise<Partial<VideoFileSchema>> {
  // This function would integrate FFmpeg.wasm or similar for detailed metadata.
  // For now, it returns basic metadata.
  return extractVideoMetadata(file);
}