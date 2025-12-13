import { useCallback, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { z } from 'zod';
import { VideoFileSchemaValidator } from '@/types/schema/validation';
import { VideoFileStatus } from '@/types/schema/VideoFile';
import { extractVideoMetadata } from '@/utils/videoMetadata';
import { generateThumbnail } from '@/utils/thumbnailGenerator';
import { storageService } from '@/services/storage';

const MAX_FILE_SIZE_BYTES = 1 * 1024 * 1024 * 1024; // 1GB

interface UseFileUploadOptions {
  onFilesAdded: (files: z.infer<typeof VideoFileSchemaValidator>[], originalFiles?: Map<string, File>) => void;
  onFilesUpdated?: (files: z.infer<typeof VideoFileSchemaValidator>[]) => void;
}

export function useFileUpload({ onFilesAdded, onFilesUpdated }: UseFileUploadOptions) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Async function to process video metadata and thumbnail
  const processVideoFile = useCallback(async (
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
  }, []);

  const handleFiles = useCallback(async (fileList: FileList | null) => {
    console.log('[useFileUpload] handleFiles called with', fileList?.length, 'files');
    if (!fileList || fileList.length === 0) return;

    const newVideoFiles: z.infer<typeof VideoFileSchemaValidator>[] = [];
    const originalFilesMap = new Map<string, File>();
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
        
        // Store original File object for immediate playback
        originalFilesMap.set(fileId, file);

        // Process metadata and thumbnail asynchronously
        const updateCallback = onFilesUpdated || onFilesAdded;
        console.log('[useFileUpload] Using update callback:', updateCallback === onFilesUpdated ? 'onFilesUpdated' : 'onFilesAdded');
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
      console.log('[useFileUpload] Calling onFilesAdded with', newVideoFiles.length, 'files and original File objects');
      onFilesAdded(newVideoFiles, originalFilesMap);
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
  }, [onFilesAdded, onFilesUpdated, toast, processVideoFile]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files);
    e.target.value = '';
  }, [handleFiles]);

  const handleClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  return {
    fileInputRef,
    handleFiles,
    handleInputChange,
    handleClick,
  };
}