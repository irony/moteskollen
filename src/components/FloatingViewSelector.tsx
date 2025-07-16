import React from 'react';
import { Mic, History } from 'lucide-react';
import { cn } from '@/lib/utils';

type ViewMode = 'live' | 'history';

interface FloatingViewSelectorProps {
  currentView: ViewMode;
  onViewChange: (view: ViewMode) => void;
  className?: string;
}

export const FloatingViewSelector: React.FC<FloatingViewSelectorProps> = ({
  currentView,
  onViewChange,
  className
}) => {
  return (
    <div className={cn(
      "fixed left-1/2 transform -translate-x-1/2 z-50",
      "neu-card-float bg-background/95 backdrop-blur-md",
      "p-1 rounded-full border border-border/20",
      className
    )}>
      <div className="flex items-center space-x-1">
        <button
          onClick={() => onViewChange('live')}
          className={cn(
            "flex items-center space-x-2 px-4 py-2 rounded-full transition-all duration-300",
            "text-sm font-medium",
            currentView === 'live'
              ? "bg-foreground text-background shadow-neu-inset"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
          )}
        >
          <Mic className="w-4 h-4" />
          <span>Live</span>
        </button>
        
        <button
          onClick={() => onViewChange('history')}
          className={cn(
            "flex items-center space-x-2 px-4 py-2 rounded-full transition-all duration-300",
            "text-sm font-medium",
            currentView === 'history'
              ? "bg-foreground text-background shadow-neu-inset"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
          )}
        >
          <History className="w-4 h-4" />
          <span>Historik</span>
        </button>
      </div>
    </div>
  );
};