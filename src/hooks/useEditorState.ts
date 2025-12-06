import { useState, useCallback, useEffect } from 'react';
import { VideoFile, TimelineClip, ProjectState, ExportSettings } from '@/types/editor';
import { sampleFiles } from '@/data/sampleData';
import { VideoFileStatus } from '@/types/schema/VideoFile';
import { ResolutionPreset, QualityPreset } from '@/types/schema/Project';
import { extractVideoMetadata } from '@/utils/videoMetadata';
import { storageService } from '@/services/storage';
import { ProjectSchema } from '@/types/schema/Project';

const STORAGE_KEY = 'timelapse-editor-project';
const CURRENT_PROJECT_ID_KEY = 'current-project-id';

const initialState: ProjectState = {
  id: `project-${Date.now()}`,
  name: 'New Project',
  description: '',
  files: [],
  timeline: {
    id: `timeline-${Date.now()}`,
    clips: [],
    totalDuration: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  exportSettings: {
    format: 'mp4',
    codec: 'h264',
    resolution: ResolutionPreset.FHD_1080P, // Use enum
    quality: QualityPreset.HIGH, // Use enum
    speedMultiplier: 1,
    includeAudio: true,
  },
  playbackState: {
    currentTime: 0,
    isPlaying: false,
    previewQuality: 'proxy',
    volume: 1,
  },
  version: '1.0.0', // Initial version
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

export function useEditorState() {
  const [state, setState] = useState<ProjectState>(initialState);
  const [isLoading, setIsLoading] = useState(true);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Load project from IndexedDB on mount
  useEffect(() => {
    const loadProject = async () => {
      try {
        setIsLoading(true);
        
        // Try to get current project ID from localStorage
        const currentProjectId = localStorage.getItem(CURRENT_PROJECT_ID_KEY);
        
        if (currentProjectId) {
          try {
            const project = await storageService.loadProject(currentProjectId);
            setState(prev => ({
              ...prev,
              ...project,
              playbackState: {
                ...project.playbackState,
                isPlaying: false, // Always start paused
              },
            }));
          } catch (error) {
            console.warn('Failed to load project from IndexedDB, falling back to localStorage:', error);
            // Fallback to localStorage
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
              const parsed = JSON.parse(saved);
              setState(prev => ({
                ...prev,
                ...parsed,
                playbackState: {
                  ...parsed.playbackState,
                  isPlaying: false,
                },
              }));
            }
          }
        } else {
          // Fallback to localStorage for backward compatibility
          const saved = localStorage.getItem(STORAGE_KEY);
          if (saved) {
            const parsed = JSON.parse(saved);
            setState(prev => ({
              ...prev,
              ...parsed,
              playbackState: {
                ...parsed.playbackState,
                isPlaying: false,
              },
            }));
          }
        }
      } catch (error) {
        console.error('Failed to load project:', error);
        setSaveError('Failed to load project');
      } finally {
        setIsLoading(false);
      }
    };

    loadProject();
  }, []);

  // Save project to IndexedDB on state change
  useEffect(() => {
    const saveProject = async () => {
      if (isLoading) return; // Don't save during initial load
      
      try {
        setSaveError(null);
        
        // Convert ProjectState to ProjectSchema
        const projectSchema: ProjectSchema = {
          id: state.id,
          name: state.name,
          description: state.description || '',
          files: state.files.map(file => ({
            id: file.id,
            name: file.name,
            size: file.size,
            type: file.type,
            lastModified: file.lastModified,
            duration: file.duration,
            width: file.width,
            height: file.height,
            framerate: file.framerate,
            bitrate: file.bitrate,
            codec: file.codec,
            thumbnail: file.thumbnail,
            thumbnailTimestamp: file.thumbnailTimestamp,
            status: file.status,
            indexedDBKey: file.indexedDBKey,
            fileHandle: file.fileHandle,
            createdAt: file.createdAt,
            updatedAt: file.updatedAt,
          })),
          timeline: {
            id: state.timeline.id,
            clips: state.timeline.clips.map(clip => ({
              id: clip.id,
              fileId: clip.fileId,
              startTime: clip.startTime,
              duration: clip.duration,
              order: clip.order,
              trimStart: clip.trimStart,
              trimEnd: clip.trimEnd,
              speedMultiplier: clip.speedMultiplier,
              createdAt: clip.createdAt,
              updatedAt: clip.updatedAt,
            })),
            totalDuration: state.timeline.totalDuration,
            createdAt: state.timeline.createdAt,
            updatedAt: state.timeline.updatedAt,
          },
          exportSettings: {
            format: state.exportSettings.format,
            codec: state.exportSettings.codec,
            resolution: state.exportSettings.resolution,
            quality: state.exportSettings.quality,
            bitrate: state.exportSettings.bitrate,
            speedMultiplier: state.exportSettings.speedMultiplier,
            includeAudio: state.exportSettings.includeAudio,
            audioCodec: state.exportSettings.audioCodec,
          },
          playbackState: {
            currentTime: state.playbackState.currentTime,
            isPlaying: state.playbackState.isPlaying,
            previewQuality: state.playbackState.previewQuality,
            volume: state.playbackState.volume,
          },
          version: state.version,
          createdAt: state.createdAt,
          updatedAt: Date.now(),
        };

        // Save to IndexedDB
        await storageService.saveProject(projectSchema);
        
        // Save current project ID to localStorage
        localStorage.setItem(CURRENT_PROJECT_ID_KEY, state.id);
        
        // Also save to localStorage as backup
        const toSave = {
          id: state.id,
          name: state.name,
          description: state.description,
          files: state.files,
          timeline: state.timeline,
          exportSettings: state.exportSettings,
          playbackState: state.playbackState,
          version: state.version,
          createdAt: state.createdAt,
          updatedAt: Date.now(),
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
        
      } catch (error) {
        console.error('Failed to save project:', error);
        setSaveError('Failed to save project');
        
        // Fallback to localStorage only
        try {
          const toSave = {
            id: state.id,
            name: state.name,
            description: state.description,
            files: state.files,
            timeline: state.timeline,
            exportSettings: state.exportSettings,
            playbackState: state.playbackState,
            version: state.version,
            createdAt: state.createdAt,
            updatedAt: Date.now(),
          };
          localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
        } catch (fallbackError) {
          console.error('Failed to save to localStorage fallback:', fallbackError);
        }
      }
    };

    saveProject();
  }, [state.files, state.timeline, state.exportSettings, state.playbackState, state.name, state.description, isLoading]);

  const addFiles = useCallback(async (videoFiles: VideoFile[]) => {
    // Save video files to IndexedDB
    try {
      for (const file of videoFiles) {
        if (file.indexedDBKey) {
          // File blob should be stored separately
          // For now, we'll just store the metadata
          await storageService.saveThumbnail(file.id, file.thumbnail);
        }
      }
    } catch (error) {
      console.error('Failed to save video files to storage:', error);
    }

    setState(prev => ({
      ...prev,
      files: [...prev.files, ...videoFiles],
      updatedAt: Date.now(),
    }));
  }, []);

  const updateFiles = useCallback((updatedFiles: VideoFile[]) => {
    setState(prev => ({
      ...prev,
      files: prev.files.map(existingFile => {
        const updatedFile = updatedFiles.find(f => f.id === existingFile.id);
        return updatedFile || existingFile;
      }),
      updatedAt: Date.now(),
    }));
  }, []);

  const removeFile = useCallback((fileId: string) => {
    setState(prev => ({
      ...prev,
      files: prev.files.filter(f => f.id !== fileId),
      timeline: {
        ...prev.timeline,
        clips: prev.timeline.clips.filter(c => c.fileId !== fileId),
      },
      updatedAt: Date.now(),
    }));
  }, []);

  const addToTimeline = useCallback((fileId: string) => {
    setState(prev => {
      const file = prev.files.find(f => f.id === fileId);
      if (!file) return prev;

      const lastClip = prev.timeline.clips[prev.timeline.clips.length - 1];
      const startTime = lastClip ? lastClip.startTime + lastClip.duration : 0;

      const newClip: TimelineClip = {
        id: `clip-${Date.now()}`,
        fileId: file.id,
        startTime,
        duration: file.duration,
        order: prev.timeline.clips.length,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const updatedClips = [...prev.timeline.clips, newClip];
      const newTotalDuration = updatedClips.reduce((acc, clip) => acc + clip.duration, 0);

      return {
        ...prev,
        timeline: {
          ...prev.timeline,
          clips: updatedClips,
          totalDuration: newTotalDuration,
          updatedAt: Date.now(),
        },
        files: prev.files.map(f =>
          f.id === fileId ? { ...f, status: VideoFileStatus.ON_TIMELINE, updatedAt: Date.now() } : f
        ),
        updatedAt: Date.now(),
      };
    });
  }, []);

  const removeFromTimeline = useCallback((clipId: string) => {
    setState(prev => {
      const clip = prev.timeline.clips.find(c => c.id === clipId);
      if (!clip) return prev;

      const remainingClips = prev.timeline.clips.filter(c => c.id !== clipId);
      const fileStillOnTimeline = remainingClips.some(c => c.fileId === clip.fileId);

      // Recalculate start times and order
      let currentTime = 0;
      const reorderedClips = remainingClips.map((c, index) => {
        const updated = { ...c, startTime: currentTime, order: index, updatedAt: Date.now() };
        currentTime += c.duration;
        return updated;
      });

      const newTotalDuration = reorderedClips.reduce((acc, c) => acc + c.duration, 0);

      return {
        ...prev,
        timeline: {
          ...prev.timeline,
          clips: reorderedClips,
          totalDuration: newTotalDuration,
          updatedAt: Date.now(),
        },
        files: prev.files.map(f =>
          f.id === clip.fileId && !fileStillOnTimeline
            ? { ...f, status: VideoFileStatus.READY, updatedAt: Date.now() }
            : f
        ),
        updatedAt: Date.now(),
      };
    });
  }, []);

  const reorderTimeline = useCallback((fromIndex: number, toIndex: number) => {
    setState(prev => {
      const newTimelineClips = [...prev.timeline.clips];
      const [moved] = newTimelineClips.splice(fromIndex, 1);
      newTimelineClips.splice(toIndex, 0, moved);

      // Recalculate start times and order
      let currentTime = 0;
      const reorderedClips = newTimelineClips.map((c, index) => {
        const updated = { ...c, startTime: currentTime, order: index, updatedAt: Date.now() };
        currentTime += c.duration;
        return updated;
      });

      const newTotalDuration = reorderedClips.reduce((acc, c) => acc + c.duration, 0);

      return {
        ...prev,
        timeline: {
          ...prev.timeline,
          clips: reorderedClips,
          totalDuration: newTotalDuration,
          updatedAt: Date.now(),
        },
        updatedAt: Date.now(),
      };
    });
  }, []);

  const setClipSpeed = useCallback((fileId: string, speed: number) => {
    setState(prev => {
      const updatedFiles = prev.files.map(file =>
        file.id === fileId ? { ...file, speedMultiplier: speed } : file
      );
      
      return {
        ...prev,
        files: updatedFiles,
        updatedAt: Date.now(),
      };
    });
  }, []);

  const setPreviewQuality = useCallback((quality: 'proxy' | 'high') => {
    setState(prev => ({
      ...prev,
      playbackState: {
        ...prev.playbackState,
        previewQuality: quality,
      },
      updatedAt: Date.now(),
    }));
  }, []);

  const setCurrentTime = useCallback((time: number) => {
    setState(prev => ({
      ...prev,
      playbackState: {
        ...prev.playbackState,
        currentTime: Math.max(0, time),
      },
      updatedAt: Date.now(),
    }));
  }, []);

  const togglePlayback = useCallback(() => {
    setState(prev => ({
      ...prev,
      playbackState: {
        ...prev.playbackState,
        isPlaying: !prev.playbackState.isPlaying,
      },
      updatedAt: Date.now(),
    }));
  }, []);

  const setExportSettings = useCallback((settings: Partial<ExportSettings>) => {
    setState(prev => ({
      ...prev,
      exportSettings: {
        ...prev.exportSettings,
        ...settings,
      },
      updatedAt: Date.now(),
    }));
  }, []);

  const clearProject = useCallback(async () => {
    try {
      // Clear from IndexedDB
      const currentProjectId = localStorage.getItem(CURRENT_PROJECT_ID_KEY);
      if (currentProjectId) {
        await storageService.deleteProject(currentProjectId);
      }
      
      // Clear localStorage
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(CURRENT_PROJECT_ID_KEY);
      
      // Reset state
      const newState = {
        ...initialState,
        id: `project-${Date.now()}`, // Generate new ID
      };
      setState(newState);
      
    } catch (error) {
      console.error('Failed to clear project:', error);
      // Still reset state even if storage clear fails
      const newState = {
        ...initialState,
        id: `project-${Date.now()}`,
      };
      setState(newState);
    }
  }, []);

  const saveProjectAs = useCallback(async (name: string, description?: string) => {
    try {
      const newProjectId = `project-${Date.now()}`;
      const newState = {
        ...state,
        id: newProjectId,
        name,
        description: description || '',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      
      setState(newState);
      
      // The useEffect will handle saving to IndexedDB
      return newProjectId;
    } catch (error) {
      console.error('Failed to save project as:', error);
      setSaveError('Failed to save project');
      throw error;
    }
  }, [state]);

  const loadProject = useCallback(async (projectId: string) => {
    try {
      setIsLoading(true);
      const project = await storageService.loadProject(projectId);
      
      setState({
        ...project,
        playbackState: {
          ...project.playbackState,
          isPlaying: false,
        },
      });
      
      localStorage.setItem(CURRENT_PROJECT_ID_KEY, projectId);
      
    } catch (error) {
      console.error('Failed to load project:', error);
      setSaveError('Failed to load project');
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const listProjects = useCallback(async () => {
    try {
      return await storageService.listProjects();
    } catch (error) {
      console.error('Failed to list projects:', error);
      return [];
    }
  }, []);

  const loadSampleData = useCallback(() => {
    setState(prev => ({
      ...prev,
      files: sampleFiles.map(file => ({ ...file, status: VideoFileStatus.READY, createdAt: Date.now(), updatedAt: Date.now() })),
      timeline: {
        ...initialState.timeline,
        clips: [], // Clear clips on sample load, user can add them
      },
      updatedAt: Date.now(),
    }));
  }, []);

  const totalDuration = state.timeline.clips.reduce((acc, clip) => acc + clip.duration, 0);
  const outputDuration = totalDuration / state.exportSettings.speedMultiplier;

  return {
    state,
    isLoading,
    saveError,
    actions: {
      addFiles,
      updateFiles,
      removeFile,
      addToTimeline,
      removeFromTimeline,
      reorderTimeline,
      setClipSpeed,
      setPreviewQuality,
      setCurrentTime,
      togglePlayback,
      setExportSettings,
      clearProject,
      loadSampleData,
      saveProjectAs,
      loadProject,
      listProjects,
    },
    computed: {
      totalDuration,
      outputDuration,
    },
  };
}
