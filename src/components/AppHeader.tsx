import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { User, X } from 'lucide-react';

interface AppHeaderProps {
  title: string;
  badge?: {
    text: string | number;
    variant?: "default" | "secondary" | "destructive" | "outline";
  };
  onClose?: () => void;
  showUserIcon?: boolean;
}

export const AppHeader: React.FC<AppHeaderProps> = ({ 
  title, 
  badge, 
  onClose, 
  showUserIcon = false 
}) => {
  return (
    <div className="flex items-center justify-between p-4 border-b border-border/30">
      <div className="flex items-center space-x-2">
        <h2 className="text-lg font-semibold">{title}</h2>
        {badge && (
          <Badge variant={badge.variant || "secondary"} className="rounded-full">
            {badge.text}
          </Badge>
        )}
      </div>
      <div className="flex items-center space-x-2">
        {showUserIcon && (
          <Button
            variant="ghost"
            size="sm"
            className="rounded-full w-8 h-8 p-0"
          >
            <User className="w-4 h-4" />
          </Button>
        )}
        {onClose && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="rounded-full w-8 h-8 p-0"
          >
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  );
};