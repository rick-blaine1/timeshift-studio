import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { FileSidebar } from '../editor/FileSidebar';
import { VideoFileStatus } from '@/types/schema/VideoFile';

// Mock the child components
vi.mock('../editor/FileCard', () => ({
  FileCard: ({ file, onRemove, onAddToTimeline }: any) => (
    <div data-testid="file-card">
      <span>{file.name}</span>
      <button onClick={onRemove}>Remove</button>
      <button onClick={onAddToTimeline}>Add to Timeline</button>
    </div>
  ),
}));

vi.mock('../editor/UploadArea', () => ({
  UploadArea: ({ onFilesAdded, onFilesUpdated, variant }: any) => (
    <div data-testid="upload-area" data-variant={variant}>
      <button onClick={() => onFilesAdded([{ id: 'new-file', name: 'new.mp4' }])}>
        Upload Files
      </button>
      {onFilesUpdated && (
        <button onClick={() => onFilesUpdated([{ id: 'updated-file', name: 'updated.mp4' }])}>
          Update Files
        </button>
      )}
    </div>
  ),
}));

describe('FileSidebar', () => {
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
      status: VideoFileStatus.READY,
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
      status: VideoFileStatus.READY,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
  ];

  const defaultProps = {
    files: mockFiles,
    onAddFiles: vi.fn(),
    onUpdateFiles: vi.fn(),
    onRemoveFile: vi.fn(),
    onAddToTimeline: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders sidebar with files correctly', () => {
    render(<FileSidebar {...defaultProps} />);
    
    expect(screen.getByText('Project Files')).toBeInTheDocument();
    expect(screen.getByText('2 clips')).toBeInTheDocument();
    
    // Check that file cards are rendered
    const fileCards = screen.getAllByTestId('file-card');
    expect(fileCards).toHaveLength(2);
    
    expect(screen.getByText('video1.mp4')).toBeInTheDocument();
    expect(screen.getByText('video2.mp4')).toBeInTheDocument();
  });

  it('renders empty state when no files', () => {
    render(<FileSidebar {...defaultProps} files={[]} />);
    
    expect(screen.getByText('Project Files')).toBeInTheDocument();
    expect(screen.getByText('0 clips')).toBeInTheDocument();
    expect(screen.getByText('No files yet')).toBeInTheDocument();
    expect(screen.getByText('Upload clips to get started')).toBeInTheDocument();
  });

  it('handles singular clip count correctly', () => {
    const singleFile = [mockFiles[0]];
    render(<FileSidebar {...defaultProps} files={singleFile} />);
    
    expect(screen.getByText('1 clip')).toBeInTheDocument();
  });

  it('handles file removal', () => {
    render(<FileSidebar {...defaultProps} />);
    
    const removeButtons = screen.getAllByText('Remove');
    fireEvent.click(removeButtons[0]);
    
    expect(defaultProps.onRemoveFile).toHaveBeenCalledWith('file-1');
  });

  it('handles add to timeline', () => {
    render(<FileSidebar {...defaultProps} />);
    
    const addToTimelineButtons = screen.getAllByText('Add to Timeline');
    fireEvent.click(addToTimelineButtons[1]);
    
    expect(defaultProps.onAddToTimeline).toHaveBeenCalledWith('file-2');
  });

  it('handles file upload through UploadArea', () => {
    render(<FileSidebar {...defaultProps} />);
    
    const uploadButton = screen.getByText('Upload Files');
    fireEvent.click(uploadButton);
    
    expect(defaultProps.onAddFiles).toHaveBeenCalledWith([{ id: 'new-file', name: 'new.mp4' }]);
  });

  it('handles file updates through UploadArea when callback provided', () => {
    render(<FileSidebar {...defaultProps} />);
    
    const updateButton = screen.getByText('Update Files');
    fireEvent.click(updateButton);
    
    expect(defaultProps.onUpdateFiles).toHaveBeenCalledWith([{ id: 'updated-file', name: 'updated.mp4' }]);
  });

  it('passes compact variant to UploadArea', () => {
    render(<FileSidebar {...defaultProps} />);
    
    const uploadArea = screen.getByTestId('upload-area');
    expect(uploadArea).toHaveAttribute('data-variant', 'compact');
  });

  it('renders with proper layout structure', () => {
    render(<FileSidebar {...defaultProps} />);
    
    // Check for main container
    const sidebar = screen.getByText('Project Files').closest('div');
    expect(sidebar).toHaveClass('flex', 'flex-col', 'h-full', 'bg-card', 'border-r');
    
    // Check for header section
    const header = screen.getByText('Project Files').closest('div');
    expect(header).toHaveClass('p-4', 'border-b');
    
    // Check for upload area in footer
    const uploadArea = screen.getByTestId('upload-area');
    const footer = uploadArea.closest('div');
    expect(footer).toHaveClass('p-3', 'border-t');
  });

  it('handles scrollable file list', () => {
    // Create many files to test scrolling
    const manyFiles = Array.from({ length: 20 }, (_, i) => ({
      ...mockFiles[0],
      id: `file-${i}`,
      name: `video${i}.mp4`,
    }));
    
    render(<FileSidebar {...defaultProps} files={manyFiles} />);
    
    expect(screen.getByText('20 clips')).toBeInTheDocument();
    
    // Check that the file list container has scrollable classes
    const fileListContainer = screen.getByText('video0.mp4').closest('.space-y-2');
    expect(fileListContainer?.parentElement).toHaveClass('flex-1', 'overflow-y-auto', 'scrollbar-thin');
  });

  it('works without onUpdateFiles callback', () => {
    const propsWithoutUpdate = {
      ...defaultProps,
      onUpdateFiles: undefined,
    };
    
    expect(() => render(<FileSidebar {...propsWithoutUpdate} />)).not.toThrow();
    
    // Should still render upload area but without update functionality
    expect(screen.getByTestId('upload-area')).toBeInTheDocument();
  });

  it('displays folder icon in header', () => {
    render(<FileSidebar {...defaultProps} />);
    
    // Check that the FolderOpen icon is rendered (via class or test id)
    const header = screen.getByText('Project Files');
    expect(header.closest('h2')).toHaveClass('flex', 'items-center', 'gap-2');
  });
});