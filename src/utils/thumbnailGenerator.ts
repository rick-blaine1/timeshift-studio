/**
 * Generates a thumbnail from a video file at a specific timestamp
 * @param file The video File object
 * @param timestampSeconds The timestamp in seconds to extract the thumbnail from
 * @returns A Promise that resolves with a base64 encoded thumbnail image
 */
export function generateThumbnail(file: File, timestampSeconds: number = 5): Promise<string> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      reject(new Error('Could not get canvas 2D context'));
      return;
    }

    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    video.autoplay = false;

    video.onloadedmetadata = () => {
      // Set canvas dimensions to match video
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      // Seek to the desired timestamp
      video.currentTime = Math.min(timestampSeconds, video.duration);
    };

    video.onseeked = () => {
      try {
        // Draw the current frame to canvas
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Convert canvas to base64 image
        const thumbnail = canvas.toDataURL('image/jpeg', 0.8);
        
        // Clean up
        window.URL.revokeObjectURL(video.src);
        
        resolve(thumbnail);
      } catch (error) {
        window.URL.revokeObjectURL(video.src);
        reject(new Error(`Failed to generate thumbnail: ${error instanceof Error ? error.message : 'Unknown error'}`));
      }
    };

    video.onerror = (e: Event) => {
      window.URL.revokeObjectURL(video.src);
      const errorMessage = (e.target as HTMLVideoElement)?.error?.message || 'Unknown error';
      reject(new Error(`Failed to load video for thumbnail: ${errorMessage}`));
    };

    // Set video source and load
    video.src = window.URL.createObjectURL(file);
    video.load();
  });
}

/**
 * Generates multiple thumbnails from a video file at different timestamps
 * @param file The video File object
 * @param count Number of thumbnails to generate
 * @returns A Promise that resolves with an array of base64 encoded thumbnail images
 */
export async function generateMultipleThumbnails(file: File, count: number = 3): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      reject(new Error('Could not get canvas 2D context'));
      return;
    }

    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    video.autoplay = false;

    const thumbnails: string[] = [];
    let currentIndex = 0;

    video.onloadedmetadata = () => {
      // Set canvas dimensions to match video
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      // Calculate timestamps for thumbnails
      const duration = video.duration;
      const interval = duration / (count + 1);
      
      // Start with the first thumbnail
      video.currentTime = interval;
    };

    video.onseeked = () => {
      try {
        // Draw the current frame to canvas
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Convert canvas to base64 image
        const thumbnail = canvas.toDataURL('image/jpeg', 0.8);
        thumbnails.push(thumbnail);
        
        currentIndex++;
        
        if (currentIndex < count) {
          // Seek to next timestamp
          const duration = video.duration;
          const interval = duration / (count + 1);
          video.currentTime = interval * (currentIndex + 1);
        } else {
          // All thumbnails generated
          window.URL.revokeObjectURL(video.src);
          resolve(thumbnails);
        }
      } catch (error) {
        window.URL.revokeObjectURL(video.src);
        reject(new Error(`Failed to generate thumbnail: ${error instanceof Error ? error.message : 'Unknown error'}`));
      }
    };

    video.onerror = (e: Event) => {
      window.URL.revokeObjectURL(video.src);
      const errorMessage = (e.target as HTMLVideoElement)?.error?.message || 'Unknown error';
      reject(new Error(`Failed to load video for thumbnails: ${errorMessage}`));
    };

    // Set video source and load
    video.src = window.URL.createObjectURL(file);
    video.load();
  });
}