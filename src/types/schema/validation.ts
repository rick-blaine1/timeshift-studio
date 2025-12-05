import { z } from 'zod';
import { VideoFileStatus, VideoFileSchema } from './VideoFile';
import { TimelineSchema, TimelineClipSchema } from './Timeline';
import { ProjectSchema, ExportSettingsSchema, PlaybackStateSchema, ResolutionPreset, QualityPreset } from './Project';

export const VideoFileSchemaValidator = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  size: z.number().positive(),
  type: z.string().regex(/^video\//),
  lastModified: z.number(),
  duration: z.number().positive(),
  width: z.number().positive(),
  height: z.number().positive(),
  framerate: z.number().positive(),
  bitrate: z.number().optional(),
  codec: z.string().optional(),
  thumbnail: z.string(),
  thumbnailTimestamp: z.number(),
  status: z.nativeEnum(VideoFileStatus),
  indexedDBKey: z.string().optional(),
  fileHandle: z.any().optional(), // FileSystemFileHandle is not directly serializable/validatable by Zod
  createdAt: z.number(),
  updatedAt: z.number(),
});

export const TimelineClipSchemaValidator = z.object({
  id: z.string().uuid(),
  fileId: z.string().uuid(),
  startTime: z.number(),
  duration: z.number().positive(),
  order: z.number().int().min(0),
  trimStart: z.number().optional(),
  trimEnd: z.number().optional(),
  speedMultiplier: z.number().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export const TimelineSchemaValidator = z.object({
  id: z.string().uuid(),
  clips: z.array(TimelineClipSchemaValidator),
  totalDuration: z.number(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export const ExportSettingsSchemaValidator = z.object({
  format: z.enum(['mp4', 'webm']),
  codec: z.string(),
  resolution: z.nativeEnum(ResolutionPreset),
  quality: z.nativeEnum(QualityPreset),
  bitrate: z.number().optional(),
  speedMultiplier: z.number(),
  includeAudio: z.boolean(),
  audioCodec: z.string().optional(),
});

export const PlaybackStateSchemaValidator = z.object({
  currentTime: z.number(),
  isPlaying: z.boolean(),
  previewQuality: z.enum(['proxy', 'high']),
  volume: z.number().min(0).max(1),
});

export const ProjectSchemaValidator = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().optional(),
  files: z.array(VideoFileSchemaValidator),
  timeline: TimelineSchemaValidator,
  exportSettings: ExportSettingsSchemaValidator,
  playbackState: PlaybackStateSchemaValidator,
  version: z.string(),
  createdAt: z.number(),
  updatedAt: z.number(),
  lastExportAt: z.number().optional(),
});

// Validation helper functions
export function validateVideoFile(data: unknown): z.infer<typeof VideoFileSchemaValidator> {
  return VideoFileSchemaValidator.parse(data);
}

export function validateTimeline(data: unknown): z.infer<typeof TimelineSchemaValidator> {
  return TimelineSchemaValidator.parse(data);
}

export function validateProject(data: unknown): z.infer<typeof ProjectSchemaValidator> {
  return ProjectSchemaValidator.parse(data);
}