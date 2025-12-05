import { Film, HelpCircle, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function TopNav() {
  return (
    <header className="h-14 border-b bg-card flex items-center justify-between px-4">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Film className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-semibold text-lg">Timelapse</span>
        </div>
        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
          Beta
        </span>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon">
          <HelpCircle className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="icon">
          <Settings className="w-4 h-4" />
        </Button>
      </div>
    </header>
  );
}
