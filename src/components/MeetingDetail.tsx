import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ToastAction } from '@/components/ui/toast';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  ArrowLeft, 
  Calendar, 
  Clock, 
  FileText, 
  MessageSquare,
  Download,
  Edit3,
  CheckCircle,
  Brain,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { ChatInterface } from './ChatInterface';
import { useToast } from '@/hooks/use-toast';
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

interface MeetingDetailProps {
  meeting: Meeting;
  onBack: () => void;
  onUpdateMeeting: (updatedMeeting: Meeting) => void;
}

export const MeetingDetail: React.FC<MeetingDetailProps> = ({
  meeting,
  onBack,
  onUpdateMeeting
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState(meeting.title);
  const [isGeneratingProtocol, setIsGeneratingProtocol] = useState(false);
  const [customPrompt, setCustomPrompt] = useState('');
  const { toast } = useToast();

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('sv-SE', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '—';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes} min`;
  };

  const handleSaveTitle = () => {
    const updatedMeeting = { ...meeting, title: editedTitle };
    onUpdateMeeting(updatedMeeting);
    setIsEditing(false);
    toast({
      title: "Titel uppdaterad",
      description: "Mötestiteln har sparats."
    });
  };

  const generateNewProtocol = useCallback(async () => {
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
      
      onUpdateMeeting(updatedMeeting);
      
      toast({
        title: "Protokoll genererat",
        description: "Ett nytt protokoll har skapats baserat på transkriberingen.",
        action: (
          <ToastAction altText="Visa protokoll">
            Visa
          </ToastAction>
        )
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
  }, [meeting, customPrompt, onUpdateMeeting, toast]);

  const downloadProtocol = () => {
    if (!meeting.summary) return;
    
    const content = `# ${meeting.title}\n\n**Datum:** ${formatDate(meeting.date)}\n**Längd:** ${formatDuration(meeting.duration)}\n\n${meeting.summary}`;
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

  const getMeetingContext = () => {
    let context = `Möte: ${meeting.title}\nDatum: ${formatDate(meeting.date)}`;
    if (meeting.duration) {
      context += `\nLängd: ${formatDuration(meeting.duration)}`;
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
    <div className="min-h-screen bg-background/50 bg-gradient-to-br from-background via-background to-muted/20">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border/30">
        <div className="max-w-4xl mx-auto px-4 md:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button variant="ghost" onClick={onBack} className="p-2">
                <ArrowLeft className="w-5 h-5" />
              </Button>
              
              <div className="space-y-1">
                {isEditing ? (
                  <div className="flex items-center space-x-2">
                    <Input
                      value={editedTitle}
                      onChange={(e) => setEditedTitle(e.target.value)}
                      className="text-2xl font-semibold bg-transparent border-0 px-0 focus-visible:ring-0"
                      onKeyPress={(e) => e.key === 'Enter' && handleSaveTitle()}
                    />
                    <Button size="sm" onClick={handleSaveTitle}>
                      <CheckCircle className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2">
                    <h1 className="text-2xl md:text-4xl font-semibold tracking-tight text-foreground">
                      {meeting.title}
                    </h1>
                    <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)}>
                      <Edit3 className="w-4 h-4" />
                    </Button>
                  </div>
                )}
                
                <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                  <div className="flex items-center space-x-1">
                    <Calendar className="w-4 h-4" />
                    <span>{formatDate(meeting.date)}</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Clock className="w-4 h-4" />
                    <span>{formatDuration(meeting.duration)}</span>
                  </div>
                  <Badge variant="outline">
                    {meeting.status === 'completed' ? 'Klart' : 
                     meeting.status === 'processing' ? 'Bearbetar' : 'Spelar in'}
                  </Badge>
                </div>
              </div>
            </div>
            
            {meeting.summary && (
              <Button variant="outline" onClick={downloadProtocol}>
                <Download className="w-4 h-4 mr-2" />
                Ladda ner
              </Button>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto p-4 md:p-6">
        <Tabs defaultValue="protocol" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="protocol">Protokoll</TabsTrigger>
            <TabsTrigger value="chat">AI-assistent</TabsTrigger>
            <TabsTrigger value="transcript">Transkribering</TabsTrigger>
          </TabsList>

          <TabsContent value="protocol" className="space-y-6">
            {meeting.summary ? (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="flex items-center space-x-2">
                    <FileText className="w-5 h-5" />
                    <span>Mötesprotokoll</span>
                  </CardTitle>
                  <Button 
                    variant="outline" 
                    onClick={generateNewProtocol}
                    disabled={isGeneratingProtocol}
                  >
                    {isGeneratingProtocol ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Brain className="w-4 h-4 mr-2" />
                    )}
                    Generera nytt
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="prose max-w-none">
                    <ReactMarkdown>{meeting.summary}</ReactMarkdown>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center space-y-4">
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
                        onClick={generateNewProtocol}
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
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="chat" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <MessageSquare className="w-5 h-5" />
                  <span>Chatta om mötet</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ChatInterface 
                  meetingContext={getMeetingContext()}
                  meetingTitle={meeting.title}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="transcript" className="space-y-6">
            {meeting.originalTranscription ? (
              <Card>
                <CardHeader>
                  <CardTitle>Original transkribering</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="bg-muted p-4 rounded-lg">
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">
                      {meeting.originalTranscription}
                    </p>
                  </div>
                </CardContent>
              </Card>
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
  );
};