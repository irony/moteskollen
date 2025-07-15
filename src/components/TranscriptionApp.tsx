import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { 
  Loader2, 
  FileText, 
  CheckCircle, 
  AlertCircle, 
  Settings, 
  LogOut,
  Shield
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useHybridTranscription } from '@/hooks/useHybridTranscription';
import { RecordingButton } from './RecordingButton';
import { HybridTranscription } from './HybridTranscription';
import { bergetApi } from '@/services/bergetApi';

interface TranscriptionAppProps {
  onShowProtocols: () => void;
  onLogout: () => void;
}

type ProcessingStep = 'idle' | 'transcribing' | 'summarizing' | 'completed' | 'error';

export const TranscriptionApp: React.FC<TranscriptionAppProps> = ({ 
  onShowProtocols, 
  onLogout 
}) => {
  const [processingStep, setProcessingStep] = useState<ProcessingStep>('idle');
  const [fullTranscription, setFullTranscription] = useState('');
  const [summary, setSummary] = useState('');
  const [actionItems, setActionItems] = useState<string[]>([]);
  const [meetingTitle, setMeetingTitle] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { toast } = useToast();

  // Hybrid transkribering - kombinerar Speech API + Berget AI
  const handleBergetTranscription = useCallback((text: string) => {
    setFullTranscription(prev => prev + ' ' + text);
  }, []);

  const { 
    isRecording, 
    audioLevel, 
    segments,
    startRecording, 
    stopRecording,
    error: hybridError 
  } = useHybridTranscription(handleBergetTranscription);

  const handleStartRecording = useCallback(async () => {
    setError(null);
    setProcessingStep('idle');
    setFullTranscription('');
    setSummary('');
    setActionItems([]);
    await startRecording();
  }, [startRecording]);

  const handleStopRecording = useCallback(async () => {
    await stopRecording();
    
    // Skapa protokoll från all transkriberad text
    const allText = segments.map(s => s.text).join(' ') + ' ' + fullTranscription;
    if (allText.trim().length > 20) {
      await processTranscription(allText.trim());
    }
  }, [stopRecording, segments, fullTranscription]);

  const processTranscription = async (text: string) => {
    try {
      setProcessingStep('summarizing');

      // Skapa protokoll från den fullständiga transkriberingen
      const summaryResult = await bergetApi.summarizeToProtocol(text);
      setSummary(summaryResult.summary);
      setActionItems(summaryResult.action_items || []);

      setProcessingStep('completed');
      toast({
        title: "Protokoll skapat! 🎉",
        description: "Din inspelning har bearbetats och ett protokoll är klart.",
      });

    } catch (err: any) {
      setError(err.message);
      setProcessingStep('error');
      toast({
        title: "Fel uppstod",
        description: err.message,
        variant: "destructive"
      });
    }
  };

  const saveProtocol = () => {
    const allText = segments.map(s => s.text).join(' ') + ' ' + fullTranscription;
    if (!allText.trim() || !summary) return;

    const protocol = {
      id: Date.now().toString(),
      date: new Date(),
      title: meetingTitle || `Möte ${new Date().toLocaleDateString('sv-SE')}`,
      summary,
      actionItems,
      originalTranscription: allText.trim()
    };

    const existing = JSON.parse(localStorage.getItem('meeting_protocols') || '[]');
    existing.push(protocol);
    localStorage.setItem('meeting_protocols', JSON.stringify(existing));

    toast({
      title: "Protokoll sparat! 💾",
      description: "Du kan hitta det i protokollistan.",
    });

    // Återställ formuläret
    setProcessingStep('idle');
    setFullTranscription('');
    setSummary('');
    setActionItems([]);
    setMeetingTitle('');
  };

  const getProgressValue = () => {
    switch (processingStep) {
      case 'transcribing': return 33;
      case 'summarizing': return 66;
      case 'completed': return 100;
      default: return 0;
    }
  };

  const getStatusMessage = () => {
    switch (processingStep) {
      case 'transcribing': return 'Transkriberar ljud med Whisper...';
      case 'summarizing': return 'Skapar strukturerat protokoll...';
      case 'completed': return 'Protokoll klart!';
      case 'error': return 'Ett fel uppstod';
      default: return '';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Protokoll Klippare</h1>
            <p className="text-muted-foreground">Powered by Berget AI</p>
          </div>
          <div className="flex space-x-2">
            <Button variant="outline" onClick={onShowProtocols}>
              <FileText className="w-4 h-4 mr-2" />
              Protokoll
            </Button>
            <Button variant="ghost" onClick={onLogout}>
              <LogOut className="w-4 h-4 mr-2" />
              Logga ut
            </Button>
          </div>
        </div>

        {/* Säkerhetsinformation */}
        <Alert>
          <Shield className="h-4 w-4" />
          <AlertDescription>
            <strong>Säker och GDPR-kompatibel</strong> - All bearbetning sker inom Sverige. 
            Ingen data lämnar EU.
          </AlertDescription>
        </Alert>

        {/* Inspelningssektion */}
        <Card className="shadow-elegant">
          <CardHeader className="text-center">
            <CardTitle>Spela in ditt möte</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex justify-center">
              <RecordingButton
                isRecording={isRecording}
                isPaused={false}
                audioLevel={audioLevel}
                onStartRecording={handleStartRecording}
                onStopRecording={handleStopRecording}
                onPauseRecording={() => {}} // Inte använt i hybrid-läge
                onResumeRecording={() => {}} // Inte använt i hybrid-läge
                disabled={processingStep === 'summarizing'}
              />
            </div>

            {hybridError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{hybridError}</AlertDescription>
              </Alert>
            )}

            {/* Processing status */}
            {processingStep !== 'idle' && processingStep !== 'error' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{getStatusMessage()}</span>
                  <Badge variant={processingStep === 'completed' ? 'default' : 'secondary'}>
                    {processingStep === 'completed' ? '✓' : <Loader2 className="w-3 h-3 animate-spin" />}
                  </Badge>
                </div>
                <Progress value={getProgressValue()} className="h-2" />
              </div>
            )}

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Hybrid Live Transkribering */}
        <HybridTranscription 
          segments={segments}
          audioLevel={audioLevel}
          isActive={isRecording}
        />

        {/* Resultat */}
        {processingStep === 'completed' && (
          <Card className="shadow-elegant">
            <CardHeader>
              <CardTitle className="flex items-center">
                <CheckCircle className="w-5 h-5 mr-2 text-success" />
                Protokoll skapat
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <label htmlFor="meeting-title" className="block text-sm font-medium mb-2">
                  Mötestitel
                </label>
                <Input
                  id="meeting-title"
                  placeholder="Ange en titel för mötet..."
                  value={meetingTitle}
                  onChange={(e) => setMeetingTitle(e.target.value)}
                />
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-3">Sammanfattning</h3>
                <Textarea
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  className="min-h-32"
                  placeholder="Protokollsammanfattning..."
                />
              </div>


              {actionItems.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-3">Handlingsplan</h3>
                  <ul className="space-y-2">
                    {actionItems.map((item, index) => (
                      <li key={index} className="flex items-start space-x-2">
                        <span className="w-2 h-2 bg-warning rounded-full mt-2 flex-shrink-0" />
                        <span className="text-sm">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex space-x-3">
                <Button onClick={saveProtocol} className="flex-1">
                  <FileText className="w-4 h-4 mr-2" />
                  Spara protokoll
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => setProcessingStep('idle')}
                  className="flex-1"
                >
                  Spela in nytt möte
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};