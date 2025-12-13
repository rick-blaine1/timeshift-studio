import { useState, useCallback, useRef } from 'react';
import { Upload, Film, Plus, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { VideoFileStatus } from '@/types/schema/VideoFile';
import { useToast } from '@/hooks/use-toast';
import { z } from 'zod';
import { VideoFileSchemaValidator } from '@/types/schema/validation';
import { extractVideoMetadata } from '@/utils/videoMetadata';
import { generateThumbnail } from '@/utils/thumbnailGenerator';
import { storageService } from '@/services/storage';

interface UploadAreaProps {
  onFilesAdded: (files: z.infer<typeof VideoFileSchemaValidator>[]) => void;
  onFilesUpdated?: (files: z.infer<typeof VideoFileSchemaValidator>[]) => void;
  variant?: 'full' | 'compact';
}

const MAX_FILE_SIZE_BYTES = 1 * 1024 * 1024 * 1024; // 1GB

export function UploadArea({ onFilesAdded, onFilesUpdated, variant = 'full' }: UploadAreaProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFiles = useCallback(async (fileList: FileList | null) => {
    console.log('[UploadArea] handleFiles called with', fileList?.length, 'files');
    if (!fileList || fileList.length === 0) return;

    const newVideoFiles: z.infer<typeof VideoFileSchemaValidator>[] = [];
    const errors: string[] = [];

    for (const file of Array.from(fileList)) {
      // 1. File type validation
      if (!['video/mp4', 'video/webm'].includes(file.type)) {
        errors.push(`Invalid file type: ${file.name}. Only MP4 and WebM are supported.`);
        continue;
      }

      // 2. File size validation (1GB limit)
      if (file.size > MAX_FILE_SIZE_BYTES) {
        errors.push(`File too large: ${file.name} exceeds the 1GB limit.`);
        continue;
      }

      try {
        // Generate proper UUID
        const fileId = crypto.randomUUID();
        
        // Set initial status to processing
        const initialVideoFile = {
          id: fileId,
          name: file.name,
          size: file.size,
          type: file.type,
          lastModified: file.lastModified,
          duration: 0, // Will be updated after metadata extraction
          width: 0, // Will be updated after metadata extraction
          height: 0, // Will be updated after metadata extraction
          framerate: 30, // Default value, will be updated if available
          thumbnail: '', // Will be updated after thumbnail generation
          thumbnailTimestamp: 0,
          status: VideoFileStatus.PROCESSING,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        // Validate initial structure
        const validatedFile = VideoFileSchemaValidator.parse(initialVideoFile);
        newVideoFiles.push(validatedFile);

        // Process metadata and thumbnail asynchronously
        const updateCallback = onFilesUpdated || onFilesAdded;
        console.log('[UploadArea] Using update callback:', updateCallback === onFilesUpdated ? 'onFilesUpdated' : 'onFilesAdded');
        processVideoFile(file, validatedFile, updateCallback).catch(error => {
          console.error(`Failed to process ${file.name}:`, error);
          toast({
            variant: 'destructive',
            title: 'Processing Error',
            description: `Failed to process ${file.name}: ${error.message}`,
          });
        });

      } catch (e) {
        console.error('Validation error:', e);
        errors.push(`Failed to process ${file.name}.`);
      }
    }

    if (newVideoFiles.length > 0) {
      console.log('[UploadArea] Calling onFilesAdded with', newVideoFiles.length, 'files');
      onFilesAdded(newVideoFiles);
    }

    if (errors.length > 0) {
      errors.forEach(msg => {
        toast({
          variant: 'destructive',
          title: 'Upload Error',
          description: msg,
        });
      });
    }
  }, [onFilesAdded, onFilesUpdated, toast]);

  // Async function to process video metadata and thumbnail
  const processVideoFile = async (
    file: File,
    videoFile: z.infer<typeof VideoFileSchemaValidator>,
    onUpdate: (files: z.infer<typeof VideoFileSchemaValidator>[]) => void
  ) => {
    try {
      // Extract video metadata
      const metadata = await extractVideoMetadata(file);
      
      // Generate thumbnail
      const thumbnail = await generateThumbnail(file, 5); // Extract at 5 seconds
      
      // Store video file in IndexedDB
      let indexedDBKey: string | undefined;
      try {
        // Create a proper VideoFileSchema object for storage
        const videoFileForStorage = {
          id: videoFile.id,
          name: videoFile.name,
          size: videoFile.size,
          type: videoFile.type,
          lastModified: videoFile.lastModified,
          duration: metadata.duration || 0,
          width: metadata.width || 0,
          height: metadata.height || 0,
          framerate: metadata.framerate || 30,
          bitrate: metadata.bitrate,
          codec: metadata.codec,
          thumbnail: thumbnail,
          thumbnailTimestamp: 5,
          status: videoFile.status,
          indexedDBKey: videoFile.id,
          fileHandle: undefined,
          createdAt: videoFile.createdAt,
          updatedAt: Date.now(),
        };
        
        await storageService.saveVideoFile(videoFileForStorage, file);
        indexedDBKey = videoFile.id; // Use the file ID as the storage key
        
        // Also save thumbnail separately for quick access
        await storageService.saveThumbnail(videoFile.id, thumbnail);
      } catch (storageError) {
        console.warn('Failed to save video to IndexedDB:', storageError);
        // Continue without storage - file will be processed from memory
      }
      
      // Try to get File System Access API handle for better performance
      let fileHandle: FileSystemFileHandle | undefined;
      if ('showOpenFilePicker' in window && file instanceof File) {
        // Note: We can't get the handle from a dropped file, only from picker
        // This is a limitation of the File System Access API
        fileHandle = undefined;
      }
      
      // Update the video file with extracted data
      const updatedVideoFile = VideoFileSchemaValidator.parse({
        ...videoFile,
        duration: metadata.duration || 0,
        width: metadata.width || 0,
        height: metadata.height || 0,
        framerate: metadata.framerate || 30,
        bitrate: metadata.bitrate,
        codec: metadata.codec,
        thumbnail: thumbnail,
        thumbnailTimestamp: 5,
        status: VideoFileStatus.READY,
        indexedDBKey: indexedDBKey,
        fileHandle: fileHandle,
        updatedAt: Date.now(),
      });

      // Notify parent component of the update
      onUpdate([updatedVideoFile]);
      
    } catch (error) {
      // Update status to error
      const errorVideoFile = VideoFileSchemaValidator.parse({
        ...videoFile,
        status: VideoFileStatus.ERROR,
        updatedAt: Date.now(),
      });
      
      onUpdate([errorVideoFile]);
      throw error;
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files);
    e.target.value = '';
  }, [handleFiles]);

  if (variant === 'compact') {
    return (
      <>
        <input
          ref={fileInputRef}
          type="file"
          accept="video/mp4,video/webm"
          multiple
          className="hidden"
          onChange={handleInputChange}
        />
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => fileInputRef.current?.click()}
        >
          <Plus className="w-4 h-4 mr-2" />
          Add clips
        </Button>
      </>
    );
  }

  return (
    <div
      className={cn(
        'relative flex flex-col items-center justify-center p-12 rounded-xl border-2 border-dashed transition-all duration-200',
        isDragging
          ? 'border-primary bg-primary/5 scale-[1.01]'
          : 'border-border hover:border-primary/50 hover:bg-muted/50'
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className={cn(
        'flex items-center justify-center w-16 h-16 rounded-full mb-6 transition-colors',
        isDragging ? 'bg-primary/20' : 'bg-muted'
      )}>
        {isDragging ? (
          <Upload className="w-8 h-8 text-primary animate-pulse-soft" />
        ) : (
          <Film className="w-8 h-8 text-muted-foreground" />
        )}
      </div>

      <h3 className="text-lg font-semibold mb-2">
        {isDragging ? 'Drop your clips here' : 'Upload video clips'}
      </h3>

      <p className="text-sm text-muted-foreground mb-6 text-center max-w-sm">
        Drag and drop your video files, or click to browse.
        <br />
        <span className="text-xs">Supports MP4 and WebM files (Max 1GB)</span>
      </p>

      <label className="cursor-pointer">
        <input
          type="file"
          accept="video/mp4,video/webm"
          multiple
          className="hidden"
          onChange={handleInputChange}
        />
        <Button size="lg" className="shadow-card hover:shadow-card-hover">
          <Upload className="w-4 h-4 mr-2" />
          Choose files
        </Button>
      </label>

      <p className="text-xs text-muted-foreground mt-6 flex items-center gap-1">
        <span className="inline-block w-2 h-2 rounded-full bg-success" />
        Files never leave your device
      </p>
    </div>
  );
}
