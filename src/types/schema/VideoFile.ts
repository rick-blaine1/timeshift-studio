export interface VideoFileSchema {
  // Core identification
  id: string;                    // UUID v4
  name: string;                  // Original filename
  
  // File metadata
  size: number;                  // File size in bytes
  type: string;                  // MIME type
  lastModified: number;          // Timestamp
  
  // Video metadata
  duration: number;              // Duration in seconds
  width: number;                 // Video width in pixels
  height: number;                // Video height in pixels
  framerate: number;             // Frames per second
  bitrate?: number;              // Bitrate in kbps
  codec?: string;                // Video codec
  
  // Processing metadata
  thumbnail: string;             // Base64 encoded thumbnail
  thumbnailTimestamp: number;    // Thumbnail extraction time
  status: VideoFileStatus;       // Processing status
  
  // Storage references
  indexedDBKey?: string;         // IndexedDB storage key
  fileHandle?: FileSystemFileHandle; // File System API handle
  
  // Timestamps
  createdAt: number;             // Upload timestamp
  updatedAt: number;             // Last modification timestamp
}

export enum VideoFileStatus {
  UPLOADING = 'uploading',
  PROCESSING = 'processing',
  READY = 'ready',
  ON_TIMELINE = 'on-timeline',
  ERROR = 'error'
}