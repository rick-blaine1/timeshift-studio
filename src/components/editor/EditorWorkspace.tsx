import { useState } from 'react';
import { FileSidebar } from './FileSidebar';
import { VideoPreview } from './VideoPreview';
import { Timeline } from './Timeline';
import { ControlsPanel } from './ControlsPanel';
import { ExportModal } from './ExportModal';
import { useEditorState } from '@/hooks/useEditorState';
import { toast } from '@/hooks/use-toast';

export function EditorWorkspace() {
  const { state, actions, computed } = useEditorState();
  const [isExportOpen, setIsExportOpen] = useState(false);

  const handleClearProject = () => {
    if (confirm('Are you sure you want to clear this project? This cannot be undone.')) {
      actions.clearProject();
      toast({
        title: 'Project cleared',
        description: 'All files and timeline clips have been removed.',
      });
    }
  };

  const handleRemoveFile = (fileId: string) => {
    actions.removeFile(fileId);
    toast({
      title: 'File removed',
      description: 'The file has been removed from your project.',
    });
  };

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      {/* Left Sidebar - Files */}
      <div className="w-80 flex-shrink-0">
        <FileSidebar
          files={state.files}
          onAddFiles={actions.addFiles}
          onUpdateFiles={actions.updateFiles}
          onRemoveFile={handleRemoveFile}
          onAddToTimeline={actions.addToTimeline}
        />
      </div>

      {/* Main Panel - Preview + Timeline */}
      <div className="flex-1 flex flex-col min-w-0 bg-surface p-4">
        <div className="flex-1 min-h-0">
          <VideoPreview
            timeline={state.timeline.clips}
            files={state.files}
            currentTime={state.playbackState.currentTime}
            isPlaying={state.playbackState.isPlaying}
            speedMultiplier={state.exportSettings.speedMultiplier}
            previewQuality={state.playbackState.previewQuality}
            totalDuration={computed.totalDuration}
            outputDuration={computed.outputDuration}
            onTimeChange={actions.setCurrentTime}
            onTogglePlayback={actions.togglePlayback}
          />
        </div>

        <div className="mt-4 pt-4 border-t">
          <Timeline
            clips={state.timeline.clips}
            files={state.files}
            currentTime={state.playbackState.currentTime}
            totalDuration={computed.totalDuration}
            onRemoveClip={actions.removeFromTimeline}
            onReorderClips={actions.reorderTimeline}
            onTimeChange={actions.setCurrentTime}
            onDropFile={actions.addToTimeline}
          />
        </div>
      </div>

      {/* Right Panel - Controls */}
      <div className="w-72 flex-shrink-0">
        <ControlsPanel
          speedMultiplier={state.exportSettings.speedMultiplier}
          previewQuality={state.playbackState.previewQuality}
          hasContent={state.timeline.clips.length > 0}
          onSpeedChange={actions.setSpeedMultiplier}
          onQualityChange={actions.setPreviewQuality}
          onExport={() => setIsExportOpen(true)}
          onClearProject={handleClearProject}
        />
      </div>

      {/* Export Modal */}
      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        outputDuration={computed.outputDuration}
        resolution={state.files[0] ? `${state.files[0].width}x${state.files[0].height}` : '1920x1080'}
        clipCount={state.timeline.clips.length}
        clips={state.timeline.clips}
        files={state.files}
        exportSettings={state.exportSettings}
      />
    </div>
  );
}
