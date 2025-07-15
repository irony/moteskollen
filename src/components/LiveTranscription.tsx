import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Volume2, VolumeX } from 'lucide-react';

interface LiveTranscriptionProps {
  transcriptionSegments: Array<{
    text: string;
    timestamp: Date;
    isProcessing?: boolean;
  }>;
  audioLevel: number;
  isActive: boolean;
  onStopRecording?: () => void; // Lägg till callback för att stoppa inspelning
}

export const LiveTranscription: React.FC<LiveTranscriptionProps> = ({
  transcriptionSegments,
  audioLevel,
  isActive,
  onStopRecording
}) => {
  return (
    <Card className="shadow-elegant min-h-96">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl">Live Syntolkning</CardTitle>
          <div className="flex items-center space-x-2">
            {isActive ? (
              <>
                <Volume2 className="w-4 h-4 text-success" />
                <Badge 
                  variant="default" 
                  className="bg-success hover:bg-success/80 cursor-pointer transition-colors select-none"
                  onClick={onStopRecording}
                  title="Klicka för att stoppa inspelning"
                >
                  <div className="flex items-center space-x-1">
                    <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                    <span>LIVE</span>
                  </div>
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
      </CardHeader>

      <CardContent>
        <ScrollArea className="h-80">
          <div className="space-y-4">
            {transcriptionSegments.length === 0 ? (
              <div className="text-center text-muted-foreground py-12">
                {isActive ? (
                  <div className="space-y-2">
                    <Loader2 className="w-8 h-8 mx-auto animate-spin" />
                    <p>Väntar på tal...</p>
                  </div>
                ) : (
                  <p>Starta inspelning för att se live transkribering</p>
                )}
              </div>
            ) : (
              transcriptionSegments.map((segment, index) => (
                <div
                  key={index}
                  className={`p-4 rounded-lg border transition-all duration-300 ${
                    segment.isProcessing 
                      ? 'bg-muted/50 border-muted animate-pulse' 
                      : 'bg-background border-border'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <Badge variant="outline" className="text-xs">
                      {segment.timestamp.toLocaleTimeString('sv-SE')}
                    </Badge>
                    {segment.isProcessing && (
                      <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
                    )}
                  </div>
                  
                  <p className={`text-lg leading-relaxed ${
                    segment.isProcessing 
                      ? 'text-muted-foreground' 
                      : 'text-foreground'
                  }`}>
                    {segment.text || 'Bearbetar ljud...'}
                  </p>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};