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

    video.onloadedmetadata = () => {
      window.URL.revokeObjectURL(video.src);

      const metadata: Partial<VideoFileSchema> = {
        duration: video.duration,
        width: video.videoWidth,
        height: video.videoHeight,
        // Framerate, bitrate, and codec are not directly available via HTMLMediaElement properties.
        // For these, more advanced libraries like FFmpeg.wasm or MediaInfo.js would be needed.
        // For now, only provide what's directly available.
      };
      resolve(metadata);
    };

    video.onerror = (e: Event) => { // Cast 'e' to Event type
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