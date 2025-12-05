import { UploadArea } from './UploadArea';
import { VideoFile } from '@/types/editor';
import { Film, Zap, Lock, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface LandingScreenProps {
  onFilesAdded: (files: VideoFile[]) => void;
  onLoadSample: () => void;
}

export function LandingScreen({ onFilesAdded, onLoadSample }: LandingScreenProps) {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="h-14 border-b bg-card flex items-center justify-center">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Film className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-semibold text-lg">Timelapse</span>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex items-center justify-center p-8">
        <div className="max-w-xl w-full animate-fade-in">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold mb-3">
              Create stunning timelapses
            </h1>
            <p className="text-lg text-muted-foreground">
              Upload your clips, arrange them, and export — all in your browser.
            </p>
          </div>

          <UploadArea onFilesAdded={onFilesAdded} />

          <div className="mt-6 text-center">
            <Button variant="link" onClick={onLoadSample} className="text-muted-foreground">
              Or try with sample clips
            </Button>
          </div>

          {/* Features */}
          <div className="mt-12 grid grid-cols-3 gap-6">
            <div className="text-center">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-2">
                <Lock className="w-5 h-5 text-primary" />
              </div>
              <h3 className="text-sm font-medium mb-1">Private</h3>
              <p className="text-xs text-muted-foreground">Files never leave your device</p>
            </div>
            <div className="text-center">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-2">
                <Zap className="w-5 h-5 text-primary" />
              </div>
              <h3 className="text-sm font-medium mb-1">Fast</h3>
              <p className="text-xs text-muted-foreground">Hardware-accelerated encoding</p>
            </div>
            <div className="text-center">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-2">
                <Clock className="w-5 h-5 text-primary" />
              </div>
              <h3 className="text-sm font-medium mb-1">Simple</h3>
              <p className="text-xs text-muted-foreground">No account required</p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-4 text-center text-xs text-muted-foreground border-t">
        Built with modern web technologies • Client-side processing only
      </footer>
    </div>
  );
}
