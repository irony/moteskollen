import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  Upload,
  Paperclip
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useHybridTranscription } from '@/hooks/useHybridTranscription';
import { useMeetingAnalysis } from '@/hooks/useMeetingAnalysis';
import { RecordingButton } from './RecordingButton';
import { HybridTranscription } from './HybridTranscription';
import { ChatInterface } from './ChatInterface';
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

interface Document {
  id: string;
  name: string;
  content: string;
  uploadedAt: Date;
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
  const [documents, setDocuments] = useState<Document[]>([]);
  const [currentMeetingId, setCurrentMeetingId] = useState<string | null>(null);
  const [analysisStarted, setAnalysisStarted] = useState(false);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);

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

  const handleFileUpload = useCallback(async (file: File) => {
    if (!file) return;

    setIsProcessingFile(true);
    try {
      const result = await bergetApi.transcribeAudio(file);
      
      const newMeeting: Meeting = {
        id: Date.now().toString(),
        title: file.name.replace(/\.[^/.]+$/, "") || "Uppladdat möte",
        date: new Date(),
        status: 'completed',
        summary: "",
        actionItems: [],
        originalTranscription: result.text,
        templateType: selectedTemplate
      };

      setMeetings(prev => [newMeeting, ...prev]);
      
      toast({
        title: "Fil uppladdad",
        description: "Ljudfilen har transkriberats framgångsrikt"
      });
    } catch (error: any) {
      toast({
        title: "Uppladdning misslyckades",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsProcessingFile(false);
      setUploadedFile(null);
    }
  }, [selectedTemplate, toast]);

  const handleDocumentUpload = useCallback(async (file: File) => {
    if (!file) return;

    setIsProcessingFile(true);
    try {
      const result = await bergetApi.processDocument(file);
      
      const newDocument: Document = {
        id: Date.now().toString(),
        name: file.name,
        content: result.text,
        uploadedAt: new Date()
      };

      setDocuments(prev => [newDocument, ...prev]);
      
      toast({
        title: "Dokument uppladdad",
        description: "Dokumentet har bearbetats och är nu tillgängligt i chatten"
      });
    } catch (error: any) {
      toast({
        title: "Dokumentuppladdning misslyckades",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsProcessingFile(false);
    }
  }, [toast]);

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

  const getMeetingContext = (meeting: Meeting) => {
    const documentContext = documents.length > 0 
      ? '\n\nRelaterade dokument:\n' + documents.map(d => `${d.name}:\n${d.content}`).join('\n\n')
      : '';
    
    return (meeting.originalTranscription || '') + documentContext;
  };

  const getGlobalContext = () => {
    return documents.length > 0 
      ? 'Tillgängliga dokument:\n' + documents.map(d => `${d.name}:\n${d.content}`).join('\n\n')
      : '';
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
            <Card className="apple-card border-0">
              <CardHeader className="pb-6">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-xl font-semibold mb-2">
                      {meetingTitle || selectedTemplateData?.name || 'Protokoll'}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {new Date().toLocaleDateString('sv-SE', { 
                        weekday: 'long', 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      })}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Klart
                    </Badge>
                    <Button 
                      onClick={handleSaveProtocol}
                      className="apple-button"
                    >
                      <FileText className="w-4 h-4 mr-2" />
                      Spara protokoll
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="prose max-w-none">
                  <ReactMarkdown>{summary}</ReactMarkdown>
                </div>
                
                {actionItems.length > 0 && (
                  <div className="mt-6 p-4 bg-muted/50 rounded-lg">
                    <h4 className="font-medium mb-2">Handlingspoäng:</h4>
                    <ul className="space-y-1">
                      {actionItems.map((item, index) => (
                        <li key={index} className="text-sm">• {item}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex justify-center">
              <Button 
                onClick={handleReset}
                variant="outline"
                className="apple-button-outline"
              >
                Skapa nytt protokoll
              </Button>
            </div>
          </div>
        ) : (
          <Tabs defaultValue="record" className="w-full">
            <TabsList className="grid w-full grid-cols-3 apple-tabs">
              <TabsTrigger value="record" className="apple-tab">
                <Mic className="w-4 h-4 mr-2" />
                Spela in
              </TabsTrigger>
              <TabsTrigger value="meetings" className="apple-tab">
                <Calendar className="w-4 h-4 mr-2" />
                Mina möten
              </TabsTrigger>
              <TabsTrigger value="chat" className="apple-tab">
                <MessageSquare className="w-4 h-4 mr-2" />
                AI Chat
              </TabsTrigger>
            </TabsList>

            <TabsContent value="record" className="space-y-6 mt-8">
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card className="apple-card border-0">
                    <CardHeader className="pb-4">
                      <CardTitle className="flex items-center text-lg font-semibold">
                        <Upload className="w-5 h-5 mr-2 text-primary" />
                        Ladda upp ljudfil
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="audio-file">Välj ljudfil</Label>
                          <Input
                            id="audio-file"
                            type="file"
                            accept="audio/*"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                setUploadedFile(file);
                              }
                            }}
                            className="mt-2"
                          />
                        </div>
                        
                        {uploadedFile && (
                          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                            <div>
                              <p className="text-sm font-medium">{uploadedFile.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {(uploadedFile.size / 1024 / 1024).toFixed(1)} MB
                              </p>
                            </div>
                            <Button
                              onClick={() => handleFileUpload(uploadedFile)}
                              disabled={isProcessingFile}
                              className="apple-button"
                            >
                              {isProcessingFile ? 'Bearbetar...' : 'Transkribera'}
                            </Button>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="apple-card border-0">
                    <CardHeader className="pb-4">
                      <CardTitle className="flex items-center text-lg font-semibold">
                        <Paperclip className="w-5 h-5 mr-2 text-primary" />
                        Ladda upp dokument
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="document-file">Välj dokument</Label>
                          <Input
                            id="document-file"
                            type="file"
                            accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                handleDocumentUpload(file);
                              }
                            }}
                            className="mt-2"
                          />
                        </div>
                        
                        {documents.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-sm font-medium">Uppladdade dokument:</p>
                            {documents.map((doc) => (
                              <div key={doc.id} className="flex items-center justify-between p-2 bg-muted/30 rounded-lg">
                                <div>
                                  <p className="text-sm font-medium">{doc.name}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {doc.uploadedAt.toLocaleDateString('sv-SE')}
                                  </p>
                                </div>
                                <Badge variant="secondary" className="text-xs">
                                  Tillgängligt
                                </Badge>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Card className="apple-card border-0">
                  <CardHeader className="pb-4">
                    <CardTitle className="flex items-center text-lg font-semibold">
                      {selectedTemplateData?.icon && React.createElement(selectedTemplateData.icon, { className: "w-5 h-5 mr-2 text-primary" })}
                      Live-inspelning
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6">
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="template-select">Välj mötestyp</Label>
                          <Select 
                            value={selectedTemplate} 
                            onValueChange={setSelectedTemplate}
                          >
                            <SelectTrigger className="mt-2">
                              <SelectValue placeholder="Välj mötestyp" />
                            </SelectTrigger>
                            <SelectContent>
                              {PROTOCOL_TEMPLATES.map((template) => (
                                <SelectItem key={template.id} value={template.id}>
                                  <div className="flex items-center">
                                    <template.icon className="w-4 h-4 mr-2" />
                                    {template.name}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        
                        {selectedTemplateData && (
                          <div className="p-3 bg-muted/50 rounded-lg">
                            <p className="text-sm font-medium mb-1">{selectedTemplateData.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {selectedTemplateData.description}
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="text-center space-y-4">
                        <RecordingButton 
                          isRecording={isRecording}
                          isPaused={false}
                          onStartRecording={handleStartRecording}
                          onStopRecording={handleStopRecording}
                          onPauseRecording={() => {}}
                          onResumeRecording={() => {}}
                          audioLevel={audioLevel}
                        />
                        
                        {isRecording && (
                          <div className="text-sm text-muted-foreground">
                            <p>Tryck för att stoppa inspelningen</p>
                          </div>
                        )}
                      </div>

                      {/* Error display */}
                      {(error || hybridError) && (
                        <Alert variant="destructive">
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription>
                            {error || hybridError}
                          </AlertDescription>
                        </Alert>
                      )}

                      {/* Processing display */}
                      {processingStep !== 'idle' && processingStep !== 'completed' && (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">{getStatusMessage()}</span>
                            <span className="text-sm text-muted-foreground">{getProgressValue()}%</span>
                          </div>
                          <Progress value={getProgressValue()} className="h-2" />
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Live transkribering */}
                <HybridTranscription 
                  segments={segments}
                  analysis={analysis}
                  isAnalyzing={isAnalyzing}
                />
              </div>
            </TabsContent>

            <TabsContent value="meetings" className="space-y-6 mt-8">
              <Card className="apple-card border-0">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center text-lg font-semibold">
                    <Calendar className="w-5 h-5 mr-2 text-primary" />
                    Mina möten
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {meetings.length === 0 ? (
                    <div className="text-center py-8">
                      <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">Inga möten än. Börja genom att spela in ett möte.</p>
                    </div>
                  ) : (
                    <Accordion type="single" collapsible className="w-full">
                      {meetings.map((meeting) => (
                        <AccordionItem key={meeting.id} value={meeting.id}>
                          <AccordionTrigger className="text-left">
                            <div className="flex items-center justify-between w-full mr-4">
                              <div className="flex items-center space-x-3">
                                <div className="flex items-center space-x-2">
                                  <Calendar className="w-4 h-4 text-muted-foreground" />
                                  <div>
                                    <p className="font-medium">{meeting.title}</p>
                                    <p className="text-sm text-muted-foreground">
                                      {meeting.date.toLocaleDateString('sv-SE')} - {meeting.date.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center space-x-2">
                                <Badge 
                                  variant={meeting.status === 'completed' ? 'default' : 'secondary'}
                                  className="text-xs"
                                >
                                  {meeting.status === 'completed' ? 'Klart' : 
                                   meeting.status === 'processing' ? 'Bearbetar' : 'Spelar in'}
                                </Badge>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteMeeting(meeting.id);
                                  }}
                                  className="text-red-500 hover:text-red-700"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent>
                            <Tabs defaultValue="summary" className="w-full">
                              <TabsList className="grid w-full grid-cols-3 apple-tabs">
                                <TabsTrigger value="summary">Sammanfattning</TabsTrigger>
                                <TabsTrigger value="transcript">Transkript</TabsTrigger>
                                <TabsTrigger value="chat">Chat</TabsTrigger>
                              </TabsList>
                              
                              <TabsContent value="summary" className="mt-4">
                                {meeting.summary ? (
                                  <div className="prose max-w-none">
                                    <ReactMarkdown>{meeting.summary}</ReactMarkdown>
                                  </div>
                                ) : (
                                  <p className="text-muted-foreground">Ingen sammanfattning tillgänglig ännu.</p>
                                )}
                              </TabsContent>
                              
                              <TabsContent value="transcript" className="mt-4">
                                {meeting.originalTranscription ? (
                                  <div className="p-4 bg-muted/50 rounded-lg">
                                    <p className="text-sm whitespace-pre-wrap">{meeting.originalTranscription}</p>
                                  </div>
                                ) : (
                                  <p className="text-muted-foreground">Inget transkript tillgängligt.</p>
                                )}
                              </TabsContent>
                              
                              <TabsContent value="chat" className="mt-4">
                                <ChatInterface 
                                  meetingContext={getMeetingContext(meeting)}
                                  meetingTitle={meeting.title}
                                  className="h-[400px]"
                                />
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

            <TabsContent value="chat" className="space-y-6 mt-8">
              <div className="space-y-6">
                <div className="text-center space-y-2">
                  <h2 className="text-2xl font-semibold tracking-tight">AI-assistent</h2>
                  <p className="text-muted-foreground">Ställ frågor om dina möten, protokoll och mötesplanering</p>
                </div>
                
                <ChatInterface 
                  meetingContext={getGlobalContext()}
                  className="h-[600px]"
                />
              </div>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
};