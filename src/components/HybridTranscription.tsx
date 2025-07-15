import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Volume2, VolumeX, Zap, Globe } from 'lucide-react';

interface TranscriptionSegment {
  id: string;
  text: string;
  timestamp: Date;
  isLocal: boolean;
  confidence?: number;
}

interface HybridTranscriptionProps {
  segments: TranscriptionSegment[];
  audioLevel: number;
  isActive: boolean;
  onStartRecording?: () => void;
  onStopRecording?: () => void; // Lägg till callback för att stoppa inspelning
}

export const HybridTranscription: React.FC<HybridTranscriptionProps> = ({
  segments,
  audioLevel,
  isActive,
  onStartRecording,
  onStopRecording
}) => {
  // TV-Caption effekt: visa bara de senaste 2 segmenten
  const recentSegments = segments.slice(-2);
  
  // Om vi bara har ett segment, visa det som den nedre raden
  const displaySegments = recentSegments.length === 1 
    ? [null, recentSegments[0]] 
    : recentSegments.length === 0 
    ? [null, null] 
    : recentSegments;

  const formatTimestamp = (date: Date) => {
    return date.toLocaleTimeString('sv-SE', { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    });
  };

  const getConfidenceColor = (confidence?: number) => {
    if (!confidence) return 'text-muted-foreground';
    if (confidence > 0.8) return 'text-green-400';
    if (confidence > 0.6) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <div className="space-y-4">
      {/* Fast TV-Caption overlay */}
      <div className="fixed bottom-0 left-0 right-0 z-50 p-4">
        <div className="bg-black/90 backdrop-blur-lg rounded-t-lg border border-gray-600/50 shadow-2xl">
          <div className="px-6 py-4 min-h-[120px] flex flex-col justify-end">
            {!isActive && segments.length === 0 ? (
              <div className="text-center text-white/60 py-4">
                <button 
                  onClick={onStartRecording}
                  className="text-lg font-semibold hover:text-white transition-colors cursor-pointer"
                >
                  Tryck för att börja
                </button>
              </div>
            ) : isActive && segments.length === 0 ? (
              <div className="text-center text-white/70 py-4">
                <div className="flex items-center justify-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="text-lg font-semibold">Lyssnar...</span>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {displaySegments.map((segment, index) => (
                  <div key={segment?.id || `empty-${index}`} className="min-h-[36px] flex items-end">
                    {segment ? (
                      <div className="flex items-center gap-3 w-full">
                        {/* Text med stark kontrast och skugga */}
                        <div className="flex-1">
                          <p className={`text-xl font-bold leading-tight transition-all duration-300 drop-shadow-2xl ${
                            index === displaySegments.length - 1 
                              ? 'text-white' 
                              : 'text-white/85'
                          } ${segment.text.endsWith('...') ? 'animate-pulse' : ''}`}
                          style={{
                            textShadow: '2px 2px 4px rgba(0,0,0,0.8), 0px 0px 8px rgba(0,0,0,0.6)'
                          }}>
                            {segment.text}
                          </p>
                        </div>
                        
                        {segment.confidence && (
                          <div className="flex-shrink-0 text-right mb-1">
                            <div className={`text-xs font-mono drop-shadow-lg ${getConfidenceColor(segment.confidence)}`}>
                              {Math.round(segment.confidence * 100)}%
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="w-full h-9"></div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {isActive && (
            <div className="absolute top-3 right-3">
              <Badge 
                variant="destructive" 
                className="animate-pulse text-xs font-bold shadow-lg cursor-pointer hover:bg-destructive/80 transition-colors select-none" 
                onClick={onStopRecording}
                title="Klicka för att stoppa inspelning"
              >
                🔴 LIVE
              </Badge>
            </div>
          )}
        </div>
      </div>

      {/* Huvudkort med kontroller */}
      <Card className="shadow-elegant mb-32">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl">Transkribering</CardTitle>
            <div className="flex items-center space-x-2">
              {isActive ? (
                <Badge variant="default" className="bg-success">
                  Aktiv
                </Badge>
              ) : (
                <Badge variant="outline">
                  Inaktiv
                </Badge>
              )}
            </div>
          </div>
          
          {isActive && (
            <div className="flex items-center space-x-2 mt-2">
              <div className="flex space-x-1">
                {[...Array(10)].map((_, i) => (
                  <div
                    key={i}
                    className={`w-1 h-4 rounded-full transition-all duration-150 ${
                      audioLevel > (i * 0.1) 
                        ? 'bg-success' 
                        : 'bg-muted'
                    }`}
                  />
                ))}
              </div>
            </div>
          )}
        </CardHeader>
      </Card>
    </div>
  );
};