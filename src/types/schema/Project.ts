import { VideoFileSchema } from './VideoFile';
import { TimelineSchema } from './Timeline';

export interface ProjectSchema {
  // Project identification
  id: string;                    // Project UUID
  name: string;                  // Project name
  description?: string;          // Project description
  
  // Project content
  files: VideoFileSchema[];      // All project files
  timeline: TimelineSchema;      // Timeline configuration
  
  // Export settings
  exportSettings: ExportSettingsSchema;
  
  // Playback state
  playbackState: PlaybackStateSchema;
  
  // Project metadata
  version: string;               // Schema version for migration
  createdAt: number;
  updatedAt: number;
  lastExportAt?: number;
  resolutionMismatch?: boolean; // New field to indicate resolution mismatch
}

export interface ExportSettingsSchema {
  // Output format
  format: 'mp4' | 'webm';        // Export format
  codec: string;                 // Video codec
  
  // Quality settings
  resolution: ResolutionPreset;  // Output resolution
  quality: QualityPreset;        // Quality preset
  bitrate?: number;              // Custom bitrate
  
  // Speed settings
  speedMultiplier: number;       // Global speed multiplier
  
  // Audio settings
  includeAudio: boolean;         // Include audio (false for MVP)
  audioCodec?: string;           // Audio codec if included
}

export enum ResolutionPreset {
  SD_480P = '480p',
  HD_720P = '720p',
  FHD_1080P = '1080p',
  UHD_4K = '4k'
}

export enum QualityPreset {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  LOSSLESS = 'lossless'
}

export interface PlaybackStateSchema {
  currentTime: number;           // Current playhead position
  isPlaying: boolean;            // Playback state
  previewQuality: 'proxy' | 'high'; // Preview quality
  volume: number;                // Playback volume (0-1)
}