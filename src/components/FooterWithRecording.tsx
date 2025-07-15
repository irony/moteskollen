import React from 'react';
import { Button } from '@/components/ui/button';
import { History, Mic, Square, Upload } from 'lucide-react';

interface FooterWithRecordingProps {
  isRecording: boolean;
  isPaused: boolean;
  audioLevel: number;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onPauseRecording: () => void;
  onResumeRecording: () => void;
  onShowHistory: () => void;
  onFileUpload: (file: File) => void;
  disabled?: boolean;
}

export const FooterWithRecording: React.FC<FooterWithRecordingProps> = ({
  isRecording,
  isPaused,
  audioLevel,
  onStartRecording,
  onStopRecording,
  onPauseRecording,
  onResumeRecording,
  onShowHistory,
  onFileUpload,
  disabled = false
}) => {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileUpload(file);
    }
  };

  const pulseScale = 1 + (audioLevel * 0.1);
  const pulseOpacity = 0.6 + (audioLevel * 0.4);

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-background/80 backdrop-blur-md border-t border-border/30 safe-area-pb">
      <div className="max-w-4xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Vänster: Historik */}
          <Button
            variant="ghost"
            size="sm"
            onClick={onShowHistory}
            className="flex items-center space-x-2 text-muted-foreground hover:text-foreground transition-colors rounded-xl"
          >
            <History className="w-4 h-4" />
            <span className="hidden sm:inline">Historik</span>
          </Button>

          {/* Mitten: Inspelningsknapp */}
          <div className="flex items-center space-x-4">
            {/* Uppladdningsknapp */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center space-x-2 text-muted-foreground hover:text-foreground transition-colors rounded-xl"
            >
              <Upload className="w-4 h-4" />
              <span className="hidden sm:inline">Ladda upp</span>
            </Button>

            {/* Huvudinspelningsknapp */}
            <div className="relative">
              {/* Pulse-effekt när inspelning pågår */}
              {isRecording && !isPaused && (
                <div 
                  className="absolute inset-0 rounded-full bg-red-500/20 animate-ping"
                  style={{ 
                    transform: `scale(${pulseScale})`,
                    opacity: pulseOpacity,
                    animationDuration: '1.5s'
                  }}
                />
              )}
              
              {/* Huvudknapp */}
              <Button
                onClick={
                  isRecording 
                    ? (isPaused ? onResumeRecording : onPauseRecording)
                    : onStartRecording
                }
                disabled={disabled}
                className={`
                  relative z-10 w-16 h-16 rounded-full transition-all duration-300 shadow-lg
                  ${isRecording && !isPaused
                    ? 'bg-red-500 hover:bg-red-600 shadow-red-500/25 shadow-2xl' 
                    : isRecording && isPaused
                    ? 'bg-yellow-500 hover:bg-yellow-600 shadow-yellow-500/25'
                    : 'bg-primary hover:bg-primary/90 shadow-primary/25'
                  }
                `}
              >
                {isRecording ? (
                  isPaused ? (
                    <Mic className="w-6 h-6 text-white" />
                  ) : (
                    <div className="w-4 h-4 bg-white rounded-sm" />
                  )
                ) : (
                  <Mic className="w-6 h-6 text-white" />
                )}
              </Button>

              {/* Lydnivå-visualisering */}
              {isRecording && !isPaused && (
                <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2">
                  <div className="flex space-x-1">
                    {[...Array(3)].map((_, i) => (
                      <div
                        key={i}
                        className="w-1 bg-red-500 rounded-full transition-all duration-150"
                        style={{
                          height: `${4 + (audioLevel * 8)}px`,
                          opacity: audioLevel > (i * 0.33) ? 1 : 0.3
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Stoppa-knapp (alltid synlig under inspelning) */}
            {isRecording && (
              <Button
                onClick={onStopRecording}
                variant="destructive"
                size="sm"
                className="rounded-xl shadow-lg border-0"
              >
                <Square className="w-4 h-4 mr-2" fill="currentColor" />
                Stoppa
              </Button>
            )}
          </div>

          {/* Höger: Status */}
          <div className="text-right">
            <div className="text-xs text-muted-foreground">
              {isRecording ? (
                <div className="flex items-center space-x-1">
                  <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                  <span>{isPaused ? 'Pausad' : 'Spelar in'}</span>
                </div>
              ) : (
                <span>Klar att spela in</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Gömd filinput */}
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*,.pdf,.doc,.docx,.txt"
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  );
};