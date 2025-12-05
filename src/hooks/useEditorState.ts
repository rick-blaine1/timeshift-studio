import { useState, useCallback, useEffect } from 'react';
import { VideoFile, TimelineClip, ProjectState } from '@/types/editor';
import { sampleFiles } from '@/data/sampleData';

const STORAGE_KEY = 'timelapse-editor-project';

const initialState: ProjectState = {
  files: [],
  timeline: [],
  speedMultiplier: 4,
  previewQuality: 'proxy',
  currentTime: 0,
  isPlaying: false,
};

export function useEditorState() {
  const [state, setState] = useState<ProjectState>(initialState);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setState(prev => ({
          ...prev,
          ...parsed,
          isPlaying: false,
        }));
      }
    } catch (e) {
      console.error('Failed to restore project:', e);
    }
  }, []);

  // Save to localStorage on state change
  useEffect(() => {
    try {
      const toSave = {
        files: state.files,
        timeline: state.timeline,
        speedMultiplier: state.speedMultiplier,
        previewQuality: state.previewQuality,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
    } catch (e) {
      console.error('Failed to save project:', e);
    }
  }, [state.files, state.timeline, state.speedMultiplier, state.previewQuality]);

  const addFiles = useCallback((newFiles: VideoFile[]) => {
    setState(prev => ({
      ...prev,
      files: [...prev.files, ...newFiles],
    }));
  }, []);

  const removeFile = useCallback((fileId: string) => {
    setState(prev => ({
      ...prev,
      files: prev.files.filter(f => f.id !== fileId),
      timeline: prev.timeline.filter(c => c.fileId !== fileId),
    }));
  }, []);

  const addToTimeline = useCallback((fileId: string) => {
    setState(prev => {
      const file = prev.files.find(f => f.id === fileId);
      if (!file) return prev;

      const lastClip = prev.timeline[prev.timeline.length - 1];
      const startTime = lastClip ? lastClip.startTime + lastClip.duration : 0;

      const newClip: TimelineClip = {
        id: `clip-${Date.now()}`,
        fileId: file.id,
        startTime,
        duration: file.duration,
      };

      return {
        ...prev,
        timeline: [...prev.timeline, newClip],
        files: prev.files.map(f =>
          f.id === fileId ? { ...f, status: 'on-timeline' as const } : f
        ),
      };
    });
  }, []);

  const removeFromTimeline = useCallback((clipId: string) => {
    setState(prev => {
      const clip = prev.timeline.find(c => c.id === clipId);
      if (!clip) return prev;

      const remainingClips = prev.timeline.filter(c => c.id !== clipId);
      const fileStillOnTimeline = remainingClips.some(c => c.fileId === clip.fileId);

      // Recalculate start times
      let currentTime = 0;
      const reorderedClips = remainingClips.map(c => {
        const updated = { ...c, startTime: currentTime };
        currentTime += c.duration;
        return updated;
      });

      return {
        ...prev,
        timeline: reorderedClips,
        files: prev.files.map(f =>
          f.id === clip.fileId && !fileStillOnTimeline
            ? { ...f, status: 'ready' as const }
            : f
        ),
      };
    });
  }, []);

  const reorderTimeline = useCallback((fromIndex: number, toIndex: number) => {
    setState(prev => {
      const newTimeline = [...prev.timeline];
      const [moved] = newTimeline.splice(fromIndex, 1);
      newTimeline.splice(toIndex, 0, moved);

      // Recalculate start times
      let currentTime = 0;
      const reorderedClips = newTimeline.map(c => {
        const updated = { ...c, startTime: currentTime };
        currentTime += c.duration;
        return updated;
      });

      return {
        ...prev,
        timeline: reorderedClips,
      };
    });
  }, []);

  const setSpeedMultiplier = useCallback((speed: number) => {
    setState(prev => ({
      ...prev,
      speedMultiplier: Math.max(1, Math.min(100, speed)),
    }));
  }, []);

  const setPreviewQuality = useCallback((quality: 'proxy' | 'high') => {
    setState(prev => ({
      ...prev,
      previewQuality: quality,
    }));
  }, []);

  const setCurrentTime = useCallback((time: number) => {
    setState(prev => ({
      ...prev,
      currentTime: Math.max(0, time),
    }));
  }, []);

  const togglePlayback = useCallback(() => {
    setState(prev => ({
      ...prev,
      isPlaying: !prev.isPlaying,
    }));
  }, []);

  const clearProject = useCallback(() => {
    setState(initialState);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const loadSampleData = useCallback(() => {
    setState(prev => ({
      ...prev,
      files: sampleFiles,
    }));
  }, []);

  const totalDuration = state.timeline.reduce((acc, clip) => acc + clip.duration, 0);
  const outputDuration = totalDuration / state.speedMultiplier;

  return {
    state,
    actions: {
      addFiles,
      removeFile,
      addToTimeline,
      removeFromTimeline,
      reorderTimeline,
      setSpeedMultiplier,
      setPreviewQuality,
      setCurrentTime,
      togglePlayback,
      clearProject,
      loadSampleData,
    },
    computed: {
      totalDuration,
      outputDuration,
    },
  };
}
