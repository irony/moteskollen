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
    <div className="relative h-full">
      {/* Central caption overlay */}
      <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-4xl px-4">
        <div className="bg-black/90 backdrop-blur-lg rounded-lg border border-gray-600/50 shadow-2xl">
          <div className="px-6 py-4 min-h-[120px] flex flex-col justify-center">
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

      {/* Timeline protocol view */}
      <div className="min-h-screen pt-8 pb-32">
        <div className="max-w-4xl mx-auto px-4">
          <ScrollArea className="h-[calc(100vh-8rem)]">
            <div className="space-y-6">
              {segments.length === 0 ? (
                <div className="text-center text-muted-foreground py-24">
                  <div className="space-y-4">
                    <div className="w-16 h-16 mx-auto rounded-full bg-muted/50 flex items-center justify-center">
                      <Volume2 className="w-8 h-8" />
                    </div>
                    <h3 className="text-lg font-medium">Protokollet kommer att visas här</h3>
                    <p className="text-sm">När du startar inspelning kommer alla uttalanden att visas i en tidslinje</p>
                  </div>
                </div>
              ) : (
                segments.map((segment, index) => (
                  <div key={segment.id} className="flex gap-6 group">
                    {/* Timestamp */}
                    <div className="flex-shrink-0 w-20 pt-1">
                      <div className="text-xs text-muted-foreground font-mono text-right">
                        {formatTimestamp(segment.timestamp)}
                      </div>
                    </div>
                    
                    {/* Timeline line */}
                    <div className="flex-shrink-0 flex flex-col items-center pt-1">
                      <div className={`w-3 h-3 rounded-full transition-colors ${
                        segment.isLocal ? 'bg-blue-500' : 'bg-green-500'
                      }`} />
                      {index < segments.length - 1 && (
                        <div className="w-px h-8 bg-border mt-2" />
                      )}
                    </div>
                    
                    {/* Speech bubble */}
                    <div className="flex-1 min-w-0">
                      <div className={`relative p-4 rounded-lg transition-all duration-300 ${
                        segment.text.endsWith('...') ? 'animate-pulse' : ''
                      } ${segment.isLocal ? 'bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800/30' : 'bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800/30'} border`}>
                        {/* Arrow pointing to timeline */}
                        <div className={`absolute left-0 top-4 w-0 h-0 border-t-[6px] border-b-[6px] border-r-[8px] border-transparent ${
                          segment.isLocal ? 'border-r-blue-50 dark:border-r-blue-950/30' : 'border-r-green-50 dark:border-r-green-950/30'
                        } -translate-x-2`} />
                        
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Badge variant="outline" className={`text-xs ${
                              segment.isLocal ? 'text-blue-600 dark:text-blue-400' : 'text-green-600 dark:text-green-400'
                            }`}>
                              {segment.isLocal ? 'Lokal AI' : 'Berget AI'}
                              {segment.confidence && (
                                <span className="ml-1">
                                  {Math.round(segment.confidence * 100)}%
                                </span>
                              )}
                            </Badge>
                          </div>
                          
                          <p className="text-sm leading-relaxed text-foreground">
                            {segment.text || 'Bearbetar ljud...'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      </div>

      {/* Audio level indicator when recording */}
      {isActive && (
        <div className="fixed bottom-8 right-8 z-40">
          <div className="bg-background/90 backdrop-blur-md rounded-lg border border-border/30 p-3 shadow-lg">
            <div className="flex items-center space-x-2">
              <Volume2 className="w-4 h-4 text-success" />
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
          </div>
        </div>
      )}
    </div>
  );
};