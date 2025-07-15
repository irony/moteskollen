import React from 'react';
import { Mic, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface RecordingButtonProps {
  isRecording: boolean;
  isPaused: boolean;
  audioLevel: number;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onPauseRecording: () => void;
  onResumeRecording: () => void;
  disabled?: boolean;
}

export const RecordingButton: React.FC<RecordingButtonProps> = ({
  isRecording,
  isPaused,
  audioLevel,
  onStartRecording,
  onStopRecording,
  onPauseRecording,
  onResumeRecording,
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
          onClick={
            isRecording 
              ? (isPaused ? onResumeRecording : onPauseRecording)
              : onStartRecording
          }
          disabled={disabled}
          size="lg"
          className={`
            relative z-10 rounded-full transition-all duration-300
            ${isRecording && !isPaused
              ? 'bg-warning hover:bg-warning/90 shadow-recording' 
              : isRecording && isPaused
              ? 'bg-success hover:bg-success/90'
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
            isPaused ? (
              <Mic className="w-8 h-8" />
            ) : (
              "⏸️"
            )
          ) : (
            <Mic className="w-8 h-8" />
          )}
        </Button>

        {/* Stopp-knapp (synlig under inspelning) */}
        {isRecording && (
          <Button
            onClick={onStopRecording}
            variant="outline"
            size="sm"
            className="absolute -bottom-14 left-1/2 transform -translate-x-1/2 bg-background"
          >
            <Square className="w-4 h-4 mr-2" fill="currentColor" />
            Stoppa
          </Button>
        )}

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
      <div className="text-center mt-4">
        {isRecording ? (
          <div className="space-y-1">
            <p className="text-lg font-medium text-recording">
              🔴 {isPaused ? 'Pausad' : 'Live transkribering aktiv'}
            </p>
            <p className="text-sm text-muted-foreground">
              {isPaused 
                ? 'Tryck för att återuppta' 
                : 'Tryck för att pausa eller stoppa längst ner'
              }
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            <p className="text-lg font-medium">
              Starta live transkribering
            </p>
            <p className="text-sm text-muted-foreground">
              Får automatisk syntolkning var 8:e sekund
            </p>
          </div>
        )}
      </div>
    </div>
  );
};