import { VideoFile } from '@/types/editor';
import { FileCard } from './FileCard';
import { UploadArea } from './UploadArea';
import { FolderOpen } from 'lucide-react';

interface FileSidebarProps {
  files: VideoFile[];
  onAddFiles: (files: VideoFile[]) => void;
  onUpdateFiles?: (files: VideoFile[]) => void;
  onRemoveFile: (fileId: string) => void;
  onAddToTimeline: (fileId: string) => void;
  onSpeedChange?: (fileId: string, speed: number) => void;
  resolutionMismatch: boolean; // New prop for resolution mismatch warning
}

export function FileSidebar({ files, onAddFiles, onUpdateFiles, onRemoveFile, onAddToTimeline, onSpeedChange, resolutionMismatch }: FileSidebarProps) {
  return (
    <div className="flex flex-col h-full bg-card border-r">
      <div className="p-4 border-b">
        <h2 className="font-semibold flex items-center gap-2">
          <FolderOpen className="w-4 h-4" />
          Project Files
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          {files.length} clip{files.length !== 1 ? 's' : ''}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin p-3 space-y-2">
        {files.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            <p>No files yet</p>
            <p className="text-xs mt-1">Upload clips to get started</p>
          </div>
        ) : (
          files.map(file => (
            <FileCard
              key={file.id}
              file={file}
              onRemove={() => onRemoveFile(file.id)}
              onAddToTimeline={() => onAddToTimeline(file.id)}
              onSpeedChange={onSpeedChange}
            />
          ))
        )}
      </div>

      <div className="p-3 border-t">
        <UploadArea
          onFilesAdded={onAddFiles}
          onFilesUpdated={onUpdateFiles}
          variant="compact"
          resolutionMismatch={resolutionMismatch}
        />
      </div>
    </div>
  );
}
