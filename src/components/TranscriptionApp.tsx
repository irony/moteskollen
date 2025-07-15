import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import ReactMarkdown from 'react-markdown';
import { 
  Loader2, 
  FileText, 
  CheckCircle, 
  AlertCircle, 
  Settings, 
  LogOut,
  Shield,
  Mic,
  Users,
  Phone,
  GraduationCap,
  BookOpen,
  Briefcase,
  FileSearch,
  Calendar,
  Clock,
  Edit3,
  Trash2,
  MessageSquare,
  ChevronDown,
  Brain,
  Upload
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useHybridTranscription } from '@/hooks/useHybridTranscription';
import { useMeetingAnalysis } from '@/hooks/useMeetingAnalysis';
import { RecordingButton } from './RecordingButton';
import { HybridTranscription } from './HybridTranscription';
import { bergetApi } from '@/services/bergetApi';

interface TranscriptionAppProps {
  onLogout: () => void;
}

type ProcessingStep = 'idle' | 'transcribing' | 'summarizing' | 'completed' | 'error';

interface Meeting {
  id: string;
  date: Date;
  title: string;
  status: 'recording' | 'processing' | 'completed';
  duration?: number;
  summary?: string;
  actionItems?: string[];
  originalTranscription?: string;
  templateType?: string;
}

// Mallar för olika typer av renskrivning
const PROTOCOL_TEMPLATES = [
  {
    id: 'meeting',
    name: 'Mötesprotokoll',
    icon: Users,
    description: 'Strukturerat protokoll för möten med agenda och beslut',
    systemPrompt: 'Skapa ett strukturerat mötesprotokoll med tydlig sammanfattning, beslut och handlingspoäng.'
  },
  {
    id: 'interview',
    name: 'Intervju',
    icon: Phone,
    description: 'Renskrift av intervjuer med frågor och svar',
    systemPrompt: 'Skapa en renskrift av intervjun med tydlig uppdelning mellan frågor och svar.'
  },
  {
    id: 'lecture',
    name: 'Föreläsning',
    icon: GraduationCap,
    description: 'Sammanfattning av föreläsningar och presentationer',
    systemPrompt: 'Skapa en strukturerad sammanfattning av föreläsningen med huvudpoänger och viktiga koncept.'
  },
  {
    id: 'conversation',
    name: 'Samtal',
    icon: BookOpen,
    description: 'Allmän renskrift av samtal och diskussioner',
    systemPrompt: 'Skapa en ren och strukturerad renskrift av samtalet.'
  },
  {
    id: 'business',
    name: 'Affärsmöte',
    icon: Briefcase,
    description: 'Professionellt protokoll för affärsmöten',
    systemPrompt: 'Skapa ett professionellt affärsprotokoll med tydliga beslut, åtgärder och ansvariga.'
  },
  {
    id: 'research',
    name: 'Forskning',
    icon: FileSearch,
    description: 'Detaljerad transkribering för forskningsändamål',
    systemPrompt: 'Skapa en detaljerad och exakt transkribering för forskningsändamål.'
  }
];

export const TranscriptionApp: React.FC<TranscriptionAppProps> = ({ 
  onLogout 
}) => {
  const [processingStep, setProcessingStep] = useState<ProcessingStep>('idle');
  const [fullTranscription, setFullTranscription] = useState('');
  const [summary, setSummary] = useState('');
  const [actionItems, setActionItems] = useState<string[]>([]);
  const [meetingTitle, setMeetingTitle] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('meeting');
  const [error, setError] = useState<string | null>(null);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [currentMeetingId, setCurrentMeetingId] = useState<string | null>(null);
  const [analysisStarted, setAnalysisStarted] = useState(false);

  const { toast } = useToast();

  // Ladda möten från localStorage när komponenten mountas
  React.useEffect(() => {
    const savedMeetings = JSON.parse(localStorage.getItem('meetings') || '[]');
    setMeetings(savedMeetings.map((m: any) => ({ ...m, date: new Date(m.date) })));
  }, []);

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

  const { analysis, isAnalyzing, analyzeTranscription } = useMeetingAnalysis();

  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Kontrollera filtyp
    if (!file.type.startsWith('audio/')) {
      toast({
        title: "Ogiltigt filformat",
        description: "Vänligen ladda upp en ljudfil.",
        variant: "destructive"
      });
      return;
    }

    try {
      setError(null);
      setProcessingStep('transcribing');
      
      // Skapa nytt möte för uppladdad fil
      const newMeeting: Meeting = {
        id: Date.now().toString(),
        date: new Date(),
        title: `Uppladdat möte ${new Date().toLocaleDateString('sv-SE')} ${new Date().toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}`,
        status: 'processing'
      };
      
      const updatedMeetings = [...meetings, newMeeting];
      setMeetings(updatedMeetings);
      setCurrentMeetingId(newMeeting.id);
      localStorage.setItem('meetings', JSON.stringify(updatedMeetings));

      // Transkribera filen med Berget AI
      const transcriptionResult = await bergetApi.transcribeAudio(file);
      setFullTranscription(transcriptionResult.text);
      
      // Bearbeta transkriberingen direkt
      await processTranscription(transcriptionResult.text);
      
    } catch (err: any) {
      setError(err.message);
      setProcessingStep('error');
      toast({
        title: "Fel vid uppladdning",
        description: err.message,
        variant: "destructive"
      });
    }

    // Rensa input
    event.target.value = '';
  }, [meetings, toast]);

  const handleStartRecording = useCallback(async () => {
    setError(null);
    setProcessingStep('idle');
    setFullTranscription('');
    setSummary('');
    setActionItems([]);
    
    // Skapa nytt möte när inspelning startar
    const newMeeting: Meeting = {
      id: Date.now().toString(),
      date: new Date(),
      title: `Möte ${new Date().toLocaleDateString('sv-SE')} ${new Date().toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}`,
      status: 'recording'
    };
    
    const updatedMeetings = [...meetings, newMeeting];
    setMeetings(updatedMeetings);
    setCurrentMeetingId(newMeeting.id);
    localStorage.setItem('meetings', JSON.stringify(updatedMeetings));
    
    await startRecording();
  }, [startRecording, meetings]);

  const handleStopRecording = useCallback(async () => {
    await stopRecording();
    setAnalysisStarted(false);
    
    // Uppdatera möte till processing
    if (currentMeetingId) {
      const updatedMeetings = meetings.map(m => 
        m.id === currentMeetingId ? { ...m, status: 'processing' as const } : m
      );
      setMeetings(updatedMeetings);
      localStorage.setItem('meetings', JSON.stringify(updatedMeetings));
    }
    
    // Skapa protokoll från all transkriberad text
    const allText = segments.map(s => s.text).join(' ') + ' ' + fullTranscription;
    if (allText.trim().length > 20) {
      await processTranscription(allText.trim());
    }
  }, [stopRecording, segments, fullTranscription, currentMeetingId, meetings]);

  const processTranscription = async (text: string) => {
    try {
      setProcessingStep('summarizing');

      // Skapa protokoll från den fullständiga transkriberingen
      const summaryResult = await bergetApi.summarizeToProtocol(text);
      setSummary(summaryResult.summary);
      setActionItems(summaryResult.action_items || []);

      // Generera ett bra namn på mötet baserat på innehållet
      const meetingNamePrompt = `Baserat på denna mötestext, föreslå ett kort och beskrivande namn på mötet (max 50 tecken): "${text.substring(0, 500)}..."`;
      
      try {
        const nameResult = await bergetApi.generateText(meetingNamePrompt);
        const suggestedName = nameResult.replace(/['"]/g, '').trim();
        setMeetingTitle(suggestedName);
        
        // Uppdatera mötet med det föreslagna namnet
        if (currentMeetingId) {
          const updatedMeetings = meetings.map(m => 
            m.id === currentMeetingId ? { 
              ...m, 
              title: suggestedName,
              status: 'completed' as const,
              summary: summaryResult.summary,
              actionItems: summaryResult.action_items || [],
              originalTranscription: text,
              templateType: selectedTemplate
            } : m
          );
          setMeetings(updatedMeetings);
          localStorage.setItem('meetings', JSON.stringify(updatedMeetings));
        }
      } catch (nameErr) {
        console.warn('Kunde inte generera mötesnamn:', nameErr);
      }

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

  const handleSaveProtocol = () => {
    const allText = segments.map(s => s.text).join(' ') + ' ' + fullTranscription;
    if (!allText.trim() || !summary) return;

    const selectedTemplateData = PROTOCOL_TEMPLATES.find(t => t.id === selectedTemplate);
    const protocol = {
      id: Date.now().toString(),
      date: new Date(),
      title: meetingTitle || `${selectedTemplateData?.name || 'Protokoll'} ${new Date().toLocaleDateString('sv-SE')}`,
      summary,
      actionItems,
      originalTranscription: allText.trim(),
      templateType: selectedTemplate
    };

    const existing = JSON.parse(localStorage.getItem('meeting_protocols') || '[]');
    existing.push(protocol);
    localStorage.setItem('meeting_protocols', JSON.stringify(existing));

    toast({
      title: "Protokoll sparat! 💾",
      description: "Du kan hitta det i protokollistan.",
    });

    handleReset();
  };

  const handleReset = () => {
    setProcessingStep('idle');
    setFullTranscription('');
    setSummary('');
    setActionItems([]);
    setMeetingTitle('');
    setCurrentMeetingId(null);
    setAnalysisStarted(false);
  };

  // Auto-analys efter en minut av inspelning
  React.useEffect(() => {
    if (!isRecording || !currentMeetingId || analysisStarted) return;

    const timer = setTimeout(async () => {
      const currentTranscription = segments.map(s => s.text).join(' ');
      if (currentTranscription.length > 50) {
        setAnalysisStarted(true);
        await analyzeTranscription(currentTranscription);
      }
    }, 60000); // 1 minut

    return () => clearTimeout(timer);
  }, [isRecording, currentMeetingId, segments, analysisStarted, analyzeTranscription]);

  const deleteMeeting = (meetingId: string) => {
    const updatedMeetings = meetings.filter(m => m.id !== meetingId);
    setMeetings(updatedMeetings);
    localStorage.setItem('meetings', JSON.stringify(updatedMeetings));
    toast({
      title: "Möte borttaget",
      description: "Mötet har tagits bort från listan."
    });
  };

  const editMeetingTitle = (meetingId: string, newTitle: string) => {
    const updatedMeetings = meetings.map(m => 
      m.id === meetingId ? { ...m, title: newTitle } : m
    );
    setMeetings(updatedMeetings);
    localStorage.setItem('meetings', JSON.stringify(updatedMeetings));
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

  const selectedTemplateData = PROTOCOL_TEMPLATES.find(t => t.id === selectedTemplate);

  return (
    <div className="min-h-screen bg-background/50 bg-gradient-to-br from-background via-background to-muted/20 p-4 md:p-6">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-4xl font-semibold tracking-tight text-foreground">Möteskollen</h1>
            <p className="text-muted-foreground font-medium">Powered by Berget AI</p>
          </div>
          <Button 
            variant="ghost" 
            onClick={onLogout}
            className="rounded-2xl px-4 py-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Logga ut
          </Button>
        </div>

        {/* Säkerhetsinformation */}
        <div className="apple-card p-4 bg-gradient-to-r from-muted/30 to-muted/20 border border-border/30">
          <div className="flex items-start space-x-3">
            <div className="p-2 rounded-full bg-primary/10">
              <Shield className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="font-medium text-foreground">Säker och GDPR-kompatibel</p>
              <p className="text-sm text-muted-foreground mt-1">
                All bearbetning sker inom Sverige. Ingen data lämnar EU.
              </p>
            </div>
          </div>
        </div>

        {/* Protokoll visning eller tabs */}
        {processingStep === 'completed' && summary ? (
          <div className="space-y-6">
            {/* Header med tillbaka-knapp */}
            <div className="flex items-center justify-between">
              <Button variant="outline" onClick={handleReset}>
                ← Tillbaka till inspelning
              </Button>
              <Dialog>
                <DialogTrigger asChild>
                  <Button>
                    <Settings className="w-4 h-4 mr-2" />
                    Ny mall
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Välj mall för ny renskrivning</DialogTitle>
                  </DialogHeader>
                  <div className="grid grid-cols-2 gap-4 p-4">
                    {PROTOCOL_TEMPLATES.map((template) => (
                      <Card key={template.id} className="cursor-pointer hover:bg-muted/50" onClick={() => {
                        setSelectedTemplate(template.id);
                        handleReset();
                      }}>
                        <CardContent className="p-4">
                          <div className="flex items-center space-x-3">
                            <template.icon className="w-6 h-6 text-primary" />
                            <div>
                              <h4 className="font-medium">{template.name}</h4>
                              <p className="text-sm text-muted-foreground">{template.description}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {/* Protokoll visning */}
            <Card className="shadow-elegant">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center">
                    <CheckCircle className="w-5 h-5 mr-2 text-success" />
                    {selectedTemplateData?.name || 'Protokoll'}
                  </CardTitle>
                  <Button onClick={handleSaveProtocol} disabled={!summary}>
                    Spara protokoll
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Titel</label>
                    <Input
                      value={meetingTitle}
                      onChange={(e) => setMeetingTitle(e.target.value)}
                      placeholder={`Ange en titel för ${selectedTemplateData?.name.toLowerCase() || 'protokollet'}...`}
                    />
                  </div>
                  
                  <div className="prose prose-sm max-w-none dark:prose-invert">
                    <ReactMarkdown>{summary}</ReactMarkdown>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <Tabs defaultValue="transcription" className="w-full">
            <TabsList className="grid w-full grid-cols-3 apple-card bg-muted/40 p-2 h-auto">
              <TabsTrigger 
                value="transcription" 
                className="rounded-xl px-6 py-3 font-medium transition-all data-[state=active]:bg-background data-[state=active]:shadow-sm"
              >
                <Mic className="w-4 h-4 mr-2" />
                Live
              </TabsTrigger>
              <TabsTrigger 
                value="protocol" 
                className="rounded-xl px-6 py-3 font-medium transition-all data-[state=active]:bg-background data-[state=active]:shadow-sm"
              >
                <FileText className="w-4 h-4 mr-2" />
                Protokoll & Mallar
              </TabsTrigger>
              <TabsTrigger 
                value="meetings" 
                className="rounded-xl px-6 py-3 font-medium transition-all data-[state=active]:bg-background data-[state=active]:shadow-sm"
              >
                <Calendar className="w-4 h-4 mr-2" />
                Mina Möten
              </TabsTrigger>
            </TabsList>

          {/* Transkribering Tab */}
          <TabsContent value="transcription" className="space-y-8 mt-8">
            {/* Inspelningskontroller */}
            <Card className="apple-card border-0">
              <CardHeader className="text-center pb-6">
                <CardTitle className="text-2xl font-semibold tracking-tight">Spela in ditt möte</CardTitle>
              </CardHeader>
              <CardContent className="space-y-8 px-6 pb-8">
                <div className="flex justify-center">
                  <RecordingButton
                    isRecording={isRecording}
                    isPaused={false}
                    audioLevel={audioLevel}
                    onStartRecording={handleStartRecording}
                    onStopRecording={handleStopRecording}
                    onPauseRecording={() => {}}
                    onResumeRecording={() => {}}
                    disabled={processingStep === 'summarizing'}
                  />
                </div>

                {/* Eller ladda upp en fil */}
                <div className="text-center">
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-border/40" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-background px-4 text-muted-foreground font-medium tracking-wide">
                        eller
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex justify-center">
                  <div className="relative">
                    <input
                      type="file"
                      accept="audio/*"
                      onChange={handleFileUpload}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      disabled={isRecording || processingStep === 'transcribing' || processingStep === 'summarizing'}
                    />
                    <Button 
                      variant="outline" 
                      disabled={isRecording || processingStep === 'transcribing' || processingStep === 'summarizing'}
                      className="apple-button bg-muted/30 border-border/40 hover:bg-muted/50 text-foreground font-medium"
                    >
                      <Upload className="w-4 h-4 mr-3" />
                      Ladda upp ljudfil
                    </Button>
                  </div>
                </div>

                {hybridError && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{hybridError}</AlertDescription>
                  </Alert>
                )}

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

            {/* Live Mötesanalys */}
            {(analysis || isAnalyzing) && (
              <Card className="border-l-4 border-l-blue-500 shadow-elegant">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Brain className="h-5 w-5" />
                    Live Mötesanalys
                    {isAnalyzing && <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {analysis && (
                    <>
                      <div>
                        <strong className="text-sm font-medium">Syfte:</strong>
                        <p className="text-sm text-muted-foreground">{analysis.purpose}</p>
                      </div>
                      <div>
                        <strong className="text-sm font-medium">Förslag på titel:</strong>
                        <p className="text-sm text-muted-foreground">{analysis.suggestedTitle}</p>
                      </div>
                      {analysis.participants.length > 0 && (
                        <div>
                          <strong className="text-sm font-medium">Deltagare:</strong>
                          <p className="text-sm text-muted-foreground">{analysis.participants.join(', ')}</p>
                        </div>
                      )}
                      <div>
                        <strong className="text-sm font-medium">Uppskattade deltagare:</strong>
                        <p className="text-sm text-muted-foreground">{analysis.estimatedParticipants} personer</p>
                      </div>
                      <div>
                        <strong className="text-sm font-medium">Rekommenderad mall:</strong>
                        <p className="text-sm text-muted-foreground">{analysis.suggestedTemplate}</p>
                      </div>
                      {analysis.actionPoints.length > 0 && (
                        <div>
                          <strong className="text-sm font-medium">Identifierade handlingspunkter:</strong>
                          <ul className="text-sm text-muted-foreground list-disc list-inside mt-1">
                            {analysis.actionPoints.map((point, index) => (
                              <li key={index}>{point}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Live Transkribering Display */}
            {(isRecording || segments.length > 0) && (
              <Card className="shadow-elegant">
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Mic className="w-5 h-5 mr-2" />
                    Live Transkribering
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {segments.map((segment) => (
                      <div
                        key={segment.id}
                        className={`p-3 rounded-lg border ${
                          segment.isLocal ? 'bg-blue-50 border-blue-200' : 'bg-green-50 border-green-200'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-muted-foreground">
                            {new Date(segment.timestamp).toLocaleTimeString('sv-SE')}
                          </span>
                          <Badge variant={segment.isLocal ? "secondary" : "default"} className="text-xs">
                            {segment.isLocal ? "Live" : "AI"}
                            {segment.confidence && ` (${Math.round(segment.confidence * 100)}%)`}
                          </Badge>
                        </div>
                        <p className="text-sm">{segment.text}</p>
                      </div>
                    ))}
                    {isRecording && segments.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        <Mic className="w-8 h-8 mx-auto mb-2 animate-pulse" />
                        <p>Lyssnar efter tal...</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
            <HybridTranscription 
              segments={segments}
              audioLevel={audioLevel}
              isActive={isRecording}
              onStartRecording={handleStartRecording}
            />
          </TabsContent>

          {/* Protokoll Tab */}
          <TabsContent value="protocol" className="space-y-6">
            {/* Mallval */}
            <Card className="shadow-elegant">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Settings className="w-5 h-5 mr-2" />
                  Välj typ av renskrivning
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Välj mall för renskrivning" />
                  </SelectTrigger>
                  <SelectContent>
                    {PROTOCOL_TEMPLATES.map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        <div className="flex items-center">
                          <template.icon className="w-4 h-4 mr-2" />
                          <div>
                            <div className="font-medium">{template.name}</div>
                            <div className="text-sm text-muted-foreground">
                              {template.description}
                            </div>
                          </div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                {/* Beskrivning av vald mall */}
                {selectedTemplateData && (
                  <div className="mt-4 p-4 bg-muted rounded-lg">
                    <div className="flex items-center mb-2">
                      <selectedTemplateData.icon className="w-5 h-5 mr-2 text-primary" />
                      <h4 className="font-semibold">{selectedTemplateData.name}</h4>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {selectedTemplateData.description}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

          </TabsContent>

          {/* Möten Tab */}
          <TabsContent value="meetings" className="space-y-6">
            <Card className="shadow-elegant">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Calendar className="w-5 h-5 mr-2" />
                  Mina inspelade möten
                </CardTitle>
              </CardHeader>
              <CardContent>
                {meetings.length === 0 ? (
                  <div className="text-center py-8">
                    <Calendar className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">Inga möten inspelade än</p>
                    <p className="text-sm text-muted-foreground mt-2">
                      Börja spela in ett möte för att se det här
                    </p>
                  </div>
                ) : (
                  <Accordion type="single" collapsible className="w-full">
                    {meetings
                      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                      .map((meeting) => (
                      <AccordionItem key={meeting.id} value={meeting.id} className="border rounded-lg mb-4">
                        <AccordionTrigger className="hover:no-underline px-4 py-3">
                          <div className="flex items-center justify-between w-full mr-4">
                            <div className="flex items-center space-x-3">
                              <div className="flex items-center space-x-2">
                                {meeting.status === 'recording' && (
                                  <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                                )}
                                {meeting.status === 'processing' && (
                                  <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                                )}
                                {meeting.status === 'completed' && (
                                  <CheckCircle className="w-4 h-4 text-green-500" />
                                )}
                                <Badge variant={
                                  meeting.status === 'recording' ? 'destructive' : 
                                  meeting.status === 'processing' ? 'secondary' : 'default'
                                }>
                                  {meeting.status === 'recording' ? 'Spelar in' : 
                                   meeting.status === 'processing' ? 'Bearbetar' : 'Klart'}
                                </Badge>
                              </div>
                              <div className="text-left">
                                <h3 className="font-medium">{meeting.title}</h3>
                                <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                                  <div className="flex items-center space-x-1">
                                    <Clock className="w-4 h-4" />
                                    <span>{meeting.date.toLocaleDateString('sv-SE')}</span>
                                    <span>{meeting.date.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2" onClick={(e) => e.stopPropagation()}>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => deleteMeeting(meeting.id)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="px-4 pb-4">
                          <Tabs defaultValue="transcription" className="w-full">
                            <TabsList className="grid w-full grid-cols-3">
                              <TabsTrigger value="transcription">
                                <Mic className="w-4 h-4 mr-2" />
                                Transkribering
                              </TabsTrigger>
                              <TabsTrigger value="protocol">
                                <FileText className="w-4 h-4 mr-2" />
                                Protokoll
                              </TabsTrigger>
                              <TabsTrigger value="chat">
                                <MessageSquare className="w-4 h-4 mr-2" />
                                Chat
                              </TabsTrigger>
                            </TabsList>

                            <TabsContent value="transcription" className="mt-4">
                              <Card>
                                <CardHeader>
                                  <CardTitle className="text-sm">Originaltranskribering</CardTitle>
                                </CardHeader>
                                <CardContent>
                                  {meeting.originalTranscription ? (
                                    <div className="text-sm text-muted-foreground whitespace-pre-wrap max-h-64 overflow-y-auto">
                                      {meeting.originalTranscription}
                                    </div>
                                  ) : (
                                    <p className="text-sm text-muted-foreground">
                                      {meeting.status === 'recording' ? 'Inspelning pågår...' : 
                                       meeting.status === 'processing' ? 'Bearbetar transkribering...' : 
                                       'Ingen transkribering tillgänglig'}
                                    </p>
                                  )}
                                </CardContent>
                              </Card>
                            </TabsContent>

                            <TabsContent value="protocol" className="mt-4">
                              <Card>
                                <CardHeader className="flex flex-row items-center justify-between">
                                  <CardTitle className="text-sm">Mötesprotokoll</CardTitle>
                                  {meeting.status === 'completed' && meeting.originalTranscription && (
                                    <Dialog>
                                      <DialogTrigger asChild>
                                        <Button variant="outline" size="sm">
                                          <Settings className="w-4 h-4 mr-2" />
                                          Skapa protokoll
                                        </Button>
                                      </DialogTrigger>
                                      <DialogContent className="max-w-2xl">
                                        <DialogHeader>
                                          <DialogTitle>Välj mall för protokoll</DialogTitle>
                                        </DialogHeader>
                                        <div className="grid grid-cols-2 gap-4 p-4">
                                          {PROTOCOL_TEMPLATES.map((template) => (
                                            <Card key={template.id} className="cursor-pointer hover:bg-muted/50" onClick={async () => {
                                              try {
                                                setProcessingStep('summarizing');
                                                const summaryResult = await bergetApi.summarizeToProtocol(
                                                  meeting.originalTranscription!, 
                                                  template.systemPrompt
                                                );
                                                
                                                // Uppdatera mötet med det nya protokollet
                                                const updatedMeetings = meetings.map(m => 
                                                  m.id === meeting.id ? { 
                                                    ...m, 
                                                    summary: summaryResult.summary,
                                                    actionItems: summaryResult.action_items || [],
                                                    templateType: template.id
                                                  } : m
                                                );
                                                setMeetings(updatedMeetings);
                                                localStorage.setItem('meetings', JSON.stringify(updatedMeetings));
                                                
                                                setProcessingStep('completed');
                                                toast({
                                                  title: "Protokoll skapat! 🎉",
                                                  description: `${template.name} har skapats för mötet.`,
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
                                            }}>
                                              <CardContent className="p-4">
                                                <div className="flex items-center space-x-3">
                                                  <template.icon className="w-6 h-6 text-primary" />
                                                  <div>
                                                    <h4 className="font-medium">{template.name}</h4>
                                                    <p className="text-sm text-muted-foreground">{template.description}</p>
                                                  </div>
                                                </div>
                                              </CardContent>
                                            </Card>
                                          ))}
                                        </div>
                                      </DialogContent>
                                    </Dialog>
                                  )}
                                </CardHeader>
                                <CardContent>
                                  {meeting.summary ? (
                                    <div className="prose prose-sm max-w-none dark:prose-invert">
                                      <ReactMarkdown>{meeting.summary}</ReactMarkdown>
                                    </div>
                                  ) : (
                                    <p className="text-sm text-muted-foreground">
                                      {meeting.status === 'recording' ? 'Inspelning pågår...' : 
                                       meeting.status === 'processing' ? 'Skapar protokoll...' : 
                                       meeting.originalTranscription ? 'Klicka på "Skapa protokoll" för att välja mall och skapa protokoll' :
                                       'Inget protokoll tillgängligt'}
                                    </p>
                                  )}
                                </CardContent>
                              </Card>
                            </TabsContent>

                            <TabsContent value="chat" className="mt-4">
                              <Card>
                                <CardHeader>
                                  <CardTitle className="text-sm">Chat med mötet</CardTitle>
                                </CardHeader>
                                <CardContent>
                                  <div className="text-center py-8 text-muted-foreground">
                                    <MessageSquare className="w-8 h-8 mx-auto mb-2" />
                                    <p>Chat-funktion kommer snart</p>
                                    <p className="text-xs mt-1">
                                      Du kommer kunna ställa frågor om mötet här
                                    </p>
                                  </div>
                                </CardContent>
                              </Card>
                            </TabsContent>
                          </Tabs>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
        )}
      </div>
    </div>
  );
};