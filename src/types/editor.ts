import { z } from 'zod';
import { VideoFileSchemaValidator, TimelineClipSchemaValidator, ProjectSchemaValidator, ExportSettingsSchemaValidator } from './schema/validation';

export type VideoFile = z.infer<typeof VideoFileSchemaValidator>;

export type TimelineClip = z.infer<typeof TimelineClipSchemaValidator>;

export type ProjectState = z.infer<typeof ProjectSchemaValidator>;

export type ExportSettings = z.infer<typeof ExportSettingsSchemaValidator>;

export type ExportStatus = 'idle' | 'preparing' | 'encoding' | 'packaging' | 'done' | 'error';

export type PreviewQuality = 'proxy' | 'high';
