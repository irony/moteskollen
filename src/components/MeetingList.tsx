import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { 
  Plus, 
  Search, 
  Calendar, 
  Clock, 
  FileText, 
  Menu,
  Mic,
  Play,
  Trash2,
  Edit3,
  MessageSquare,
  ChevronRight,
  Shield
} from 'lucide-react';
import { AppSidebar } from './AppSidebar';
import { GlobalSearch } from './GlobalSearch';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

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

  return (
    <div className={cn("min-h-screen bg-background", className)}>
      <SidebarProvider>
        <div className="min-h-screen flex w-full">
        {/* Sidebar */}
          <AppSidebar onLogout={onLogout} />

        {/* Huvudinnehåll */}
        <main className="flex-1 min-h-screen bg-background/50 bg-gradient-to-br from-background via-background to-muted/20">
          {/* Header */}
          <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border/30">
            <div className="max-w-6xl mx-auto px-4 md:px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <SidebarTrigger className="p-2 hover:bg-muted/50 rounded-lg transition-colors">
                    <Menu className="w-5 h-5" />
                  </SidebarTrigger>
                  
                  <div className="space-y-1">
                    <h1 className="text-2xl md:text-4xl font-semibold tracking-tight text-foreground">Mina Möten</h1>
                    <p className="text-xs md:text-sm text-muted-foreground font-medium">
                      {meetings.length} möten sparade
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-4">
                  <GlobalSearch
                    onShowHistory={() => setIsHistoryOpen(true)}
                    onStartRecording={() => {}} // Handled by floating selector
                    onFileUpload={() => {}} // TODO: Implement file upload
                    meetingContext=""
                    meetingsCount={meetings.length}
                  />
                  
                  {/* Floating selector will handle new recording */}
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
                  <Card 
                    key={meeting.id} 
                    className="neu-card hover:shadow-neu-hover transition-all duration-300 cursor-pointer"
                    onClick={() => onSelectMeeting(meeting)}
                  >
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-2">
                            <div className={`w-3 h-3 rounded-full ${getStatusColor(meeting.status)}`} />
                            <h3 className="text-lg font-semibold text-foreground line-clamp-2 leading-tight">{meeting.title}</h3>
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
                          {meeting.status === 'completed' && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onSelectMeeting(meeting);
                                }}
                              >
                                <MessageSquare className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  // TODO: Implement edit functionality
                                }}
                              >
                                <Edit3 className="w-4 h-4" />
                              </Button>
                            </>
                          )}
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
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
      </SidebarProvider>
    </div>
  );
};