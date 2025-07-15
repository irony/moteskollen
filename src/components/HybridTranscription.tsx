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
}

export const HybridTranscription: React.FC<HybridTranscriptionProps> = ({
  segments,
  audioLevel,
  isActive
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
    <Card className="shadow-elegant min-h-96">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl">TV-Caption Transkribering</CardTitle>
          <div className="flex items-center space-x-2">
            {isActive ? (
              <>
                <Volume2 className="w-4 h-4 text-success" />
                <Badge variant="default" className="bg-success animate-pulse">
                  LIVE
                </Badge>
              </>
            ) : (
              <>
                <VolumeX className="w-4 h-4 text-muted-foreground" />
                <Badge variant="outline">
                  Inaktiv
                </Badge>
              </>
            )}
          </div>
        </div>
        
        {/* Ljudnivå-indikator */}
        {isActive && (
          <div className="flex items-center space-x-2 mt-2">
            <span className="text-xs text-muted-foreground">Ljudnivå:</span>
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

        {/* Info om hybrid-funktion */}
        <div className="flex items-center space-x-4 text-xs text-muted-foreground mt-2">
          <div className="flex items-center space-x-1">
            <Zap className="w-3 h-3 text-blue-400" />
            <span>Snabb (Speech API)</span>
          </div>
          <div className="flex items-center space-x-1">
            <Globe className="w-3 h-3 text-green-400" />
            <span>Exakt (Berget AI)</span>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {/* TV-Caption container */}
        <div className="bg-black/95 backdrop-blur rounded-lg p-6 min-h-[160px] relative border border-gray-600">
          {!isActive && segments.length === 0 ? (
            <div className="text-center text-white/70 py-8">
              <p className="text-lg">Starta inspelning för TV-caption transkribering</p>
              <p className="text-sm mt-2">Visar senaste 2 rader som på TV</p>
            </div>
          ) : isActive && segments.length === 0 ? (
            <div className="text-center text-white/70 py-8">
              <div className="space-y-2">
                <Loader2 className="w-6 h-6 mx-auto animate-spin" />
                <p className="text-lg">Lyssnar efter tal...</p>
                <p className="text-sm">Pratar du svenska? Säg något!</p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {displaySegments.map((segment, index) => (
                <div key={segment?.id || `empty-${index}`} className="min-h-[32px] flex items-center">
                  {segment ? (
                    <div className="flex items-center gap-3 w-full">
                      {/* Status ikon */}
                      <div className="flex-shrink-0">
                        {segment.isLocal ? (
                          <Zap className="w-4 h-4 text-blue-400" />
                        ) : (
                          <Globe className="w-4 h-4 text-green-400" />
                        )}
                      </div>
                      
                      {/* Text - TV-caption stil */}
                      <div className="flex-1">
                        <p className={`text-lg font-semibold leading-tight transition-all duration-300 ${
                          index === displaySegments.length - 1 
                            ? 'text-white' 
                            : 'text-white/80'
                        } ${segment.text.endsWith('...') ? 'animate-pulse' : ''}`}>
                          {segment.text}
                        </p>
                      </div>
                      
                      {/* Metadata */}
                      <div className="flex-shrink-0 text-right">
                        <div className="text-xs text-white/60">
                          {formatTimestamp(segment.timestamp)}
                        </div>
                        {segment.confidence && (
                          <div className={`text-xs font-mono mt-1 ${getConfidenceColor(segment.confidence)}`}>
                            {Math.round(segment.confidence * 100)}%
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    // Tom rad för spacing
                    <div className="w-full h-8"></div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Status info */}
        <div className="mt-4 text-sm text-muted-foreground">
          <div className="flex items-center justify-between">
            <span>
              Totalt {segments.length} segment{segments.length !== 1 ? '' : ''} • 
              Visar senaste 2 rader
            </span>
            <span className="text-xs">
              TV-Caption stil
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};