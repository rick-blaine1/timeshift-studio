import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { UploadArea } from '../editor/UploadArea';
import { VideoFileStatus } from '@/types/schema/VideoFile';

// Mock the storage service
vi.mock('@/services/storage', () => ({
  storageService: {
    saveVideoFile: vi.fn().mockResolvedValue(undefined),
    saveThumbnail: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock video metadata extraction
vi.mock('@/utils/videoMetadata', () => ({
  extractVideoMetadata: vi.fn().mockResolvedValue({
    duration: 120,
    width: 1920,
    height: 1080,
    framerate: 30,
  }),
}));

// Mock thumbnail generation
vi.mock('@/utils/thumbnailGenerator', () => ({
  generateThumbnail: vi.fn().mockResolvedValue('data:image/jpeg;base64,mock-thumbnail'),
}));

// Mock toast hook
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

describe('UploadArea', () => {
  const mockOnFilesAdded = vi.fn();
  const mockOnFilesUpdated = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders upload area with correct text', () => {
    render(<UploadArea onFilesAdded={mockOnFilesAdded} />);
    
    expect(screen.getByText('Upload video clips')).toBeInTheDocument();
    expect(screen.getByText(/Drag and drop your video files/)).toBeInTheDocument();
    expect(screen.getByText('Choose files')).toBeInTheDocument();
  });

  it('renders compact variant correctly', () => {
    render(<UploadArea onFilesAdded={mockOnFilesAdded} variant="compact" />);
    
    expect(screen.getByText('Add clips')).toBeInTheDocument();
    expect(screen.queryByText('Upload video clips')).not.toBeInTheDocument();
  });

  it('handles file input change', async () => {
    render(<UploadArea onFilesAdded={mockOnFilesAdded} onFilesUpdated={mockOnFilesUpdated} />);
    
    const fileInput = screen.getByRole('button', { name: /choose files/i }).querySelector('input');
    expect(fileInput).toBeInTheDocument();

    // Create a mock video file
    const mockFile = new File(['video content'], 'test-video.mp4', {
      type: 'video/mp4',
      lastModified: Date.now(),
    });

    Object.defineProperty(mockFile, 'size', { value: 1024 * 1024 }); // 1MB

    // Simulate file selection
    if (fileInput) {
      Object.defineProperty(fileInput, 'files', {
        value: [mockFile],
        writable: false,
      });
      fireEvent.change(fileInput);
    }

    // Wait for initial file processing
    await waitFor(() => {
      expect(mockOnFilesAdded).toHaveBeenCalledWith([
        expect.objectContaining({
          name: 'test-video.mp4',
          type: 'video/mp4',
          status: VideoFileStatus.PROCESSING,
        }),
      ]);
    });

    // Wait for metadata processing to complete
    await waitFor(() => {
      expect(mockOnFilesUpdated).toHaveBeenCalledWith([
        expect.objectContaining({
          name: 'test-video.mp4',
          type: 'video/mp4',
          status: VideoFileStatus.READY,
          duration: 120,
          width: 1920,
          height: 1080,
          thumbnail: 'data:image/jpeg;base64,mock-thumbnail',
        }),
      ]);
    });
  });

  it('rejects invalid file types', async () => {
    const mockToast = vi.fn();
    vi.mocked(require('@/hooks/use-toast').useToast).mockReturnValue({ toast: mockToast });

    render(<UploadArea onFilesAdded={mockOnFilesAdded} />);
    
    const fileInput = screen.getByRole('button', { name: /choose files/i }).querySelector('input');
    
    // Create a mock non-video file
    const mockFile = new File(['text content'], 'test.txt', {
      type: 'text/plain',
    });

    if (fileInput) {
      Object.defineProperty(fileInput, 'files', {
        value: [mockFile],
        writable: false,
      });
      fireEvent.change(fileInput);
    }

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: 'destructive',
          title: 'Upload Error',
          description: expect.stringContaining('Invalid file type'),
        })
      );
    });

    expect(mockOnFilesAdded).not.toHaveBeenCalled();
  });

  it('rejects files that are too large', async () => {
    const mockToast = vi.fn();
    vi.mocked(require('@/hooks/use-toast').useToast).mockReturnValue({ toast: mockToast });

    render(<UploadArea onFilesAdded={mockOnFilesAdded} />);
    
    const fileInput = screen.getByRole('button', { name: /choose files/i }).querySelector('input');
    
    // Create a mock large file (2GB)
    const mockFile = new File(['video content'], 'large-video.mp4', {
      type: 'video/mp4',
    });

    Object.defineProperty(mockFile, 'size', { value: 2 * 1024 * 1024 * 1024 }); // 2GB

    if (fileInput) {
      Object.defineProperty(fileInput, 'files', {
        value: [mockFile],
        writable: false,
      });
      fireEvent.change(fileInput);
    }

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: 'destructive',
          title: 'Upload Error',
          description: expect.stringContaining('exceeds the 1GB limit'),
        })
      );
    });

    expect(mockOnFilesAdded).not.toHaveBeenCalled();
  });

  it('handles drag and drop', () => {
    render(<UploadArea onFilesAdded={mockOnFilesAdded} />);
    
    const dropArea = screen.getByText('Upload video clips').closest('div');
    expect(dropArea).toBeInTheDocument();

    // Test drag over
    if (dropArea) {
      fireEvent.dragOver(dropArea);
      expect(screen.getByText('Drop your clips here')).toBeInTheDocument();

      // Test drag leave
      fireEvent.dragLeave(dropArea);
      expect(screen.getByText('Upload video clips')).toBeInTheDocument();
    }
  });

  it('processes multiple files correctly', async () => {
    render(<UploadArea onFilesAdded={mockOnFilesAdded} onFilesUpdated={mockOnFilesUpdated} />);
    
    const fileInput = screen.getByRole('button', { name: /choose files/i }).querySelector('input');
    
    // Create multiple mock video files
    const mockFile1 = new File(['video content 1'], 'video1.mp4', { type: 'video/mp4' });
    const mockFile2 = new File(['video content 2'], 'video2.webm', { type: 'video/webm' });

    Object.defineProperty(mockFile1, 'size', { value: 1024 * 1024 });
    Object.defineProperty(mockFile2, 'size', { value: 2 * 1024 * 1024 });

    if (fileInput) {
      Object.defineProperty(fileInput, 'files', {
        value: [mockFile1, mockFile2],
        writable: false,
      });
      fireEvent.change(fileInput);
    }

    await waitFor(() => {
      expect(mockOnFilesAdded).toHaveBeenCalledWith([
        expect.objectContaining({ name: 'video1.mp4' }),
        expect.objectContaining({ name: 'video2.webm' }),
      ]);
    });
  });
});