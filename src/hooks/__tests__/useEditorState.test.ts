import { renderHook, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { useEditorState } from '../useEditorState';
import { VideoFileStatus } from '@/types/schema/VideoFile';
import { ResolutionPreset, QualityPreset } from '@/types/schema/Project';

// Mock the storage service
const mockStorageService = {
  saveProject: vi.fn().mockResolvedValue(undefined),
  loadProject: vi.fn().mockResolvedValue(null),
  deleteProject: vi.fn().mockResolvedValue(undefined),
  listProjects: vi.fn().mockResolvedValue([]),
  saveVideoFile: vi.fn().mockResolvedValue(undefined),
  loadVideoFile: vi.fn().mockResolvedValue(new Blob()),
  deleteVideoFile: vi.fn().mockResolvedValue(undefined),
  saveThumbnail: vi.fn().mockResolvedValue(undefined),
  loadThumbnail: vi.fn().mockResolvedValue(''),
  clearCache: vi.fn().mockResolvedValue(undefined),
};

vi.mock('@/services/storage', () => ({
  storageService: mockStorageService,
}));

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

describe('useEditorState', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
  });

  it('initializes with default state', async () => {
    const { result } = renderHook(() => useEditorState());

    await act(async () => {
      // Wait for initial load to complete
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(result.current.state.files).toEqual([]);
    expect(result.current.state.timeline.clips).toEqual([]);
    expect(result.current.state.exportSettings.speedMultiplier).toBe(1);
    expect(result.current.state.playbackState.isPlaying).toBe(false);
    expect(result.current.isLoading).toBe(false);
  });

  it('adds files correctly', async () => {
    const { result } = renderHook(() => useEditorState());

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    const mockVideoFile = {
      id: 'test-file-1',
      name: 'test.mp4',
      size: 1024 * 1024,
      type: 'video/mp4',
      lastModified: Date.now(),
      duration: 120,
      width: 1920,
      height: 1080,
      framerate: 30,
      thumbnail: 'data:image/jpeg;base64,test',
      thumbnailTimestamp: 5,
      status: VideoFileStatus.READY,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await act(async () => {
      await result.current.actions.addFiles([mockVideoFile]);
    });

    expect(result.current.state.files).toHaveLength(1);
    expect(result.current.state.files[0]).toEqual(mockVideoFile);
  });

  it('adds clips to timeline correctly', async () => {
    const { result } = renderHook(() => useEditorState());

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    const mockVideoFile = {
      id: 'test-file-1',
      name: 'test.mp4',
      size: 1024 * 1024,
      type: 'video/mp4',
      lastModified: Date.now(),
      duration: 120,
      width: 1920,
      height: 1080,
      framerate: 30,
      thumbnail: 'data:image/jpeg;base64,test',
      thumbnailTimestamp: 5,
      status: VideoFileStatus.READY,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await act(async () => {
      await result.current.actions.addFiles([mockVideoFile]);
    });

    await act(async () => {
      result.current.actions.addToTimeline('test-file-1');
    });

    expect(result.current.state.timeline.clips).toHaveLength(1);
    expect(result.current.state.timeline.clips[0]).toEqual(
      expect.objectContaining({
        fileId: 'test-file-1',
        duration: 120,
        startTime: 0,
        order: 0,
      })
    );

    // Check that file status is updated
    expect(result.current.state.files[0].status).toBe(VideoFileStatus.ON_TIMELINE);
  });

  it('removes clips from timeline correctly', async () => {
    const { result } = renderHook(() => useEditorState());

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    const mockVideoFile = {
      id: 'test-file-1',
      name: 'test.mp4',
      size: 1024 * 1024,
      type: 'video/mp4',
      lastModified: Date.now(),
      duration: 120,
      width: 1920,
      height: 1080,
      framerate: 30,
      thumbnail: 'data:image/jpeg;base64,test',
      thumbnailTimestamp: 5,
      status: VideoFileStatus.READY,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await act(async () => {
      await result.current.actions.addFiles([mockVideoFile]);
    });

    await act(async () => {
      result.current.actions.addToTimeline('test-file-1');
    });

    const clipId = result.current.state.timeline.clips[0].id;

    await act(async () => {
      result.current.actions.removeFromTimeline(clipId);
    });

    expect(result.current.state.timeline.clips).toHaveLength(0);
    expect(result.current.state.files[0].status).toBe(VideoFileStatus.READY);
  });

  it('reorders timeline clips correctly', async () => {
    const { result } = renderHook(() => useEditorState());

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    const mockVideoFile1 = {
      id: 'test-file-1',
      name: 'test1.mp4',
      size: 1024 * 1024,
      type: 'video/mp4',
      lastModified: Date.now(),
      duration: 60,
      width: 1920,
      height: 1080,
      framerate: 30,
      thumbnail: 'data:image/jpeg;base64,test1',
      thumbnailTimestamp: 5,
      status: VideoFileStatus.READY,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const mockVideoFile2 = {
      id: 'test-file-2',
      name: 'test2.mp4',
      size: 1024 * 1024,
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
    };

    await act(async () => {
      await result.current.actions.addFiles([mockVideoFile1, mockVideoFile2]);
    });

    await act(async () => {
      result.current.actions.addToTimeline('test-file-1');
      result.current.actions.addToTimeline('test-file-2');
    });

    // Verify initial order
    expect(result.current.state.timeline.clips[0].fileId).toBe('test-file-1');
    expect(result.current.state.timeline.clips[1].fileId).toBe('test-file-2');
    expect(result.current.state.timeline.clips[0].startTime).toBe(0);
    expect(result.current.state.timeline.clips[1].startTime).toBe(60);

    // Reorder clips
    await act(async () => {
      result.current.actions.reorderTimeline(0, 1);
    });

    // Verify new order
    expect(result.current.state.timeline.clips[0].fileId).toBe('test-file-2');
    expect(result.current.state.timeline.clips[1].fileId).toBe('test-file-1');
    expect(result.current.state.timeline.clips[0].startTime).toBe(0);
    expect(result.current.state.timeline.clips[1].startTime).toBe(90);
  });

  it('updates speed multiplier correctly', async () => {
    const { result } = renderHook(() => useEditorState());

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    await act(async () => {
      result.current.actions.setSpeedMultiplier(4);
    });

    expect(result.current.state.exportSettings.speedMultiplier).toBe(4);
  });

  it('calculates output duration correctly', async () => {
    const { result } = renderHook(() => useEditorState());

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    const mockVideoFile = {
      id: 'test-file-1',
      name: 'test.mp4',
      size: 1024 * 1024,
      type: 'video/mp4',
      lastModified: Date.now(),
      duration: 120,
      width: 1920,
      height: 1080,
      framerate: 30,
      thumbnail: 'data:image/jpeg;base64,test',
      thumbnailTimestamp: 5,
      status: VideoFileStatus.READY,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await act(async () => {
      await result.current.actions.addFiles([mockVideoFile]);
    });

    await act(async () => {
      result.current.actions.addToTimeline('test-file-1');
    });

    await act(async () => {
      result.current.actions.setSpeedMultiplier(2);
    });

    expect(result.current.computed.totalDuration).toBe(120);
    expect(result.current.computed.outputDuration).toBe(60); // 120 / 2
  });

  it('clears project correctly', async () => {
    const { result } = renderHook(() => useEditorState());

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    const mockVideoFile = {
      id: 'test-file-1',
      name: 'test.mp4',
      size: 1024 * 1024,
      type: 'video/mp4',
      lastModified: Date.now(),
      duration: 120,
      width: 1920,
      height: 1080,
      framerate: 30,
      thumbnail: 'data:image/jpeg;base64,test',
      thumbnailTimestamp: 5,
      status: VideoFileStatus.READY,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await act(async () => {
      await result.current.actions.addFiles([mockVideoFile]);
    });

    await act(async () => {
      result.current.actions.addToTimeline('test-file-1');
    });

    await act(async () => {
      await result.current.actions.clearProject();
    });

    expect(result.current.state.files).toHaveLength(0);
    expect(result.current.state.timeline.clips).toHaveLength(0);
    expect(mockStorageService.deleteProject).toHaveBeenCalled();
    expect(localStorageMock.removeItem).toHaveBeenCalled();
  });

  it('saves project to storage on state changes', async () => {
    const { result } = renderHook(() => useEditorState());

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    const mockVideoFile = {
      id: 'test-file-1',
      name: 'test.mp4',
      size: 1024 * 1024,
      type: 'video/mp4',
      lastModified: Date.now(),
      duration: 120,
      width: 1920,
      height: 1080,
      framerate: 30,
      thumbnail: 'data:image/jpeg;base64,test',
      thumbnailTimestamp: 5,
      status: VideoFileStatus.READY,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await act(async () => {
      await result.current.actions.addFiles([mockVideoFile]);
    });

    // Wait for the useEffect to trigger
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(mockStorageService.saveProject).toHaveBeenCalled();
    expect(localStorageMock.setItem).toHaveBeenCalled();
  });
});