import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { EditorWorkspace } from '@/components/editor/EditorWorkspace';
import { VideoFileStatus } from '@/types/schema/VideoFile';

// Mock all the dependencies
vi.mock('@/services/storage', () => ({
  storageService: {
    saveProject: vi.fn().mockResolvedValue(undefined),
    loadProject: vi.fn().mockResolvedValue(null),
    deleteProject: vi.fn().mockResolvedValue(undefined),
    listProjects: vi.fn().mockResolvedValue([]),
    saveVideoFile: vi.fn().mockResolvedValue(undefined),
    loadVideoFile: vi.fn().mockResolvedValue(new Blob(['mock video'], { type: 'video/mp4' })),
    deleteVideoFile: vi.fn().mockResolvedValue(undefined),
    saveThumbnail: vi.fn().mockResolvedValue(undefined),
    loadThumbnail: vi.fn().mockResolvedValue('data:image/jpeg;base64,mock'),
    clearCache: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@/utils/videoMetadata', () => ({
  extractVideoMetadata: vi.fn().mockResolvedValue({
    duration: 120,
    width: 1920,
    height: 1080,
    framerate: 30,
  }),
}));

vi.mock('@/utils/thumbnailGenerator', () => ({
  generateThumbnail: vi.fn().mockResolvedValue('data:image/jpeg;base64,mock-thumbnail'),
}));

vi.mock('@/utils/videoProcessor', () => ({
  concatenateVideos: vi.fn().mockResolvedValue({
    blob: new Blob(['processed video'], { type: 'video/mp4' }),
    duration: 60,
    size: 1024 * 1024,
  }),
  downloadVideo: vi.fn(),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn().mockReturnValue(null),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock URL methods
global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
global.URL.revokeObjectURL = vi.fn();

describe('File Upload to Export Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('completes full workflow from upload to export', async () => {
    render(<EditorWorkspace />);

    // 1. Upload a file
    const fileInput = screen.getAllByRole('button', { name: /choose files|add clips/i })[0]
      .querySelector('input[type="file"]');
    
    expect(fileInput).toBeInTheDocument();

    const mockFile = new File(['video content'], 'test-video.mp4', {
      type: 'video/mp4',
      lastModified: Date.now(),
    });

    Object.defineProperty(mockFile, 'size', { value: 1024 * 1024 });

    if (fileInput) {
      Object.defineProperty(fileInput, 'files', {
        value: [mockFile],
        writable: false,
      });
      fireEvent.change(fileInput);
    }

    // 2. Wait for file to be processed
    await waitFor(() => {
      expect(screen.getByText('test-video.mp4')).toBeInTheDocument();
    }, { timeout: 5000 });

    // 3. Add file to timeline
    const addToTimelineButton = screen.getByRole('button', { name: /add to timeline/i });
    fireEvent.click(addToTimelineButton);

    // 4. Verify file appears on timeline
    await waitFor(() => {
      expect(screen.getByTestId('timeline-clip')).toBeInTheDocument();
    });

    // 5. Adjust speed multiplier
    const speedInput = screen.getByDisplayValue('1');
    fireEvent.change(speedInput, { target: { value: '2' } });

    // 6. Open export modal
    const exportButton = screen.getByRole('button', { name: /export/i });
    fireEvent.click(exportButton);

    // 7. Verify export modal opens with correct settings
    await waitFor(() => {
      expect(screen.getByText('Export Timelapse')).toBeInTheDocument();
      expect(screen.getByText('1920x1080')).toBeInTheDocument(); // Resolution
      expect(screen.getByText('1')).toBeInTheDocument(); // Clip count
    });

    // 8. Start export
    const startExportButton = screen.getByRole('button', { name: /start export/i });
    fireEvent.click(startExportButton);

    // 9. Wait for export to complete
    await waitFor(() => {
      expect(screen.getByText('Export Complete')).toBeInTheDocument();
    }, { timeout: 10000 });

    // 10. Verify download button appears
    expect(screen.getByRole('button', { name: /download/i })).toBeInTheDocument();

    // 11. Test download
    const downloadButton = screen.getByRole('button', { name: /download/i });
    fireEvent.click(downloadButton);

    // Verify video processor was called with correct parameters
    const { concatenateVideos } = await import('@/utils/videoProcessor');
    expect(concatenateVideos).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          fileId: expect.any(String),
          duration: 120,
        }),
      ]),
      expect.arrayContaining([
        expect.objectContaining({
          name: 'test-video.mp4',
          duration: 120,
        }),
      ]),
      expect.objectContaining({
        speedMultiplier: 2,
        format: 'mp4',
        quality: 'high',
      })
    );
  });

  it('handles multiple files workflow', async () => {
    render(<EditorWorkspace />);

    // Upload multiple files
    const fileInput = screen.getAllByRole('button', { name: /choose files|add clips/i })[0]
      .querySelector('input[type="file"]');

    const mockFile1 = new File(['video 1'], 'video1.mp4', { type: 'video/mp4' });
    const mockFile2 = new File(['video 2'], 'video2.mp4', { type: 'video/mp4' });

    Object.defineProperty(mockFile1, 'size', { value: 1024 * 1024 });
    Object.defineProperty(mockFile2, 'size', { value: 2 * 1024 * 1024 });

    if (fileInput) {
      Object.defineProperty(fileInput, 'files', {
        value: [mockFile1, mockFile2],
        writable: false,
      });
      fireEvent.change(fileInput);
    }

    // Wait for both files to be processed
    await waitFor(() => {
      expect(screen.getByText('video1.mp4')).toBeInTheDocument();
      expect(screen.getByText('video2.mp4')).toBeInTheDocument();
    }, { timeout: 5000 });

    // Add both files to timeline
    const addButtons = screen.getAllByRole('button', { name: /add to timeline/i });
    fireEvent.click(addButtons[0]);
    fireEvent.click(addButtons[1]);

    // Verify both clips appear on timeline
    await waitFor(() => {
      const timelineClips = screen.getAllByTestId('timeline-clip');
      expect(timelineClips).toHaveLength(2);
    });

    // Test reordering clips
    const timelineClips = screen.getAllByTestId('timeline-clip');
    
    // Simulate drag and drop reordering
    fireEvent.dragStart(timelineClips[0]);
    fireEvent.dragOver(timelineClips[1]);
    fireEvent.drop(timelineClips[1]);

    // Export with multiple clips
    const exportButton = screen.getByRole('button', { name: /export/i });
    fireEvent.click(exportButton);

    await waitFor(() => {
      expect(screen.getByText('2')).toBeInTheDocument(); // Clip count should be 2
    });

    const startExportButton = screen.getByRole('button', { name: /start export/i });
    fireEvent.click(startExportButton);

    await waitFor(() => {
      expect(screen.getByText('Export Complete')).toBeInTheDocument();
    }, { timeout: 10000 });
  });

  it('handles export errors gracefully', async () => {
    // Mock video processor to throw error
    const { concatenateVideos } = await import('@/utils/videoProcessor');
    vi.mocked(concatenateVideos).mockRejectedValueOnce(new Error('Processing failed'));

    render(<EditorWorkspace />);

    // Upload and add file to timeline
    const fileInput = screen.getAllByRole('button', { name: /choose files|add clips/i })[0]
      .querySelector('input[type="file"]');

    const mockFile = new File(['video content'], 'test-video.mp4', { type: 'video/mp4' });
    Object.defineProperty(mockFile, 'size', { value: 1024 * 1024 });

    if (fileInput) {
      Object.defineProperty(fileInput, 'files', {
        value: [mockFile],
        writable: false,
      });
      fireEvent.change(fileInput);
    }

    await waitFor(() => {
      expect(screen.getByText('test-video.mp4')).toBeInTheDocument();
    });

    const addToTimelineButton = screen.getByRole('button', { name: /add to timeline/i });
    fireEvent.click(addToTimelineButton);

    // Start export
    const exportButton = screen.getByRole('button', { name: /export/i });
    fireEvent.click(exportButton);

    const startExportButton = screen.getByRole('button', { name: /start export/i });
    fireEvent.click(startExportButton);

    // Wait for error state
    await waitFor(() => {
      expect(screen.getByText('Export Failed')).toBeInTheDocument();
      expect(screen.getByText(/Processing failed/)).toBeInTheDocument();
    });

    // Test retry functionality
    const retryButton = screen.getByRole('button', { name: /try again/i });
    expect(retryButton).toBeInTheDocument();
  });

  it('persists project state across sessions', async () => {
    // Mock localStorage to return saved project
    const savedProject = {
      id: 'test-project',
      name: 'Test Project',
      files: [{
        id: 'file-1',
        name: 'saved-video.mp4',
        type: 'video/mp4',
        size: 1024 * 1024,
        duration: 120,
        width: 1920,
        height: 1080,
        status: VideoFileStatus.READY,
        thumbnail: 'data:image/jpeg;base64,saved',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }],
      timeline: {
        id: 'timeline-1',
        clips: [{
          id: 'clip-1',
          fileId: 'file-1',
          startTime: 0,
          duration: 120,
          order: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }],
        totalDuration: 120,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      exportSettings: {
        format: 'mp4',
        codec: 'h264',
        speedMultiplier: 2,
        quality: 'high',
        resolution: '1080p',
        includeAudio: false,
      },
      playbackState: {
        currentTime: 0,
        isPlaying: false,
        previewQuality: 'high',
        volume: 1,
      },
      version: '1.0.0',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    localStorageMock.getItem.mockReturnValue(JSON.stringify(savedProject));

    render(<EditorWorkspace />);

    // Verify saved project is loaded
    await waitFor(() => {
      expect(screen.getByText('saved-video.mp4')).toBeInTheDocument();
    });

    // Verify timeline has the saved clip
    await waitFor(() => {
      expect(screen.getByTestId('timeline-clip')).toBeInTheDocument();
    });

    // Verify speed multiplier is restored
    expect(screen.getByDisplayValue('2')).toBeInTheDocument();
  });
});