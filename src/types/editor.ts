export interface VideoFile {
  id: string;
  name: string;
  duration: number;
  thumbnail: string;
  resolution: string;
  size: number;
  status: 'ready' | 'on-timeline' | 'error' | 'uploading';
  file?: File;
}

export interface TimelineClip {
  id: string;
  fileId: string;
  startTime: number;
  duration: number;
}

export interface ProjectState {
  files: VideoFile[];
  timeline: TimelineClip[];
  speedMultiplier: number;
  previewQuality: 'proxy' | 'high';
  currentTime: number;
  isPlaying: boolean;
}

export interface ExportSettings {
  resolution: string;
  estimatedDuration: number;
}

export type ExportStatus = 'idle' | 'preparing' | 'encoding' | 'packaging' | 'done' | 'error';
