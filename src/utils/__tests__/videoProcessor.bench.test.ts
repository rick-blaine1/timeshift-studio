import { describe, bench } from 'vitest';
import { concatenateVideos } from '@/utils/videoProcessor';
import { sampleFiles } from '@/data/sampleData';
import { performanceMonitor } from '@/utils/performanceMonitor';
import { TimelineClipSchema } from '@/types/schema/Timeline';
import { VideoFileSchema } from '@/types/schema/VideoFile';

// Create sample clips based on sample files
function createSampleClips(count: number): TimelineClipSchema[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `clip-${i}`,
    fileId: sampleFiles[i % sampleFiles.length].id,
    startTime: 0,
    duration: sampleFiles[i % sampleFiles.length].duration,
    order: i,
    trimStart: 0,
    trimEnd: sampleFiles[i % sampleFiles.length].duration,
    speedMultiplier: 1,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }));
}

describe('Video Processing Pipeline Benchmarks', () => {
  const clips = createSampleClips(5);
  
  bench('concatenateVideos - 5 clips', async () => {
    const sessionId = performanceMonitor.startVideoProcessing(clips.length, clips.reduce((sum, clip) => sum + clip.duration, 0));
    
    await concatenateVideos(clips, sampleFiles, {
      speedMultiplier: 2,
      quality: 'medium',
      format: 'mp4',
      maxMemoryUsage: 500
    });
    
    performanceMonitor.endVideoProcessing(sessionId);
  }, {
    iterations: 10,
    warmupIterations: 2,
    setup: () => performanceMonitor.reset(),
    teardown: () => performanceMonitor.logResults()
  });

  bench('concatenateVideos - 20 clips', async () => {
    const manyClips = createSampleClips(20);
    const sessionId = performanceMonitor.startVideoProcessing(manyClips.length, manyClips.reduce((sum, clip) => sum + clip.duration, 0));
    
    await concatenateVideos(manyClips, sampleFiles, {
      speedMultiplier: 2,
      quality: 'medium',
      format: 'mp4',
      maxMemoryUsage: 500
    });
    
    performanceMonitor.endVideoProcessing(sessionId);
  }, {
    iterations: 5,
    warmupIterations: 1,
    setup: () => performanceMonitor.reset(),
    teardown: () => performanceMonitor.logResults()
  });
});