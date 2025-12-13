let timeline: any[] = [];
let files: any[] = [];
let previewQuality: 'proxy' | 'high' = 'high';

let canvasWidth = 960;
let canvasHeight = 540;

let currentPlaybackTime = 0;
let speedMultiplier = 1;

// Send worker_ready immediately when worker starts
console.log('[VideoWorker] Worker initialized, sending ready signal');
self.postMessage({ type: 'worker_ready' });

self.onmessage = async (e) => {
  const { type, timeline: newTimeline, files: newFiles, previewQuality: newQuality, time, speed, bitmap } = e.data;

  console.log('[VideoWorker] Received message:', type, {
    timelineLength: newTimeline?.length,
    filesLength: newFiles?.length,
    time,
    speed
  });

  try {
    switch (type) {
      case 'init_preview':
console.log('[VideoWorker] Initializing preview with:', {
  timeline: newTimeline,
  files: newFiles,
  quality: newQuality
});
console.log('[VideoWorker] newTimeline content:', newTimeline);
console.log('[VideoWorker] newFiles content:', newFiles);
        timeline = newTimeline;
        files = newFiles;
        previewQuality = newQuality;

        if (previewQuality === 'proxy') {
          canvasWidth = 960;
          canvasHeight = 540;
        } else {
          if (files.length > 0) {
            canvasWidth = files[0].width || 1920;
            canvasHeight = files[0].height || 1080;
          }
        }

        console.log('[VideoWorker] Preview initialized, canvas size:', canvasWidth, 'x', canvasHeight);
        break;

      case 'seek':
        currentPlaybackTime = time;
        speedMultiplier = speed || 1;
        console.log('[VideoWorker] Seeking. currentPlaybackTime:', currentPlaybackTime, 'timeline:', timeline);

        // Find the clip at the current playback time
        let clip = null;
        for (const c of timeline) {
          console.log('[VideoWorker] Checking clip:', c.id, 'startTime:', c.startTime, 'duration:', c.duration, 'currentPlaybackTime:', currentPlaybackTime);
          if (currentPlaybackTime >= c.startTime && currentPlaybackTime < c.startTime + c.duration) {
            clip = c;
            break;
          }
        }

        console.log('[VideoWorker] Seeking to time:', currentPlaybackTime, 'Found clip:', clip);
        
        if (!clip) {
          console.log('[VideoWorker] No clip at current time, sending black frame');
          // No clip at this time - send blank frame
          const canvas = new OffscreenCanvas(canvasWidth, canvasHeight);
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.fillStyle = 'black';
            ctx.fillRect(0, 0, canvasWidth, canvasHeight);
            const bitmap = canvas.transferToImageBitmap();
            self.postMessage({ type: 'frame', payload: { bitmap } }, { transfer: [bitmap] });
          }
          return;
        }

        const file = files.find(f => f.id === clip.fileId);
        console.log('[VideoWorker] Looking for file:', clip.fileId, 'Found:', !!file);
        if (!file) {
          console.error('[VideoWorker] File not found for clip:', clip.fileId);
          self.postMessage({ type: 'error', payload: { message: 'File not found for clip' } });
          return;
        }

        // Calculate the local time within the video file
        const localTime = (currentPlaybackTime - clip.startTime) + (clip.trimStart || 0);

        console.log('[VideoWorker] Requesting frame from main thread for file:', file.id, 'at time:', localTime);
        
        // Request the main thread to provide a video frame
        self.postMessage({
          type: 'request_frame',
          payload: {
            fileId: file.id,
            time: localTime,
            canvasWidth,
            canvasHeight,
          }
        });
        break;

      case 'provide_frame':
        // Receive a frame bitmap from the main thread
        console.log('[VideoWorker] Received frame from main thread, bitmap:', !!bitmap, 'size:', bitmap?.width, 'x', bitmap?.height);
        
        if (bitmap) {
          // Forward the bitmap to the canvas with transfer list
          self.postMessage({ type: 'frame', payload: { bitmap } }, { transfer: [bitmap] });
        } else {
          // Send black frame if no bitmap provided
          const canvas = new OffscreenCanvas(canvasWidth, canvasHeight);
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.fillStyle = 'black';
            ctx.fillRect(0, 0, canvasWidth, canvasHeight);
            const emptyBitmap = canvas.transferToImageBitmap();
            self.postMessage({ type: 'frame', payload: { bitmap: emptyBitmap } }, { transfer: [emptyBitmap] });
          }
        }
        break;

      case 'destroy':
        console.log('[VideoWorker] Destroying worker');
        self.close();
        break;
    }
  } catch (error) {
    console.error('[VideoWorker] Top-level error:', error);
    self.postMessage({
      type: 'error',
      payload: { message: error instanceof Error ? error.message : 'Unknown error' },
    });
  }
};