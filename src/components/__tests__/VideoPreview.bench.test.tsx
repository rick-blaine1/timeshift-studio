import { describe, bench } from 'vitest';
import { render } from '@testing-library/react';
import { VideoPreview } from '@/components/editor/VideoPreview';
import { sampleFiles } from '@/data/sampleData';
import { TimelineClipSchema } from '@/types/schema/Timeline';
import { PreviewQuality } from '@/types/editor';

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

describe('Video Preview Rendering Benchmarks', () => {
  const clips = createSampleClips(5);
  const totalDuration = clips.reduce((sum, clip) => sum + clip.duration, 0);
  const outputDuration = totalDuration / 2;
  
  const props = {
    timeline: clips,
    files: sampleFiles,
    currentTime: 0,
    isPlaying: false,
    speedMultiplier: 2,
    previewQuality: 'proxy' as PreviewQuality,
    totalDuration,
    outputDuration,
    onTimeChange: () => {},
    onTogglePlayback: () => {},
  };

  bench('render VideoPreview - empty timeline', () => {
    render(<VideoPreview {...props} timeline={[]} />);
  }, {
    iterations: 20,
    warmupIterations: 5
  });

  bench('render VideoPreview - 5 clips', () => {
    render(<VideoPreview {...props} />);
  }, {
    iterations: 20,
    warmupIterations: 5
  });

  bench('render VideoPreview - playing state', () => {
    render(<VideoPreview {...props} isPlaying={true} />);
  }, {
    iterations: 20,
    warmupIterations: 5
  });
});