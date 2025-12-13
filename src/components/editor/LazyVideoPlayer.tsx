import React, { useEffect, useRef, useState, useCallback } from 'react';
import { TimelineClip, VideoFile } from '@/types/editor';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { storageService } from '@/services/storage';

interface LazyVideoPlayerProps {
  timeline: TimelineClip[];
  files: VideoFile[];
  currentTime: number;
  isPlaying: boolean;
  speedMultiplier: number;
  previewQuality: 'proxy' | 'high';
  totalDuration: number;
  onTimeChange: (time: number) => void;
  onTogglePlayback: () => void;
  onLoad: () => void;
  onError: (error: string) => void;
}

export default function LazyVideoPlayer({
  timeline,
  files,
  currentTime,
  isPlaying,
  speedMultiplier,
  previewQuality,
  totalDuration,
  onTimeChange,
  onTogglePlayback,
  onLoad,
  onError,
}: LazyVideoPlayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const workerRef = useRef<Worker | null>(null);
  const animationRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);
  const [isWorkerReady, setIsWorkerReady] = useState(false);
  const isInitializedRef = useRef(false);
  
  // Video elements managed in main thread (not in worker!)
  const videoElementsRef = useRef<Map<string, HTMLVideoElement>>(new Map());
  const videoUrlsRef = useRef<Map<string, string>>(new Map());

  // Initialize Web Worker
  useEffect(() => {
    console.log('[LazyVideoPlayer] Initializing worker');
    const worker = new Worker(new URL('../../utils/videoWorker.ts', import.meta.url), {
      type: 'module',
    });

    worker.onmessage = async (event: MessageEvent) => {
      const { type, payload } = event.data;
      console.log('[LazyVideoPlayer] Worker message:', type);
      
      switch (type) {
        case 'worker_ready':
          console.log('[LazyVideoPlayer] Worker is ready');
          isInitializedRef.current = true;
          setIsWorkerReady(true);
          onLoad();
          break;
          
        case 'request_frame':
          // Worker is requesting a frame - we need to provide it from main thread
          console.log('[LazyVideoPlayer] Frame requested for file:', payload.fileId, 'at time:', payload.time);
          await handleFrameRequest(payload);
          break;
          
        case 'frame':
          if (canvasRef.current && payload.bitmap) {
            const ctx = canvasRef.current.getContext('2d');
            if (ctx) {
              const bitmap = payload.bitmap;
              // Resize canvas if needed
              if (
                canvasRef.current.width !== bitmap.width ||
                canvasRef.current.height !== bitmap.height
              ) {
                canvasRef.current.width = bitmap.width;
                canvasRef.current.height = bitmap.height;
              }
              ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
              ctx.drawImage(bitmap, 0, 0);
              bitmap.close();
            }
          }
          break;
          
        case 'error':
          onError(payload.message || 'Unknown worker error');
          console.error('[LazyVideoPlayer] Worker error:', payload);
          break;
      }
    };

    worker.onerror = (error) => {
      onError('Video worker failed to initialize');
      console.error('[LazyVideoPlayer] Worker error:', error);
    };

    workerRef.current = worker;

    return () => {
      console.log('[LazyVideoPlayer] Cleaning up worker, initialized:', isInitializedRef.current);
      if (isInitializedRef.current) {
        worker.postMessage({ type: 'destroy' });
      }
      worker.terminate();
      workerRef.current = null;
      isInitializedRef.current = false;
      
      // Clean up video elements
      videoElementsRef.current.forEach(video => {
        video.pause();
        video.src = '';
      });
      videoElementsRef.current.clear();
      
      videoUrlsRef.current.forEach(url => {
        URL.revokeObjectURL(url);
      });
      videoUrlsRef.current.clear();
    };
  }, []); // Empty dependency array - only initialize once

  // Handle frame requests from worker
  const handleFrameRequest = async (payload: { fileId: string; time: number; canvasWidth: number; canvasHeight: number }) => {
    try {
      const { fileId, time, canvasWidth, canvasHeight } = payload;
      
      // Find the file
      const file = files.find(f => f.id === fileId);
      if (!file) {
        console.error('[LazyVideoPlayer] File not found:', fileId);
        return;
      }

      // Get or create video element
      let videoElement = videoElementsRef.current.get(fileId);
      
      if (!videoElement) {
        console.log('[LazyVideoPlayer] Creating video element for file:', fileId);
        videoElement = document.createElement('video');
        videoElement.muted = true;
        videoElement.playsInline = true;
        videoElement.crossOrigin = 'anonymous';
        
        // Load the video file
        let videoUrl = videoUrlsRef.current.get(fileId);
        if (!videoUrl) {
          if (file.fileHandle) {
            console.log('[LazyVideoPlayer] Loading from fileHandle');
            const fileData = await file.fileHandle.getFile();
            videoUrl = URL.createObjectURL(fileData);
          } else if (file.indexedDBKey) {
            console.log('[LazyVideoPlayer] Loading from IndexedDB');
            const blob = await storageService.loadVideoFile(fileId);
            videoUrl = URL.createObjectURL(blob);
          } else {
            console.error('[LazyVideoPlayer] No video file source available');
            return;
          }
          videoUrlsRef.current.set(fileId, videoUrl);
        }
        
        videoElement.src = videoUrl;
        
        // Wait for metadata to load
        await new Promise<void>((resolve, reject) => {
          videoElement!.onloadedmetadata = () => resolve();
          videoElement!.onerror = () => reject(new Error('Video load failed'));
          setTimeout(() => reject(new Error('Video load timeout')), 10000);
        });
        
        console.log('[LazyVideoPlayer] Video loaded, dimensions:', videoElement.videoWidth, 'x', videoElement.videoHeight);
        videoElementsRef.current.set(fileId, videoElement);
      }

      // Seek to the correct time
      if (Math.abs(videoElement.currentTime - time) > 0.1) {
        videoElement.currentTime = time;
        await new Promise<void>((resolve) => {
          videoElement!.onseeked = () => resolve();
          setTimeout(resolve, 100); // Fallback timeout
        });
      }

      // Create a canvas and draw the frame
      if (videoElement.readyState >= 2) {
        const offscreen = new OffscreenCanvas(canvasWidth, canvasHeight);
        const ctx = offscreen.getContext('2d');
        
        if (ctx) {
          // Calculate aspect ratio and draw centered
          const videoAspect = videoElement.videoWidth / videoElement.videoHeight;
          const canvasAspect = canvasWidth / canvasHeight;
          
          let drawWidth = canvasWidth;
          let drawHeight = canvasHeight;
          let offsetX = 0;
          let offsetY = 0;
          
          if (videoAspect > canvasAspect) {
            drawHeight = canvasWidth / videoAspect;
            offsetY = (canvasHeight - drawHeight) / 2;
          } else {
            drawWidth = canvasHeight * videoAspect;
            offsetX = (canvasWidth - drawWidth) / 2;
          }
          
          ctx.fillStyle = 'black';
          ctx.fillRect(0, 0, canvasWidth, canvasHeight);
          ctx.drawImage(videoElement, offsetX, offsetY, drawWidth, drawHeight);
          
          const bitmap = offscreen.transferToImageBitmap();
          console.log('[LazyVideoPlayer] Sending frame to worker, bitmap size:', bitmap.width, 'x', bitmap.height);
          
          // Send the bitmap back to the worker with transfer list
          if (workerRef.current) {
            workerRef.current.postMessage({
              type: 'provide_frame',
              bitmap: bitmap,
            }, [bitmap]); // Transfer the bitmap instead of cloning
          }
        }
      } else {
        console.warn('[LazyVideoPlayer] Video not ready, readyState:', videoElement.readyState);
      }
    } catch (error) {
      console.error('[LazyVideoPlayer] Error handling frame request:', error);
    }
  };

  // Send timeline and settings to worker when ready
  useEffect(() => {
    console.log('[LazyVideoPlayer] Init preview effect triggered:', {
      isWorkerReady,
      timelineLength: timeline.length,
      filesLength: files.length,
      hasWorker: !!workerRef.current
    });
    
    if (isWorkerReady && workerRef.current && timeline.length > 0 && files.length > 0) {
      console.log('[LazyVideoPlayer] Sending timeline to worker');
      workerRef.current.postMessage({
        type: 'init_preview',
        timeline,
        files,
        previewQuality,
      });
    }
  }, [isWorkerReady, timeline, files, previewQuality]);

  // Playback loop
  const playbackLoop = useCallback(() => {
    if (!canvasRef.current || !isWorkerReady || !workerRef.current || timeline.length === 0) {
      return;
    }

    const now = performance.now();
    const elapsed = (now - startTimeRef.current) / 1000;
    let newTime = currentTime + elapsed * speedMultiplier;

    // Check if we've reached the end
    if (newTime >= totalDuration) {
      newTime = totalDuration;
      onTimeChange(newTime);
      onTogglePlayback(); // Stop playback at end
      return;
    }

    // Update the current time in parent state
    onTimeChange(newTime);

    // Request frame at the new time
    workerRef.current.postMessage({
      type: 'seek',
      time: newTime,
      speed: speedMultiplier,
    });

    // Continue the loop
    animationRef.current = requestAnimationFrame(playbackLoop);
  }, [currentTime, speedMultiplier, totalDuration, isWorkerReady, timeline.length, onTimeChange, onTogglePlayback]);

  // Handle play/pause
  useEffect(() => {
    if (isPlaying && currentTime < totalDuration) {
      startTimeRef.current = performance.now();
      playbackLoop();
    } else {
      cancelAnimationFrame(animationRef.current);
      if (workerRef.current && isWorkerReady) {
        workerRef.current.postMessage({
          type: 'seek',
          time: currentTime,
          speed: speedMultiplier,
        });
      }
    }
    
    return () => {
      cancelAnimationFrame(animationRef.current);
    };
  }, [isPlaying, playbackLoop, currentTime, totalDuration, isWorkerReady, speedMultiplier]);

  // Handle external time changes (scrubbing)
  useEffect(() => {
    if (!isPlaying && isWorkerReady && workerRef.current) {
      cancelAnimationFrame(animationRef.current);
      workerRef.current.postMessage({
        type: 'seek',
        time: currentTime,
        speed: speedMultiplier,
      });
    }
  }, [currentTime, isPlaying, isWorkerReady, speedMultiplier]);

  if (timeline.length === 0) {
    return (
      <div className="text-center text-muted-foreground">
        <p className="text-sm">No clips on timeline</p>
        <p className="text-xs mt-1">Add clips to preview your timelapse</p>
      </div>
    );
  }

  return (
    <>
      <div className="relative w-full aspect-video max-h-full bg-black">
        <canvas
          ref={canvasRef}
          className="w-full h-full object-contain"
          style={{ backgroundColor: 'black' }}
        />

        {/* Play overlay */}
        {!isPlaying && (
          <div className="absolute inset-0 flex items-center justify-center bg-foreground/10">
            <button
              className="rounded-full w-16 h-16 bg-white bg-opacity-20 backdrop-blur-sm flex items-center justify-center shadow-lg"
              onClick={onTogglePlayback}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-8 w-8 ml-1 text-white"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* Quality badge */}
      <Badge
        variant="secondary"
        className={cn(
          'absolute top-3 right-3 text-xs',
          previewQuality === 'proxy' && 'bg-warning/20 text-warning'
        )}
      >
        {previewQuality === 'proxy' ? 'Proxy' : 'High Quality'}
      </Badge>

      {/* Speed indicator */}
      <Badge
        variant="outline"
        className="absolute top-3 left-3 text-xs bg-background/80"
      >
        {speedMultiplier}× speed
      </Badge>
    </>
  );
}