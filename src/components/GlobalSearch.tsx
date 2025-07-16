import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Search, 
  MessageSquare, 
  History, 
  Mic, 
  Upload,
  Command as CommandIcon,
  ArrowRight
} from 'lucide-react';
import { ChatInterface } from './ChatInterface';

interface GlobalSearchProps {
  onShowHistory: () => void;
  onStartRecording: () => void;
  onFileUpload: (file: File) => void;
  meetingContext?: string;
  meetingsCount: number;
}

export const GlobalSearch: React.FC<GlobalSearchProps> = ({
  onShowHistory,
  onStartRecording,
  onFileUpload,
  meetingContext,
  meetingsCount
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showChat, setShowChat] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Keyboard shortcut för Cmd+K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
        setShowChat(false);
        setSearchQuery('');
      }
      
      // Escape för att stänga
      if (e.key === 'Escape') {
        setIsOpen(false);
        setShowChat(false);
        setSearchQuery('');
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    // Vänta med att aktivera chat tills användaren trycker Enter
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      setShowChat(true);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileUpload(file);
      setIsOpen(false);
    }
  };

  const quickActions = [
    {
      id: 'chat',
      title: 'AI-assistent',
      description: 'Chatta med AI om dina möten',
      icon: MessageSquare,
      action: () => setShowChat(true),
      shortcut: 'Enter'
    },
    {
      id: 'history',
      title: 'Möteshistorik',
      description: `Visa alla ${meetingsCount} möten`,
      icon: History,
      action: () => {
        onShowHistory();
        setIsOpen(false);
      },
      badge: meetingsCount > 0 ? meetingsCount.toString() : undefined
    },
    {
      id: 'record',
      title: 'Starta inspelning',
      description: 'Börja spela in ett nytt möte',
      icon: Mic,
      action: () => {
        onStartRecording();
        setIsOpen(false);
      }
    },
    {
      id: 'upload',
      title: 'Ladda upp fil',
      description: 'Ladda upp ljud eller dokument',
      icon: Upload,
      action: () => {
        fileInputRef.current?.click();
      }
    }
  ];

  const filteredActions = quickActions.filter(action =>
    action.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    action.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <>
      {/* Global sökruta i headern */}
      <Button
        variant="outline"
        onClick={() => setIsOpen(true)}
        className="hidden md:flex items-center space-x-2 text-muted-foreground hover:text-foreground transition-colors w-64 justify-start bg-muted/30 hover:bg-muted/50 border-border/50"
      >
        <Search className="w-4 h-4" />
        <span className="flex-1 text-left">Sök...</span>
        <div className="flex items-center space-x-1">
          <Badge variant="outline" className="text-xs px-1.5 py-0.5">
            <CommandIcon className="w-3 h-3 mr-1" />
            K
          </Badge>
        </div>
      </Button>

      {/* Mobil sökknapp */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(true)}
        className="md:hidden p-2"
      >
        <Search className="w-4 h-4" />
      </Button>

      {/* Sök/Kommando Dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-2xl p-0">
          {!showChat ? (
            // Sök/Kommando-läge
            <div className="p-0">
              {/* Sökruta */}
              <div className="border-b border-border p-4">
                <div className="flex items-center space-x-2">
                  <Search className="w-5 h-5 text-muted-foreground" />
                  <Input
                    placeholder="Sök eller skriv en fråga..."
                    value={searchQuery}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    onKeyDown={handleKeyPress}
                    className="border-0 bg-transparent focus-visible:ring-0 text-lg"
                    autoFocus
                  />
                </div>
              </div>

              {/* Snabbåtgärder */}
              <div className="p-2 max-h-96 overflow-y-auto">
                {filteredActions.map((action) => (
                  <Button
                    key={action.id}
                    variant="ghost"
                    onClick={action.action}
                    className="w-full justify-between h-auto p-3 hover:bg-muted/50"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <action.icon className="w-4 h-4 text-primary" />
                      </div>
                      <div className="text-left">
                        <div className="font-medium text-foreground">{action.title}</div>
                        <div className="text-sm text-muted-foreground">{action.description}</div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {action.badge && (
                        <Badge variant="secondary" className="text-xs">
                          {action.badge}
                        </Badge>
                      )}
                      {action.shortcut && (
                        <Badge variant="outline" className="text-xs">
                          {action.shortcut}
                        </Badge>
                      )}
                      <ArrowRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </Button>
                ))}
              </div>

              {searchQuery && filteredActions.length === 0 && (
                <div className="p-8 text-center text-muted-foreground">
                  <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>Ingen matchning hittades.</p>
                  <p className="text-sm mt-1">Tryck Enter för att chatta med AI istället.</p>
                </div>
              )}

              {/* Tips längst ner */}
              <div className="border-t border-border p-3 bg-muted/30">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center space-x-4">
                    <span>↑↓ Navigera</span>
                    <span>Enter Välj</span>
                    <span>Esc Stäng</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <CommandIcon className="w-3 h-3" />
                    <span>K Öppna</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            // Chat-läge
            <div className="p-0">
              {/* Chat header */}
              <div className="border-b border-border p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <MessageSquare className="w-5 h-5 text-primary" />
                    <h3 className="font-semibold">AI-assistent</h3>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setShowChat(false);
                      setSearchQuery('');
                    }}
                  >
                    ← Tillbaka
                  </Button>
                </div>
              </div>

              {/* Chat interface */}
              <div className="h-96">
                <ChatInterface 
                  meetingContext={meetingContext}
                  className="h-full"
                  initialMessage={searchQuery.trim()}
                />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Gömd filinput */}
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*,.pdf,.doc,.docx,.txt"
        onChange={handleFileSelect}
        className="hidden"
      />
    </>
  );
};