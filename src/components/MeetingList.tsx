import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  Plus, 
  Search, 
  Calendar, 
  Clock, 
  FileText, 
  User,
  Settings,
  LogOut,
  Mic,
  Play,
  Trash2,
  Edit3,
  MessageSquare,
  ChevronRight,
  ChevronDown,
  Shield,
  Download,
  Brain,
  Loader2,
  AlertCircle,
  CheckCircle,
  CreditCard
} from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { GlobalSearch } from './GlobalSearch';
import { ChatInterface } from './ChatInterface';
import { UsageDisplay } from './UsageDisplay';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { bergetApi } from '@/services/bergetApi';
import ReactMarkdown from 'react-markdown';

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

interface MeetingListProps {
  onLogout: () => void;
  onSelectMeeting: (meeting: Meeting) => void;
  onStartRecording?: () => void;
  className?: string;
}

export const MeetingList: React.FC<MeetingListProps> = ({ 
  onLogout, 
  onSelectMeeting,
  onStartRecording,
  className 
}) => {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [expandedMeeting, setExpandedMeeting] = useState<string | null>(null);
  const [isGeneratingProtocol, setIsGeneratingProtocol] = useState(false);
  const [customPrompt, setCustomPrompt] = useState('');
  const [editingTitle, setEditingTitle] = useState<string | null>(null);
  const [editedTitle, setEditedTitle] = useState('');
  const [showUsage, setShowUsage] = useState(false);
  const { toast } = useToast();

  // Ladda möten från localStorage
  useEffect(() => {
    const savedMeetings = JSON.parse(localStorage.getItem('meetings') || '[]');
    setMeetings(savedMeetings.map((m: any) => ({ ...m, date: new Date(m.date) })));
  }, []);

  const filteredMeetings = meetings.filter(meeting =>
    meeting.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    meeting.summary?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const deleteMeeting = (meetingId: string) => {
    const updatedMeetings = meetings.filter(m => m.id !== meetingId);
    setMeetings(updatedMeetings);
    localStorage.setItem('meetings', JSON.stringify(updatedMeetings));
    toast({
      title: "Möte borttaget",
      description: "Mötet har tagits bort från historiken."
    });
  };

  const editMeetingTitle = (meetingId: string, newTitle: string) => {
    const updatedMeetings = meetings.map(m => 
      m.id === meetingId ? { ...m, title: newTitle } : m
    );
    setMeetings(updatedMeetings);
    localStorage.setItem('meetings', JSON.stringify(updatedMeetings));
  };

  const getStatusColor = (status: Meeting['status']) => {
    switch (status) {
      case 'recording':
        return 'bg-recording animate-pulse'; // Red for recording
      case 'processing':
        return 'bg-signal-medium'; // Yellow for processing
      case 'completed':
        return 'bg-signal-good'; // Green for completed
      default:
        return 'bg-muted-foreground';
    }
  };

  const getStatusText = (status: Meeting['status']) => {
    switch (status) {
      case 'recording':
        return 'Spelar in';
      case 'processing':
        return 'Bearbetar';
      case 'completed':
        return 'Klart';
      default:
        return 'Okänt';
    }
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '—';
    const minutes = Math.floor(seconds / 60);
    return `${minutes} min`;
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('sv-SE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDateFull = (date: Date) => {
    return date.toLocaleDateString('sv-SE', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDurationFull = (seconds?: number) => {
    if (!seconds) return '—';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes} min`;
  };

  const handleMeetingClick = (meeting: Meeting) => {
    setExpandedMeeting(expandedMeeting === meeting.id ? null : meeting.id);
  };

  const handleSaveTitle = (meetingId: string) => {
    editMeetingTitle(meetingId, editedTitle);
    setEditingTitle(null);
    toast({
      title: "Titel uppdaterad",
      description: "Mötestiteln har sparats."
    });
  };

  const generateNewProtocol = async (meeting: Meeting) => {
    if (!meeting.originalTranscription) {
      toast({
        title: "Fel",
        description: "Ingen transkribering tillgänglig för detta möte.",
        variant: "destructive"
      });
      return;
    }

    setIsGeneratingProtocol(true);
    try {
      const result = await bergetApi.summarizeToProtocol(
        meeting.originalTranscription,
        customPrompt || undefined
      );
      
      const updatedMeeting = {
        ...meeting,
        summary: result.summary,
        actionItems: result.action_items
      };
      
      const updatedMeetings = meetings.map(m => 
        m.id === meeting.id ? updatedMeeting : m
      );
      setMeetings(updatedMeetings);
      localStorage.setItem('meetings', JSON.stringify(updatedMeetings));
      
      toast({
        title: "Protokoll genererat",
        description: "Ett nytt protokoll har skapats baserat på transkriberingen."
      });
    } catch (error: any) {
      toast({
        title: "Fel",
        description: `Kunde inte generera protokoll: ${error.message}`,
        variant: "destructive"
      });
    } finally {
      setIsGeneratingProtocol(false);
    }
  };

  const downloadProtocol = (meeting: Meeting) => {
    if (!meeting.summary) return;
    
    const content = `# ${meeting.title}\n\n**Datum:** ${formatDateFull(meeting.date)}\n**Längd:** ${formatDurationFull(meeting.duration)}\n\n${meeting.summary}`;
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${meeting.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_protokoll.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getMeetingContext = (meeting: Meeting) => {
    let context = `Möte: ${meeting.title}\nDatum: ${formatDateFull(meeting.date)}`;
    if (meeting.duration) {
      context += `\nLängd: ${formatDurationFull(meeting.duration)}`;
    }
    if (meeting.summary) {
      context += `\n\nProtokoll:\n${meeting.summary}`;
    }
    if (meeting.originalTranscription) {
      context += `\n\nOriginal transkribering:\n${meeting.originalTranscription}`;
    }
    return context;
  };

  return (
    <div className={cn("min-h-screen bg-background", className)}>
      <div className="min-h-screen w-full">
        {/* Huvudinnehåll */}
        <main className="min-h-screen bg-background/50 bg-gradient-to-br from-background via-background to-muted/20">
          {/* Header */}
          <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border/30">
              <div className="max-w-6xl mx-auto px-4 md:px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <h1 className="text-2xl md:text-4xl font-semibold tracking-tight text-foreground">Möteskollen</h1>
                    <p className="text-xs md:text-sm text-muted-foreground font-medium">
                      {meetings.length} möten sparade
                    </p>
                  </div>
                  
                  <div className="flex items-center space-x-4">
                    <GlobalSearch
                      onShowHistory={() => setIsHistoryOpen(true)}
                      onStartRecording={() => {}} // Handled by floating selector
                      onFileUpload={() => {}} // TODO: Implement file upload
                      meetingContext=""
                      meetingsCount={meetings.length}
                    />
                    
                    {/* User menu */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="p-2">
                          <User className="w-5 h-5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setShowUsage(true)}>
                          <CreditCard className="w-4 h-4 mr-2" />
                          Användning & Kostnad
                        </DropdownMenuItem>
                        <DropdownMenuItem disabled>
                          <Settings className="w-4 h-4 mr-2" />
                          Inställningar
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={onLogout}
                          className="text-destructive focus:text-destructive"
                        >
                          <LogOut className="w-4 h-4 mr-2" />
                          Logga ut
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </div>
          </header>

          <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
            {/* Säkerhetsinformation */}
            <Alert>
              <Shield className="h-4 w-4" />
              <AlertDescription>
                <strong>100% GDPR-kompatibel</strong> - All data bearbetas inom Sverige. Inget skickas utanför EU.
              </AlertDescription>
            </Alert>

            {/* Sök */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Sök bland dina möten..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Möten */}
            {filteredMeetings.length === 0 ? (
              <div className="text-center py-12">
                {meetings.length === 0 ? (
                  <div className="space-y-4">
                    <Button
                      onClick={onStartRecording}
                      className="w-20 h-20 bg-primary hover:bg-primary/90 rounded-full flex items-center justify-center mx-auto transition-all duration-300 hover:scale-105"
                    >
                      <div className="flex flex-col items-center space-y-1">
                        <div className="w-3 h-3 bg-destructive rounded-full" />
                        <span className="text-xs font-medium text-primary-foreground">REC</span>
                      </div>
                    </Button>
                    <div>
                      <h3 className="text-xl font-medium text-foreground">Inga möten än</h3>
                      <p className="text-muted-foreground mt-2">
                        Starta din första inspelning
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-muted-foreground">Inga möten matchade din sökning</p>
                    <Button variant="outline" onClick={() => setSearchQuery('')}>
                      Rensa sökning
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="grid gap-4">
                {filteredMeetings.map((meeting) => (
                  <Collapsible
                    key={meeting.id}
                    open={expandedMeeting === meeting.id}
                    onOpenChange={() => handleMeetingClick(meeting)}
                  >
                    <Card className="neu-card hover:shadow-neu-hover transition-all duration-300 overflow-hidden">
                      <CollapsibleTrigger className="w-full">
                        <CardContent className="p-6">
                          <div className="flex items-center justify-between">
                            <div className="flex-1 text-left">
                              <div className="flex items-center space-x-3 mb-2">
                                <div className={`w-3 h-3 rounded-full ${getStatusColor(meeting.status)}`} />
                                {editingTitle === meeting.id ? (
                                  <div className="flex items-center space-x-2" onClick={(e) => e.stopPropagation()}>
                                    <Input
                                      value={editedTitle}
                                      onChange={(e) => setEditedTitle(e.target.value)}
                                      className="text-lg font-semibold bg-transparent border-0 px-0 focus-visible:ring-0"
                                      onKeyPress={(e) => e.key === 'Enter' && handleSaveTitle(meeting.id)}
                                    />
                                    <Button size="sm" onClick={() => handleSaveTitle(meeting.id)}>
                                      <CheckCircle className="w-4 h-4" />
                                    </Button>
                                  </div>
                                ) : (
                                  <div className="flex items-center space-x-2">
                                    <h3 className="text-lg font-semibold text-foreground line-clamp-2 leading-tight">
                                      {meeting.title}
                                    </h3>
                                  </div>
                                )}
                                <Badge variant="outline" className="text-xs">
                                  {getStatusText(meeting.status)}
                                </Badge>
                              </div>
                              
                              <div className="flex items-center space-x-4 text-sm text-muted-foreground mb-3">
                                <div className="flex items-center space-x-1">
                                  <Calendar className="w-4 h-4" />
                                  <span>{formatDate(meeting.date)}</span>
                                </div>
                                <div className="flex items-center space-x-1">
                                  <Clock className="w-4 h-4" />
                                  <span>{formatDuration(meeting.duration)}</span>
                                </div>
                              </div>

                              {meeting.summary && (
                                <p className="text-sm text-muted-foreground line-clamp-2">
                                  {meeting.summary.slice(0, 150)}...
                                </p>
                              )}
                            </div>

                            <div className="flex items-center space-x-2 ml-4">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingTitle(meeting.id);
                                  setEditedTitle(meeting.title);
                                }}
                              >
                                <Edit3 className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteMeeting(meeting.id);
                                }}
                              >
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                              {expandedMeeting === meeting.id ? (
                                <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform duration-200" />
                              ) : (
                                <ChevronRight className="w-4 h-4 text-muted-foreground transition-transform duration-200" />
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </CollapsibleTrigger>

                      <CollapsibleContent className="animate-accordion-down data-[state=closed]:animate-accordion-up">
                        <div className="border-t border-border/50 bg-muted/30">
                          <div className="p-6">
                            <Tabs defaultValue="protocol" className="space-y-4">
                              <TabsList className="grid w-full grid-cols-3">
                                <TabsTrigger value="protocol">Protokoll</TabsTrigger>
                                <TabsTrigger value="chat">AI-assistent</TabsTrigger>
                                <TabsTrigger value="transcript">Transkribering</TabsTrigger>
                              </TabsList>

                              <TabsContent value="protocol" className="space-y-4">
                                {meeting.summary ? (
                                  <div className="space-y-4">
                                    <div className="flex justify-between items-center">
                                      <div className="flex items-center space-x-2">
                                        <FileText className="w-5 h-5" />
                                        <span className="font-medium">Mötesprotokoll</span>
                                      </div>
                                      <div className="flex space-x-2">
                                        <Button 
                                          variant="outline" 
                                          size="sm"
                                          onClick={() => downloadProtocol(meeting)}
                                        >
                                          <Download className="w-4 h-4 mr-2" />
                                          Ladda ner
                                        </Button>
                                        <Button 
                                          variant="outline" 
                                          size="sm"
                                          onClick={() => generateNewProtocol(meeting)}
                                          disabled={isGeneratingProtocol}
                                        >
                                          {isGeneratingProtocol ? (
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                          ) : (
                                            <Brain className="w-4 h-4 mr-2" />
                                          )}
                                          Generera nytt
                                        </Button>
                                      </div>
                                    </div>
                                    <div className="bg-background rounded-lg p-4 max-h-96 overflow-y-auto">
                                      <div className="prose max-w-none text-sm">
                                        <ReactMarkdown>{meeting.summary}</ReactMarkdown>
                                      </div>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="text-center space-y-4 py-8">
                                    <FileText className="w-12 h-12 text-muted-foreground mx-auto" />
                                    <div>
                                      <h3 className="text-lg font-medium">Inget protokoll ännu</h3>
                                      <p className="text-muted-foreground">Generera ett protokoll från transkriberingen</p>
                                    </div>
                                    
                                    <div className="space-y-4 max-w-md mx-auto">
                                      <div>
                                        <Label htmlFor="custom-prompt">Anpassad prompt (valfritt)</Label>
                                        <Textarea
                                          id="custom-prompt"
                                          placeholder="T.ex. 'Fokusera på beslut och handlingsplaner...'"
                                          value={customPrompt}
                                          onChange={(e) => setCustomPrompt(e.target.value)}
                                          className="mt-1"
                                        />
                                      </div>
                                      
                                      <Button 
                                        onClick={() => generateNewProtocol(meeting)}
                                        disabled={isGeneratingProtocol || !meeting.originalTranscription}
                                        className="w-full"
                                      >
                                        {isGeneratingProtocol ? (
                                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        ) : (
                                          <Brain className="w-4 h-4 mr-2" />
                                        )}
                                        Generera protokoll
                                      </Button>
                                    </div>
                                  </div>
                                )}
                              </TabsContent>

                              <TabsContent value="chat" className="space-y-4">
                                <div className="flex items-center space-x-2 mb-4">
                                  <MessageSquare className="w-5 h-5" />
                                  <span className="font-medium">Chatta om mötet</span>
                                </div>
                                <div className="bg-background rounded-lg p-4">
                                  <ChatInterface 
                                    meetingContext={getMeetingContext(meeting)}
                                    meetingTitle={meeting.title}
                                  />
                                </div>
                              </TabsContent>

                              <TabsContent value="transcript" className="space-y-4">
                                {meeting.originalTranscription ? (
                                  <div className="space-y-4">
                                    <div className="flex items-center space-x-2">
                                      <FileText className="w-5 h-5" />
                                      <span className="font-medium">Original transkribering</span>
                                    </div>
                                    <div className="bg-background rounded-lg p-4 max-h-96 overflow-y-auto">
                                      <p className="whitespace-pre-wrap text-sm leading-relaxed">
                                        {meeting.originalTranscription}
                                      </p>
                                    </div>
                                  </div>
                                ) : (
                                  <Alert>
                                    <AlertCircle className="h-4 w-4" />
                                    <AlertDescription>
                                      Ingen transkribering tillgänglig för detta möte.
                                    </AlertDescription>
                                  </Alert>
                                )}
                              </TabsContent>
                            </Tabs>
                          </div>
                        </div>
                      </CollapsibleContent>
                    </Card>
                  </Collapsible>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
      
      {/* Usage Display Modal */}
      <UsageDisplay 
        isVisible={showUsage}
        onClose={() => setShowUsage(false)}
      />
    </div>
  );
};