import { TimelineClipSchema } from '@/types/schema/Timeline';
import { VideoFileSchema } from '@/types/schema/VideoFile';

self.onmessage = async (e) => {
  const { clip, file, canvasWidth, canvasHeight, speedMultiplier } = e.data;
  
  try {
    const startTime = clip.trimStart || 0;
    const endTime = clip.trimEnd || file.duration;
    const clipDuration = endTime - startTime;
    
    if (clipDuration <= 0) {
      throw new Error('Invalid clip duration');
    }
    
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.crossOrigin = 'anonymous';
    
    let videoUrl: string | null = null;
    
    if (file.fileHandle) {
      const fileData = await file.fileHandle.getFile();
      videoUrl = URL.createObjectURL(fileData);
    } else if (file.indexedDBKey) {
      const { storageService } = await import('@/services/storage');
      const blob = await storageService.loadVideoFile(file.id);
      videoUrl = URL.createObjectURL(blob);
    } else {
      throw new Error('No video file source available');
    }
    
    video.src = videoUrl;
    await new Promise((resolve) => {
      video.onloadedmetadata = resolve;
    });
    
    video.currentTime = startTime;
    
    const frameCount = Math.floor((clipDuration / speedMultiplier) * 30);
    const frameInterval = (clipDuration * 1000) / frameCount;
    
    const canvas = new OffscreenCanvas(canvasWidth, canvasHeight);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get canvas context');
    
    await new Promise<void>((resolve) => {
      let framesProcessed = 0;
      
      const processFrame = async () => {
        if (framesProcessed >= frameCount) {
          if (videoUrl) URL.revokeObjectURL(videoUrl);
          resolve();
          return;
        }
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const bitmap = await createImageBitmap(canvas);
        
        self.postMessage({
          type: 'frame',
          bitmap,
          frameIndex: framesProcessed
        }, [bitmap]);
        
        framesProcessed++;
        video.currentTime = startTime + (framesProcessed * clipDuration / frameCount);
        
        setTimeout(processFrame, frameInterval);
      };
      
      video.onseeked = processFrame;
    });
    
    self.postMessage({ type: 'complete' });
  } catch (error) {
    self.postMessage({ 
      type: 'error', 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
};