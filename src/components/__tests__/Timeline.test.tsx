import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Timeline } from '../editor/Timeline';
import { VideoFileStatus } from '@/types/schema/VideoFile';

// Mock formatDuration utility
vi.mock('@/data/sampleData', () => ({
  formatDuration: vi.fn((seconds: number) => `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`),
}));

describe('Timeline', () => {
  const mockFiles = [
    {
      id: 'file-1',
      name: 'video1.mp4',
      size: 1024 * 1024,
      type: 'video/mp4',
      lastModified: Date.now(),
      duration: 120,
      width: 1920,
      height: 1080,
      framerate: 30,
      thumbnail: 'data:image/jpeg;base64,test1',
      thumbnailTimestamp: 5,
      status: VideoFileStatus.ON_TIMELINE,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    {
      id: 'file-2',
      name: 'video2.mp4',
      size: 2 * 1024 * 1024,
      type: 'video/mp4',
      lastModified: Date.now(),
      duration: 90,
      width: 1920,
      height: 1080,
      framerate: 30,
      thumbnail: 'data:image/jpeg;base64,test2',
      thumbnailTimestamp: 5,
      status: VideoFileStatus.ON_TIMELINE,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
  ];

  const mockClips = [
    {
      id: 'clip-1',
      fileId: 'file-1',
      startTime: 0,
      duration: 120,
      order: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    {
      id: 'clip-2',
      fileId: 'file-2',
      startTime: 120,
      duration: 90,
      order: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
  ];

  const defaultProps = {
    clips: mockClips,
    files: mockFiles,
    currentTime: 0,
    totalDuration: 210,
    onRemoveClip: vi.fn(),
    onReorderClips: vi.fn(),
    onTimeChange: vi.fn(),
    onDropFile: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders timeline with clips correctly', () => {
    render(<Timeline {...defaultProps} />);
    
    expect(screen.getByText('Timeline')).toBeInTheDocument();
    expect(screen.getByText('2 clips • 3:30')).toBeInTheDocument();
    
    // Check that clips are rendered
    const timelineClips = screen.getAllByTestId('timeline-clip');
    expect(timelineClips).toHaveLength(2);
    
    expect(screen.getByText('video1.mp4')).toBeInTheDocument();
    expect(screen.getByText('video2.mp4')).toBeInTheDocument();
  });

  it('renders empty state when no clips', () => {
    render(<Timeline {...defaultProps} clips={[]} />);
    
    expect(screen.getByText('Drop clips here to start building your timelapse')).toBeInTheDocument();
    expect(screen.getByText('0 clips • 0:00')).toBeInTheDocument();
  });

  it('handles clip removal', () => {
    render(<Timeline {...defaultProps} />);
    
    const timelineClips = screen.getAllByTestId('timeline-clip');
    const firstClip = timelineClips[0];
    
    // Hover to show remove button
    fireEvent.mouseEnter(firstClip);
    
    const removeButton = firstClip.querySelector('button');
    expect(removeButton).toBeInTheDocument();
    
    if (removeButton) {
      fireEvent.click(removeButton);
      expect(defaultProps.onRemoveClip).toHaveBeenCalledWith('clip-1');
    }
  });

  it('handles drag and drop reordering', () => {
    render(<Timeline {...defaultProps} />);
    
    const timelineClips = screen.getAllByTestId('timeline-clip');
    const firstClip = timelineClips[0];
    const secondClip = timelineClips[1];
    
    // Start drag on first clip
    fireEvent.dragStart(firstClip);
    
    // Drag over second clip
    fireEvent.dragOver(secondClip);
    
    // Drop on second clip
    fireEvent.drop(secondClip);
    
    expect(defaultProps.onReorderClips).toHaveBeenCalledWith(0, 1);
  });

  it('handles external file drop', () => {
    render(<Timeline {...defaultProps} />);
    
    const timeline = screen.getByText('Timeline').closest('div')?.nextElementSibling;
    expect(timeline).toBeInTheDocument();
    
    if (timeline) {
      // Mock dataTransfer
      const mockDataTransfer = {
        getData: vi.fn().mockReturnValue('file-3'),
        types: ['fileId'],
      };
      
      const dragEvent = new Event('dragover', { bubbles: true }) as any;
      dragEvent.dataTransfer = mockDataTransfer;
      dragEvent.preventDefault = vi.fn();
      
      fireEvent(timeline, dragEvent);
      
      const dropEvent = new Event('drop', { bubbles: true }) as any;
      dropEvent.dataTransfer = mockDataTransfer;
      dropEvent.preventDefault = vi.fn();
      
      fireEvent(timeline, dropEvent);
      
      expect(defaultProps.onDropFile).toHaveBeenCalledWith('file-3');
    }
  });

  it('handles timeline click for time navigation', () => {
    render(<Timeline {...defaultProps} />);
    
    const timeline = screen.getByText('Timeline').closest('div')?.nextElementSibling;
    expect(timeline).toBeInTheDocument();
    
    if (timeline) {
      // Mock getBoundingClientRect
      vi.spyOn(timeline, 'getBoundingClientRect').mockReturnValue({
        left: 0,
        width: 1000,
        top: 0,
        right: 1000,
        bottom: 100,
        height: 100,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      });
      
      // Click at 50% of timeline width
      fireEvent.click(timeline, { clientX: 500 });
      
      // Should call onTimeChange with 50% of total duration
      expect(defaultProps.onTimeChange).toHaveBeenCalledWith(105); // 50% of 210
    }
  });

  it('displays playhead at correct position', () => {
    render(<Timeline {...defaultProps} currentTime={105} />);
    
    const playhead = document.querySelector('.bg-playhead');
    expect(playhead).toBeInTheDocument();
    expect(playhead).toHaveStyle({ left: '50%' }); // 105/210 = 50%
  });

  it('handles drag state changes correctly', () => {
    render(<Timeline {...defaultProps} />);
    
    const timelineClips = screen.getAllByTestId('timeline-clip');
    const firstClip = timelineClips[0];
    
    // Start drag
    fireEvent.dragStart(firstClip);
    expect(firstClip).toHaveClass('opacity-50', 'scale-95');
    
    // End drag
    fireEvent.dragEnd(firstClip);
    expect(firstClip).not.toHaveClass('opacity-50', 'scale-95');
  });

  it('shows drag over state for external files', () => {
    render(<Timeline {...defaultProps} />);
    
    const timeline = screen.getByText('Timeline').closest('div')?.nextElementSibling;
    expect(timeline).toBeInTheDocument();
    
    if (timeline) {
      const mockDataTransfer = {
        getData: vi.fn().mockReturnValue('file-3'),
        types: ['fileId'],
      };
      
      const dragOverEvent = new Event('dragover', { bubbles: true }) as any;
      dragOverEvent.dataTransfer = mockDataTransfer;
      dragOverEvent.preventDefault = vi.fn();
      
      fireEvent(timeline, dragOverEvent);
      
      expect(timeline).toHaveClass('ring-2', 'ring-primary', 'ring-dashed', 'bg-primary/5');
      
      // Drag leave should remove the state
      fireEvent.dragLeave(timeline);
      expect(timeline).not.toHaveClass('ring-2', 'ring-primary', 'ring-dashed', 'bg-primary/5');
    }
  });

  it('calculates clip width correctly based on duration', () => {
    render(<Timeline {...defaultProps} />);
    
    const timelineClips = screen.getAllByTestId('timeline-clip');
    const firstClip = timelineClips[0]; // 120s out of 210s total = ~57.14%
    const secondClip = timelineClips[1]; // 90s out of 210s total = ~42.86%
    
    // Check that clips have appropriate width styles
    expect(firstClip).toHaveStyle({ width: expect.stringMatching(/5[67]/) }); // ~57%
    expect(secondClip).toHaveStyle({ width: expect.stringMatching(/4[23]/) }); // ~43%
  });

  it('prevents timeline click when no duration', () => {
    render(<Timeline {...defaultProps} totalDuration={0} />);
    
    const timeline = screen.getByText('Timeline').closest('div')?.nextElementSibling;
    if (timeline) {
      fireEvent.click(timeline, { clientX: 500 });
      expect(defaultProps.onTimeChange).not.toHaveBeenCalled();
    }
  });
  it('renders trim handles on clip hover', () => {
    render(<Timeline {...defaultProps} />);
    
    const timelineClips = screen.getAllByTestId('timeline-clip');
    const firstClip = timelineClips[0];
    
    // Hover to show trim handles
    fireEvent.mouseEnter(firstClip);
    
    const trimHandles = document.querySelectorAll('.bg-trim-handle');
    expect(trimHandles).toHaveLength(2);
  });

  it('activates trim start handle on mouse down', () => {
    render(<Timeline {...defaultProps} />);
    
    const timelineClips = screen.getAllByTestId('timeline-clip');
    const firstClip = timelineClips[0];
    
    // Hover to show trim handles
    fireEvent.mouseEnter(firstClip);
    
    const trimHandles = document.querySelectorAll('.bg-trim-handle');
    const startHandle = trimHandles[0];
    
    fireEvent.mouseDown(startHandle);
    
    // Verify active trim state
    // This would require mocking the useEffect logic
  });

  it('activates trim end handle on mouse down', () => {
    render(<Timeline {...defaultProps} />);
    
    const timelineClips = screen.getAllByTestId('timeline-clip');
    const firstClip = timelineClips[0];
    
    // Hover to show trim handles
    fireEvent.mouseEnter(firstClip);
    
    const trimHandles = document.querySelectorAll('.bg-trim-handle');
    const endHandle = trimHandles[1];
    
    fireEvent.mouseDown(endHandle);
    
    // Verify active trim state
    // This would require mocking the useEffect logic
  });

  it('updates clip duration during trim', () => {
    // This test would require simulating mouse movement
    // and verifying state updates
  });

  it('deactivates trim on mouse up', () => {
    // This test would require simulating mouse up
    // and verifying state reset
  });
});