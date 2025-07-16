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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
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
  Paperclip,
  Menu,
  Square,
  User
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useHybridTranscription } from '@/hooks/useHybridTranscription';
import { useMeetingAnalysis } from '@/hooks/useMeetingAnalysis';
import { RecordingButton } from './RecordingButton';
import { HybridTranscription } from './HybridTranscription';
import { ChatInterface } from './ChatInterface';
import { FooterWithRecording } from './FooterWithRecording';
import { AppHeader } from './AppHeader';
import { HistoryDrawer } from './HistoryDrawer';

import { GlobalSearch } from './GlobalSearch';
import { bergetApi } from '@/services/bergetApi';
import { cn } from '@/lib/utils';

interface TranscriptionAppProps {
  onLogout: () => void;
  className?: string;
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

export const TranscriptionApp: React.FC<TranscriptionAppProps> = ({ onLogout, className }) => {
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
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [showChat, setShowChat] = useState(false);

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

  const handleShowHistory = () => {
    setIsHistoryOpen(true);
  };

  const handleSelectMeeting = (meeting: Meeting) => {
    setSelectedMeeting(meeting);
    setIsHistoryOpen(false);
    setShowChat(true);
  };

  const handleStartChat = (meeting: Meeting) => {
    setSelectedMeeting(meeting);
    setIsHistoryOpen(false);
    setShowChat(true);
  };

  const handleBackToMain = () => {
    setShowChat(false);
    setSelectedMeeting(null);
  };

  return (
    <div className={cn("min-h-screen", className)}>
      <div className="min-h-screen w-full">
        {/* Huvudinnehåll */}
        <main className="min-h-screen bg-background/50 bg-gradient-to-br from-background via-background to-muted/20 pb-24">
          {/* Header med användarikon */}
          <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-lg border-b border-border/30">
            <div className="max-w-4xl mx-auto">
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center space-x-2">
                  <h2 className="text-lg font-semibold">Möteskollen</h2>
                </div>
                
                {/* Global sökruta och användarikon */}
                <div className="flex items-center space-x-2">
                  <GlobalSearch
                    onShowHistory={handleShowHistory}
                    onStartRecording={handleStartRecording}
                    onFileUpload={handleFileUpload}
                    meetingContext={selectedMeeting ? getMeetingContext(selectedMeeting) : getGlobalContext()}
                    meetingsCount={meetings.length}
                  />
                  
                  {/* Visuell indikator för antal möten */}
                  {meetings.length > 0 && (
                    <Badge variant="secondary" className="rounded-full text-xs">
                      {meetings.length}
                    </Badge>
                  )}

                  {/* Användarikon med dropdown */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="rounded-full w-8 h-8 p-0">
                        <User className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem disabled>
                        <Settings className="w-4 h-4 mr-2" />
                        Inställningar
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={onLogout}>
                        <LogOut className="w-4 h-4 mr-2" />
                        Logga ut
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>
          </header>

          {/* Live transkribering med central caption och timeline - visas bara när inspelning pågår */}
          <div className="relative">
            {isRecording ? (
              <HybridTranscription 
                segments={segments}
                audioLevel={audioLevel}
                isActive={isRecording}
                onStartRecording={handleStartRecording}
                onStopRecording={handleStopRecording}
              />
            ) : (
              <div className="max-w-4xl mx-auto px-4 md:px-6 py-8">
                <div className="text-center text-muted-foreground">
                  <div className="mb-4">
                    <FileText className="w-16 h-16 mx-auto text-muted-foreground/50" />
                  </div>
                  <p className="text-lg">Protokollet kommer visas här</p>
                  <p className="text-sm mt-2">Starta en inspelning eller ladda upp en fil för att komma igång</p>
                </div>
              </div>
            )}

            {/* Error display */}
            {(error || hybridError) && (
              <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 max-w-md w-full mx-4">
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    {error || hybridError}
                  </AlertDescription>
                </Alert>
              </div>
            )}

            {/* Processing display */}
            {processingStep !== 'idle' && processingStep !== 'completed' && (
              <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 max-w-md w-full mx-4">
                <div className="bg-background/95 backdrop-blur-md border border-border/30 rounded-lg p-4 shadow-lg">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{getStatusMessage()}</span>
                      <span className="text-sm text-muted-foreground">{getProgressValue()}%</span>
                    </div>
                    <Progress value={getProgressValue()} className="h-2" />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Apple-style Footer med inspelningsknapp */}
          <FooterWithRecording
            isRecording={isRecording}
            isPaused={false}
            audioLevel={audioLevel}
            onStartRecording={handleStartRecording}
            onStopRecording={handleStopRecording}
            onPauseRecording={() => {}}
            onResumeRecording={() => {}}
            onShowHistory={handleShowHistory}
            onFileUpload={handleFileUpload}
            disabled={isProcessingFile}
          />
        </main>

        {/* Historik Drawer */}
        <HistoryDrawer
          isOpen={isHistoryOpen}
          onClose={() => setIsHistoryOpen(false)}
          meetings={meetings}
          onSelectMeeting={handleSelectMeeting}
          onDeleteMeeting={deleteMeeting}
          onUpdateMeeting={(meeting) => {
            const updatedMeetings = meetings.map(m => m.id === meeting.id ? meeting : m);
            setMeetings(updatedMeetings);
            localStorage.setItem('meetings', JSON.stringify(updatedMeetings));
          }}
          onStartRecording={() => {
            setIsHistoryOpen(false);
            handleStartRecording();
          }}
        />
      </div>
    </div>
  );
};