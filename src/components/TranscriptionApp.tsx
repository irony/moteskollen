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
  Trash2
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
  onShowProtocols, 
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
  };

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
    <div className="min-h-screen bg-gradient-to-br from-background to-muted p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Möteskollen</h1>
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
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="transcription">
                <Mic className="w-4 h-4 mr-2" />
                Transkribering
              </TabsTrigger>
              <TabsTrigger value="protocol">
                <FileText className="w-4 h-4 mr-2" />
                Protokoll & Mallar
              </TabsTrigger>
              <TabsTrigger value="meetings">
                <Calendar className="w-4 h-4 mr-2" />
                Mina Möten
              </TabsTrigger>
            </TabsList>

          {/* Transkribering Tab */}
          <TabsContent value="transcription" className="space-y-6">
            {/* Inspelningskontroller */}
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
                    onPauseRecording={() => {}}
                    onResumeRecording={() => {}}
                    disabled={processingStep === 'summarizing'}
                  />
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

            {/* Hybrid Live Transkribering */}
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
                  <div className="space-y-4">
                    {meetings
                      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                      .map((meeting) => (
                      <div key={meeting.id} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
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
                              <div>
                                <input
                                  type="text"
                                  value={meeting.title}
                                  onChange={(e) => editMeetingTitle(meeting.id, e.target.value)}
                                  className="font-medium bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-primary/20 rounded px-1"
                                />
                              </div>
                            </div>
                            <div className="flex items-center space-x-4 mt-2 text-sm text-muted-foreground">
                              <div className="flex items-center space-x-1">
                                <Clock className="w-4 h-4" />
                                <span>{meeting.date.toLocaleDateString('sv-SE')}</span>
                                <span>{meeting.date.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}</span>
                              </div>
                              {meeting.summary && (
                                <div className="truncate max-w-md">
                                  {meeting.summary.substring(0, 80)}...
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            {meeting.status === 'completed' && meeting.summary && (
                              <Button variant="outline" size="sm">
                                <FileText className="w-4 h-4 mr-1" />
                                Visa
                              </Button>
                            )}
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => deleteMeeting(meeting.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
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