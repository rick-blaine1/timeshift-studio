import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ExportModal } from '../editor/ExportModal';
import { VideoFileStatus } from '@/types/schema/VideoFile';
import { ResolutionPreset, QualityPreset } from '@/types/schema/Project';

// Mock dependencies
vi.mock('@/data/sampleData', () => ({
  formatDuration: vi.fn((seconds: number) => `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`),
}));

vi.mock('@/utils/videoProcessor', () => ({
  concatenateVideos: vi.fn(),
  downloadVideo: vi.fn(),
}));

vi.mock('@/utils/errorHandling', () => ({
  getUserFriendlyErrorMessage: vi.fn((error: Error) => error.message),
  getErrorRecoverySuggestions: vi.fn(() => ['Try reducing video quality', 'Close other browser tabs']),
  VideoProcessingError: class extends Error {},
  StorageError: class extends Error {},
  MemoryError: class extends Error {},
}));

vi.mock('@/utils/performanceMonitor', () => ({
  performanceMonitor: {
    startVideoProcessing: vi.fn(() => 'session-123'),
    endVideoProcessing: vi.fn(),
    checkPerformanceHealth: vi.fn(() => ({ status: 'good' })),
    getMemoryUsage: vi.fn(() => ({ used: 100, total: 1000 })),
  },
}));

describe('ExportModal', () => {
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
  ];

  const mockExportSettings = {
    format: 'mp4' as const,
    codec: 'h264',
    resolution: ResolutionPreset.FHD_1080P,
    quality: QualityPreset.HIGH,
    speedMultiplier: 2,
    includeAudio: false,
  };

  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    outputDuration: 60,
    resolution: '1920x1080',
    clipCount: 1,
    clips: mockClips,
    files: mockFiles,
    exportSettings: mockExportSettings,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders export modal in idle state', () => {
    render(<ExportModal {...defaultProps} />);
    
    expect(screen.getByText('Export Timelapse')).toBeInTheDocument();
    expect(screen.getByText('Review settings and export your timelapse video.')).toBeInTheDocument();
    
    // Check summary information
    expect(screen.getByText('1:00')).toBeInTheDocument(); // Output duration
    expect(screen.getByText('1920x1080')).toBeInTheDocument(); // Resolution
    expect(screen.getByText('1')).toBeInTheDocument(); // Clip count
    expect(screen.getByText('Removed (timelapse)')).toBeInTheDocument(); // Audio
    
    // Check buttons
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start Export' })).toBeInTheDocument();
  });

  it('handles export start successfully', async () => {
    const { concatenateVideos } = await import('@/utils/videoProcessor');
    vi.mocked(concatenateVideos).mockResolvedValue({
      blob: new Blob(['video data'], { type: 'video/mp4' }),
      duration: 60,
      size: 1024 * 1024,
    });

    render(<ExportModal {...defaultProps} />);
    
    const startButton = screen.getByRole('button', { name: 'Start Export' });
    fireEvent.click(startButton);
    
    // Should show preparing state
    await waitFor(() => {
      expect(screen.getByText('Preparing files...')).toBeInTheDocument();
    });
    
    // Should eventually show completion
    await waitFor(() => {
      expect(screen.getByText('Export Complete')).toBeInTheDocument();
      expect(screen.getByText('Your timelapse is ready!')).toBeInTheDocument();
    }, { timeout: 5000 });
    
    // Should show download button
    expect(screen.getByRole('button', { name: 'Download' })).toBeInTheDocument();
  });

  it('handles export with no clips error', async () => {
    render(<ExportModal {...defaultProps} clips={[]} />);
    
    const startButton = screen.getByRole('button', { name: 'Start Export' });
    fireEvent.click(startButton);
    
    await waitFor(() => {
      expect(screen.getByText('Export Failed')).toBeInTheDocument();
      expect(screen.getByText('No clips to export')).toBeInTheDocument();
    });
  });

  it('handles export processing error', async () => {
    const { concatenateVideos } = await import('@/utils/videoProcessor');
    vi.mocked(concatenateVideos).mockRejectedValue(new Error('Processing failed'));

    render(<ExportModal {...defaultProps} />);
    
    const startButton = screen.getByRole('button', { name: 'Start Export' });
    fireEvent.click(startButton);
    
    await waitFor(() => {
      expect(screen.getByText('Export Failed')).toBeInTheDocument();
      expect(screen.getByText('Processing failed')).toBeInTheDocument();
    });
    
    // Should show error suggestions
    expect(screen.getByText('Try these solutions:')).toBeInTheDocument();
    expect(screen.getByText('• Try reducing video quality')).toBeInTheDocument();
    expect(screen.getByText('• Close other browser tabs')).toBeInTheDocument();
    
    // Should show retry button
    expect(screen.getByRole('button', { name: 'Try Again' })).toBeInTheDocument();
  });

  it('handles download functionality', async () => {
    const { concatenateVideos, downloadVideo } = await import('@/utils/videoProcessor');
    const mockBlob = new Blob(['video data'], { type: 'video/mp4' });
    vi.mocked(concatenateVideos).mockResolvedValue({
      blob: mockBlob,
      duration: 60,
      size: 1024 * 1024,
    });

    render(<ExportModal {...defaultProps} />);
    
    // Start and complete export
    const startButton = screen.getByRole('button', { name: 'Start Export' });
    fireEvent.click(startButton);
    
    await waitFor(() => {
      expect(screen.getByText('Export Complete')).toBeInTheDocument();
    }, { timeout: 5000 });
    
    // Click download
    const downloadButton = screen.getByRole('button', { name: 'Download' });
    fireEvent.click(downloadButton);
    
    expect(downloadVideo).toHaveBeenCalledWith(mockBlob, expect.stringMatching(/timelapse-\d+\.mp4/));
  });

  it('handles retry functionality', async () => {
    const { concatenateVideos } = await import('@/utils/videoProcessor');
    vi.mocked(concatenateVideos).mockRejectedValue(new Error('Processing failed'));

    render(<ExportModal {...defaultProps} />);
    
    // Start export and let it fail
    const startButton = screen.getByRole('button', { name: 'Start Export' });
    fireEvent.click(startButton);
    
    await waitFor(() => {
      expect(screen.getByText('Export Failed')).toBeInTheDocument();
    });
    
    // Click retry
    const retryButton = screen.getByRole('button', { name: 'Try Again' });
    fireEvent.click(retryButton);
    
    // Should return to idle state
    expect(screen.getByText('Export Timelapse')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start Export' })).toBeInTheDocument();
  });

  it('shows progress during export', async () => {
    const { concatenateVideos } = await import('@/utils/videoProcessor');
    
    // Mock progress updates
    vi.mocked(concatenateVideos).mockImplementation(async (clips, files, options) => {
      // Simulate progress updates
      if (options.onProgress) {
        options.onProgress(25);
        options.onProgress(50);
        options.onProgress(90);
        options.onProgress(100);
      }
      return {
        blob: new Blob(['video data'], { type: 'video/mp4' }),
        duration: 60,
        size: 1024 * 1024,
      };
    });

    render(<ExportModal {...defaultProps} />);
    
    const startButton = screen.getByRole('button', { name: 'Start Export' });
    fireEvent.click(startButton);
    
    // Should show progress
    await waitFor(() => {
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });
  });

  it('resets state when modal closes', () => {
    const { rerender } = render(<ExportModal {...defaultProps} />);
    
    // Close modal
    rerender(<ExportModal {...defaultProps} isOpen={false} />);
    
    // Reopen modal
    rerender(<ExportModal {...defaultProps} isOpen={true} />);
    
    // Should be back in idle state
    expect(screen.getByText('Export Timelapse')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start Export' })).toBeInTheDocument();
  });

  it('handles modal close during export', async () => {
    const { concatenateVideos } = await import('@/utils/videoProcessor');
    vi.mocked(concatenateVideos).mockImplementation(() => new Promise(() => {})); // Never resolves

    render(<ExportModal {...defaultProps} />);
    
    // Start export
    const startButton = screen.getByRole('button', { name: 'Start Export' });
    fireEvent.click(startButton);
    
    await waitFor(() => {
      expect(screen.getByText('Preparing files...')).toBeInTheDocument();
    });
    
    // Close modal
    defaultProps.onClose();
    
    // Performance monitoring should be cleaned up
    const { performanceMonitor } = await import('@/utils/performanceMonitor');
    expect(performanceMonitor.endVideoProcessing).toHaveBeenCalled();
  });

  it('displays correct status messages', async () => {
    const { concatenateVideos } = await import('@/utils/videoProcessor');
    
    vi.mocked(concatenateVideos).mockImplementation(async (clips, files, options) => {
      if (options.onProgress) {
        options.onProgress(10); // Should show "Preparing files..."
        options.onProgress(50); // Should show "Encoding video..."
        options.onProgress(95); // Should show "Packaging output..."
      }
      return {
        blob: new Blob(['video data'], { type: 'video/mp4' }),
        duration: 60,
        size: 1024 * 1024,
      };
    });

    render(<ExportModal {...defaultProps} />);
    
    const startButton = screen.getByRole('button', { name: 'Start Export' });
    fireEvent.click(startButton);
    
    // Check that different status messages appear
    await waitFor(() => {
      expect(screen.getByText('Preparing files...')).toBeInTheDocument();
    });
  });

  it('passes correct options to video processor', async () => {
    const { concatenateVideos } = await import('@/utils/videoProcessor');
    vi.mocked(concatenateVideos).mockResolvedValue({
      blob: new Blob(['video data'], { type: 'video/mp4' }),
      duration: 60,
      size: 1024 * 1024,
    });

    render(<ExportModal {...defaultProps} />);
    
    const startButton = screen.getByRole('button', { name: 'Start Export' });
    fireEvent.click(startButton);
    
    await waitFor(() => {
      expect(concatenateVideos).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'clip-1',
            fileId: 'file-1',
            duration: 120,
          }),
        ]),
        expect.arrayContaining([
          expect.objectContaining({
            id: 'file-1',
            name: 'video1.mp4',
          }),
        ]),
        expect.objectContaining({
          speedMultiplier: 2,
          quality: 'high',
          format: 'mp4',
          maxMemoryUsage: 800,
          onProgress: expect.any(Function),
        })
      );
    });
  });

  it('handles different quality presets', async () => {
    const { concatenateVideos } = await import('@/utils/videoProcessor');
    vi.mocked(concatenateVideos).mockResolvedValue({
      blob: new Blob(['video data'], { type: 'video/mp4' }),
      duration: 60,
      size: 1024 * 1024,
    });

    // Test low quality
    const lowQualityProps = {
      ...defaultProps,
      exportSettings: {
        ...defaultProps.exportSettings,
        quality: QualityPreset.LOW,
      },
    };
    const { rerender } = render(<ExportModal {...lowQualityProps} />);
    
    const startButton = screen.getByRole('button', { name: 'Start Export' });
    fireEvent.click(startButton);
    
    await waitFor(() => {
      expect(concatenateVideos).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({
          quality: 'low',
        })
      );
    });

    // Test medium quality
    vi.mocked(concatenateVideos).mockClear();
    const mediumQualityProps = {
      ...defaultProps,
      exportSettings: {
        ...defaultProps.exportSettings,
        quality: QualityPreset.MEDIUM,
      },
    };
    rerender(<ExportModal {...mediumQualityProps} />);
    
    fireEvent.click(startButton);
    
    await waitFor(() => {
      expect(concatenateVideos).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({
          quality: 'medium',
        })
      );
    });

    // Test high quality
    vi.mocked(concatenateVideos).mockClear();
    const highQualityProps = {
      ...defaultProps,
      exportSettings: {
        ...defaultProps.exportSettings,
        quality: QualityPreset.HIGH,
      },
    };
    rerender(<ExportModal {...highQualityProps} />);
    
    fireEvent.click(startButton);
    
    await waitFor(() => {
      expect(concatenateVideos).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({
          quality: 'high',
        })
      );
    });
  });
});