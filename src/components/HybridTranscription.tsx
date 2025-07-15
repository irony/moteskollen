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
  return (
    <Card className="shadow-elegant min-h-96">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl">Live Transkribering</CardTitle>
          <div className="flex items-center space-x-2">
            {isActive ? (
              <>
                <Volume2 className="w-4 h-4 text-success" />
                <Badge variant="default" className="bg-success">
                  Aktiv
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
            <Zap className="w-3 h-3" />
            <span>Snabb (lokal)</span>
          </div>
          <div className="flex items-center space-x-1">
            <Globe className="w-3 h-3" />
            <span>Exakt (Berget AI)</span>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <ScrollArea className="h-80">
          <div className="space-y-4">
            {segments.length === 0 ? (
              <div className="text-center text-muted-foreground py-12">
                {isActive ? (
                  <div className="space-y-2">
                    <Loader2 className="w-8 h-8 mx-auto animate-spin" />
                    <p>Lyssnar efter tal...</p>
                    <p className="text-xs">Pratar du svenska? Säg något!</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p>Starta inspelning för live transkribering</p>
                    <p className="text-xs">Använder både lokal taligenkänning och Berget AI</p>
                  </div>
                )}
              </div>
            ) : (
              segments.map((segment) => (
                <div
                  key={segment.id}
                  className={`p-4 rounded-lg border transition-all duration-500 ${
                    segment.isLocal 
                      ? 'bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800' 
                      : 'bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <Badge 
                        variant="outline" 
                        className={`text-xs ${
                          segment.isLocal 
                            ? 'border-blue-300 text-blue-700 dark:border-blue-700 dark:text-blue-300' 
                            : 'border-green-300 text-green-700 dark:border-green-700 dark:text-green-300'
                        }`}
                      >
                        {segment.timestamp.toLocaleTimeString('sv-SE')}
                      </Badge>
                      
                      <Badge 
                        variant={segment.isLocal ? "secondary" : "default"}
                        className="text-xs"
                      >
                        {segment.isLocal ? (
                          <>
                            <Zap className="w-3 h-3 mr-1" />
                            Snabb
                          </>
                        ) : (
                          <>
                            <Globe className="w-3 h-3 mr-1" />
                            Exakt
                          </>
                        )}
                      </Badge>
                    </div>

                    {segment.confidence && (
                      <Badge 
                        variant="outline" 
                        className={`text-xs ${
                          segment.confidence > 0.8 
                            ? 'text-green-600' 
                            : segment.confidence > 0.6 
                            ? 'text-yellow-600' 
                            : 'text-red-600'
                        }`}
                      >
                        {Math.round(segment.confidence * 100)}%
                      </Badge>
                    )}
                  </div>
                  
                  <p className={`text-lg leading-relaxed ${
                    segment.text.endsWith('...') 
                      ? 'text-muted-foreground animate-pulse' 
                      : 'text-foreground'
                  }`}>
                    {segment.text}
                  </p>
                  
                  {segment.isLocal && !segment.text.endsWith('...') && (
                    <p className="text-xs text-muted-foreground mt-2 italic">
                      ↻ Förbättras med Berget AI...
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};