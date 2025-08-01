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
import { format, isToday, isYesterday, startOfDay } from 'date-fns';
import { sv } from 'date-fns/locale';
import { 
  Plus, 
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
  CheckCircle,
  AlertCircle,
  Circle
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { bergetApi } from '@/services/bergetApi';
import ReactMarkdown from 'react-markdown';
import { GlobalSearch } from './GlobalSearch';
import { HistoryDrawer } from './HistoryDrawer';
import { FileUploadDialog } from './FileUploadDialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

type ProtocolTemplate = 'standard' | 'agile' | 'board' | 'interview' | 'lecture';

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
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [expandedMeeting, setExpandedMeeting] = useState<string | null>(null);
  const [editingMeeting, setEditingMeeting] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState<string | null>(null);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  
  const { toast } = useToast();

  useEffect(() => {
    const savedMeetings = JSON.parse(localStorage.getItem('meetings') || '[]');
    setMeetings(savedMeetings.map((m: any) => ({ ...m, date: new Date(m.date) })));
  }, []);

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

  const handleEditStart = (meeting: Meeting) => {
    setEditingMeeting(meeting.id);
    setEditTitle(meeting.title);
  };

  const handleEditSave = (meetingId: string) => {
    if (editTitle.trim()) {
      editMeetingTitle(meetingId, editTitle.trim());
    }
    setEditingMeeting(null);
    setEditTitle('');
  };

  const handleEditCancel = () => {
    setEditingMeeting(null);
    setEditTitle('');
  };

  const analyzeMeeting = async (meeting: Meeting) => {
    if (!meeting.originalTranscription) return;
    
    setIsAnalyzing(meeting.id);
    try {
      // Simulera en analys med grundläggande sammanfattning
      const summary = `Sammanfattning av mötet "${meeting.title}" som spelades in ${format(meeting.date, 'yyyy-MM-dd HH:mm', { locale: sv })}.`;
      const actionItems = ["Följ upp diskuterade punkter", "Implementera beslutade förändringar"];
      
      const updatedMeeting = {
        ...meeting,
        summary,
        actionItems
      };
      
      const updatedMeetings = meetings.map(m => 
        m.id === meeting.id ? updatedMeeting : m
      );
      
      setMeetings(updatedMeetings);
      localStorage.setItem('meetings', JSON.stringify(updatedMeetings));
      
      toast({
        title: "Analys klar",
        description: "Mötet har analyserats och sammanfattning är klar."
      });
    } catch (error: any) {
      toast({
        title: "Analys misslyckades",
        description: "Kunde inte analysera mötet just nu.",
        variant: "destructive"
      });
    } finally {
      setIsAnalyzing(null);
    }
  };

  const getStatusIcon = (status: Meeting['status']) => {
    switch (status) {
      case 'recording':
        return <Mic className="w-3 h-3 text-red-500 animate-pulse" />;
      case 'processing':
        return <Loader2 className="w-3 h-3 text-orange-500 animate-spin" />;
      case 'completed':
        return <CheckCircle className="w-3 h-3 text-green-500" />;
      default:
        return <AlertCircle className="w-3 h-3 text-gray-500" />;
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
    if (!seconds) return '';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const sortedMeetings = [...meetings].sort((a, b) => {
    const dateA = new Date(a.date).getTime();
    const dateB = new Date(b.date).getTime();
    return dateB - dateA; // Senaste mötet först
  });

  // Gruppera möten per datum
  const groupMeetingsByDate = (meetings: Meeting[]) => {
    const groups: { [key: string]: { label: string; meetings: Meeting[] } } = {};
    
    meetings.forEach(meeting => {
      const meetingDate = new Date(meeting.date);
      const dateKey = format(startOfDay(meetingDate), 'yyyy-MM-dd');
      
      let label: string;
      if (isToday(meetingDate)) {
        label = 'Idag';
      } else if (isYesterday(meetingDate)) {
        label = 'Igår';
      } else {
        label = format(meetingDate, 'yyyy-MM-dd', { locale: sv });
      }
      
      if (!groups[dateKey]) {
        groups[dateKey] = { label, meetings: [] };
      }
      groups[dateKey].meetings.push(meeting);
    });
    
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
  };

  const groupedMeetings = groupMeetingsByDate(sortedMeetings);

  const handleStartRecordingAndNavigate = () => {
    onStartRecording?.();
  };

  const handleFileUpload = () => {
    setIsUploadDialogOpen(true);
  };

  const handleFileProcessed = (file: File, result: any) => {
    const newMeeting: Meeting = {
      id: Date.now().toString(),
      title: file.name.replace(/\.[^/.]+$/, "") || "Uppladdat möte",
      date: new Date(),
      status: 'completed',
      summary: "",
      actionItems: [],
      originalTranscription: result.text,
      templateType: 'standard'
    };

    const updatedMeetings = [newMeeting, ...meetings];
    setMeetings(updatedMeetings);
    localStorage.setItem('meetings', JSON.stringify(updatedMeetings));
    
    toast({
      title: "Fil bearbetad",
      description: `${file.name} har transkriberats och lagts till i möteslistan.`
    });
  };

  return (
    <div className="min-h-screen w-full bg-background/50 bg-gradient-to-br from-background via-background to-muted/20">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-lg border-b border-border/30">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center space-x-2">
              <h2 className="text-lg font-semibold">Möteskollen</h2>
              {/* Klickbar badge för antal möten - samma position som i live-vyn */}
              {meetings.length > 0 && (
                <Badge 
                  variant="secondary" 
                  className="rounded-full cursor-pointer hover:bg-secondary/80 transition-colors"
                  onClick={() => setIsHistoryOpen(true)}
                >
                  {meetings.length}
                </Badge>
              )}
            </div>
            
            {/* Global sökruta och användarikon */}
            <div className="flex items-center space-x-2">
              <GlobalSearch
                onShowHistory={() => setIsHistoryOpen(true)}
                onStartRecording={onStartRecording || (() => {})}
                onFileUpload={handleFileUpload}
                meetingContext=""
                meetingsCount={meetings.length}
              />

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

      {/* Inspelningsknapp */}
      {onStartRecording && (
        <div className="max-w-4xl mx-auto p-4">
          <Button 
            onClick={handleStartRecordingAndNavigate}
            className="w-full bg-red-500 hover:bg-red-600 text-white"
            size="lg"
          >
            <Circle className="w-4 h-4 mr-2 fill-current" />
            Starta ny inspelning
          </Button>
        </div>
      )}

      {/* Content */}
      <div className="max-w-4xl mx-auto p-4">
        {sortedMeetings.length === 0 ? (
          <div className="text-center py-12">
            <Clock className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Inga möten än</p>
            <p className="text-sm text-muted-foreground mt-1">
              Starta din första inspelning för att komma igång
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {groupedMeetings.map(([dateKey, group]) => (
              <div key={dateKey}>
                {/* Datumavgränsare */}
                <div className="flex items-center mb-4">
                  <div className="flex-1 h-px bg-border"></div>
                  <div className="px-4 text-sm font-medium text-muted-foreground bg-background">
                    {group.label}
                  </div>
                  <div className="flex-1 h-px bg-border"></div>
                </div>
                
                {/* Möten för detta datum */}
                <div className="space-y-3">
                  {group.meetings.map((meeting) => (
                    <Card key={meeting.id} className="hover:shadow-md transition-shadow">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            {editingMeeting === meeting.id ? (
                              <div className="flex items-center space-x-2">
                                <Input
                                  value={editTitle}
                                  onChange={(e) => setEditTitle(e.target.value)}
                                  className="flex-1"
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleEditSave(meeting.id);
                                    if (e.key === 'Escape') handleEditCancel();
                                  }}
                                  autoFocus
                                />
                                <Button
                                  size="sm"
                                  onClick={() => handleEditSave(meeting.id)}
                                >
                                  Spara
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={handleEditCancel}
                                >
                                  Avbryt
                                </Button>
                              </div>
                            ) : (
                              <div className="flex items-center space-x-2">
                                <CardTitle 
                                  className="text-base font-medium cursor-pointer hover:text-primary transition-colors"
                                  onClick={() => onSelectMeeting(meeting)}
                                >
                                  {meeting.title}
                                </CardTitle>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEditStart(meeting)}
                                  className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <Edit3 className="w-3 h-3" />
                                </Button>
                              </div>
                            )}
                          </div>
                          
                          <div className="flex items-center space-x-2">
                            <Badge variant="outline" className="text-xs">
                              <div className="flex items-center space-x-1">
                                {getStatusIcon(meeting.status)}
                                <span>{getStatusText(meeting.status)}</span>
                              </div>
                            </Badge>
                            
                            {meeting.status === 'completed' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => onSelectMeeting(meeting)}
                                className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                              >
                                <MessageSquare className="w-4 h-4" />
                              </Button>
                            )}
                            
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteMeeting(meeting.id)}
                              className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>

                        <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                          <div className="flex items-center space-x-1">
                            <Calendar className="w-3 h-3" />
                            <span>{format(meeting.date, 'HH:mm', { locale: sv })}</span>
                          </div>
                          {meeting.duration && (
                            <div className="flex items-center space-x-1">
                              <Clock className="w-3 h-3" />
                              <span>{formatDuration(meeting.duration)}</span>
                            </div>
                          )}
                        </div>
                      </CardHeader>

                      {meeting.status === 'completed' && (meeting.summary || meeting.originalTranscription) && (
                        <Collapsible 
                          open={expandedMeeting === meeting.id}
                          onOpenChange={(open) => setExpandedMeeting(open ? meeting.id : null)}
                        >
                          <CollapsibleTrigger asChild>
                            <Button variant="ghost" className="w-full justify-between p-4 h-auto">
                              <span className="text-sm text-muted-foreground">
                                {expandedMeeting === meeting.id ? 'Dölj detaljer' : 'Visa detaljer'}
                              </span>
                              {expandedMeeting === meeting.id ? (
                                <ChevronDown className="w-4 h-4" />
                              ) : (
                                <ChevronRight className="w-4 h-4" />
                              )}
                            </Button>
                          </CollapsibleTrigger>
                          
                          <CollapsibleContent>
                            <CardContent className="pt-0">
                              <Tabs defaultValue="summary" className="w-full">
                                <TabsList className="grid w-full grid-cols-2">
                                  <TabsTrigger value="summary">Sammanfattning</TabsTrigger>
                                  <TabsTrigger value="transcript">Transkript</TabsTrigger>
                                </TabsList>
                                
                                <TabsContent value="summary" className="space-y-4">
                                  {meeting.summary ? (
                                    <div className="space-y-4">
                                      <div className="prose prose-sm max-w-none">
                                        <ReactMarkdown>{meeting.summary}</ReactMarkdown>
                                      </div>
                                      
                                      {meeting.actionItems && meeting.actionItems.length > 0 && (
                                        <div>
                                          <h4 className="font-medium mb-2">Åtgärdspunkter:</h4>
                                          <ul className="space-y-1">
                                            {meeting.actionItems.map((item, index) => (
                                              <li key={index} className="text-sm flex items-start space-x-2">
                                                <span className="text-muted-foreground">•</span>
                                                <span>{item}</span>
                                              </li>
                                            ))}
                                          </ul>
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    <div className="text-center py-4">
                                      <Brain className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                                      <p className="text-sm text-muted-foreground mb-4">
                                        Ingen sammanfattning än
                                      </p>
                                      <Button
                                        size="sm"
                                        onClick={() => analyzeMeeting(meeting)}
                                        disabled={!meeting.originalTranscription || isAnalyzing === meeting.id}
                                        className="space-x-2"
                                      >
                                        {isAnalyzing === meeting.id ? (
                                          <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                          <Brain className="w-4 h-4" />
                                        )}
                                        <span>Analysera möte</span>
                                      </Button>
                                    </div>
                                  )}
                                </TabsContent>
                                
                                <TabsContent value="transcript">
                                  <div className="space-y-2">
                                    <div className="bg-muted/30 rounded-lg p-4 max-h-60 overflow-y-auto">
                                      <p className="text-sm whitespace-pre-wrap">
                                        {meeting.originalTranscription || 'Ingen transkription tillgänglig'}
                                      </p>
                                    </div>
                                  </div>
                                </TabsContent>
                              </Tabs>
                            </CardContent>
                          </CollapsibleContent>
                        </Collapsible>
                      )}
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Filuppladdnings Dialog */}
        <FileUploadDialog
          isOpen={isUploadDialogOpen}
          onClose={() => setIsUploadDialogOpen(false)}
          onFileProcessed={handleFileProcessed}
        />
      </div>
    </div>
  );
};
