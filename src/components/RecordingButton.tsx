import React from 'react';
import { Mic, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface RecordingButtonProps {
  isRecording: boolean;
  audioLevel: number;
  onStartRecording: () => void;
  onStopRecording: () => void;
  disabled?: boolean;
}

export const RecordingButton: React.FC<RecordingButtonProps> = ({
  isRecording,
  audioLevel,
  onStartRecording,
  onStopRecording,
  disabled = false
}) => {
  const buttonSize = 120;
  const pulseOpacity = 0.3 + (audioLevel * 0.7);

  return (
    <div className="flex flex-col items-center space-y-4">
      <div className="relative">
        {/* Pulse-effekt när inspelning pågår */}
        {isRecording && (
          <div 
            className="absolute inset-0 rounded-full bg-recording animate-ping"
            style={{ 
              opacity: pulseOpacity,
              animationDuration: '1s'
            }}
          />
        )}
        
        {/* Huvudknapp */}
        <Button
          onClick={isRecording ? onStopRecording : onStartRecording}
          disabled={disabled}
          size="lg"
          className={`
            relative z-10 rounded-full transition-all duration-300
            ${isRecording 
              ? 'bg-recording hover:bg-recording-pulse shadow-recording' 
              : 'bg-primary hover:bg-primary-dark shadow-elegant'
            }
          `}
          style={{ 
            width: buttonSize, 
            height: buttonSize,
            fontSize: '2rem'
          }}
        >
          {isRecording ? (
            <Square className="w-8 h-8" fill="currentColor" />
          ) : (
            <Mic className="w-8 h-8" />
          )}
        </Button>

        {/* Volymvisualisering */}
        {isRecording && (
          <div className="absolute -bottom-4 left-1/2 transform -translate-x-1/2">
            <div className="flex space-x-1">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="w-1 bg-recording transition-all duration-150"
                  style={{
                    height: `${8 + (audioLevel * 20)}px`,
                    opacity: audioLevel > (i * 0.2) ? 1 : 0.3
                  }}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Status text */}
      <div className="text-center">
        {isRecording ? (
          <div className="space-y-1">
            <p className="text-lg font-medium text-recording">
              🔴 Spelar in...
            </p>
            <p className="text-sm text-muted-foreground">
              Tryck för att stoppa eller vänta på tystnad
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            <p className="text-lg font-medium">
              Tryck för att börja spela in
            </p>
            <p className="text-sm text-muted-foreground">
              Inspelningen stoppas automatiskt vid tystnad
            </p>
          </div>
        )}
      </div>
    </div>
  );
};