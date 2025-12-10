import { useEditorState } from '@/hooks/useEditorState';
import { LandingScreen } from '@/components/editor/LandingScreen';
import { TopNav } from '@/components/editor/TopNav';
import { EditorWorkspace } from '@/components/editor/EditorWorkspace';

const Index = () => {
  console.log('[DEBUG] Rendering Index component');
  const { state, actions, computed } = useEditorState();
  const hasFiles = state.files.length > 0;

  if (!hasFiles) {
    console.log('[DEBUG] Rendering LandingScreen');
    return (
      <LandingScreen
        onFilesAdded={actions.addFiles}
        onFilesUpdated={actions.updateFiles}
        onLoadSample={actions.loadSampleData}
      />
    );
  }

  console.log('[DEBUG] Rendering Editor workspace');
  try {
    return (
      <div className="h-screen flex flex-col overflow-hidden">
        <TopNav />
        <EditorWorkspace state={state} actions={actions} computed={computed} />
      </div>
    );
  } catch (error) {
    console.error('[DEBUG] Error rendering Index:', error);
    return (
      <div className="p-4 bg-red-100 text-red-800">
        <h2>Error rendering editor workspace</h2>
        <pre>{error instanceof Error ? error.message : String(error)}</pre>
      </div>
    );
  }
};

export default Index;
