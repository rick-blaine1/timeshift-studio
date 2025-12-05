import { useEditorState } from '@/hooks/useEditorState';
import { LandingScreen } from '@/components/editor/LandingScreen';
import { TopNav } from '@/components/editor/TopNav';
import { EditorWorkspace } from '@/components/editor/EditorWorkspace';

const Index = () => {
  const { state, actions } = useEditorState();
  const hasFiles = state.files.length > 0;

  if (!hasFiles) {
    return (
      <LandingScreen
        onFilesAdded={actions.addFiles}
        onLoadSample={actions.loadSampleData}
      />
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <TopNav />
      <EditorWorkspace />
    </div>
  );
};

export default Index;
