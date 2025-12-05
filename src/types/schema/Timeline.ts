export interface TimelineSchema {
  id: string;                    // Timeline UUID
  clips: TimelineClipSchema[];   // Ordered clips
  totalDuration: number;         // Total timeline duration
  createdAt: number;
  updatedAt: number;
}

export interface TimelineClipSchema {
  id: string;                    // Clip UUID
  fileId: string;                // Reference to VideoFile
  
  // Timeline positioning
  startTime: number;             // Start time on timeline (seconds)
  duration: number;              // Clip duration (seconds)
  order: number;                 // Clip order index
  
  // Clip modifications
  trimStart?: number;            // Trim from start (seconds)
  trimEnd?: number;              // Trim from end (seconds)
  speedMultiplier?: number;      // Individual clip speed override
  
  // Metadata
  createdAt: number;
  updatedAt: number;
}