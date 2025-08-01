import React from 'react';
import { Button } from '@/components/ui/button';
import { History, Mic, Square, Upload } from 'lucide-react';
import { GDPRInfo } from './GDPRInfo';

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
  
  const handleFileSelect = () => {
    onFileUpload(new File([], '')); // Dummy file för att trigga dialog
  };

  const pulseScale = 1 + (audioLevel * 0.1);
  const pulseOpacity = 0.6 + (audioLevel * 0.4);

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-background/80 backdrop-blur-md border-t border-border/30 safe-area-pb">
      <div className="max-w-4xl mx-auto px-6 py-2">
        <div className="flex items-center justify-center relative">
          {/* Vänster: Uppladdning */}
          <div className="absolute left-0 flex items-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleFileSelect}
              className="flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors rounded-xl w-10 h-10"
            >
              <Upload className="w-4 h-4" />
            </Button>
          </div>

          {/* Mitten: Inspelningsknapp (kan gå över kanten) */}
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
              onClick={isRecording ? onStopRecording : onStartRecording}
              disabled={disabled}
              className={`
                relative z-10 w-16 h-16 rounded-full transition-all duration-300 shadow-lg
                ${isRecording
                  ? 'bg-red-500 hover:bg-red-600 shadow-red-500/25 shadow-2xl' 
                  : 'bg-primary hover:bg-primary/90 shadow-primary/25'
                }
              `}
            >
              {isRecording ? (
                <Square className="w-6 h-6 text-white" fill="currentColor" />
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


          {/* Höger: Status och GDPR */}
          <div className="absolute right-0 flex items-center space-x-3">
            {/* GDPR badge */}
            <GDPRInfo>
              <div className="flex items-center space-x-1 text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
                <div className="w-5 h-3 bg-blue-600 rounded-sm flex items-center justify-center">
                  <span className="text-[8px] font-bold text-white">EU</span>
                </div>
                <span className="hidden sm:inline">GDPR</span>
              </div>
            </GDPRInfo>
            
            {/* Status */}
            <div className="text-xs text-muted-foreground">
              {isRecording ? (
                <div className="flex items-center space-x-1">
                  <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                  <span>{isPaused ? 'Pausad' : 'Spelar in'}</span>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};
