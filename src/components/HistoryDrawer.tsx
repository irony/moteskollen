import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  X, 
  Clock, 
  Calendar, 
  Mic, 
  CheckCircle, 
  Loader2, 
  AlertCircle,
  Trash2,
  Edit3,
  MessageSquare,
  Play
} from 'lucide-react';
import { formatDistance } from 'date-fns';
import { sv } from 'date-fns/locale';

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

interface HistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  meetings: Meeting[];
  onSelectMeeting: (meeting: Meeting) => void;
  onDeleteMeeting: (meetingId: string) => void;
  onEditMeetingTitle: (meetingId: string, newTitle: string) => void;
  onStartChat: (meeting: Meeting) => void;
}

export const HistoryDrawer: React.FC<HistoryDrawerProps> = ({
  isOpen,
  onClose,
  meetings,
  onSelectMeeting,
  onDeleteMeeting,
  onEditMeetingTitle,
  onStartChat
}) => {
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editTitle, setEditTitle] = React.useState('');

  const handleEditStart = (meeting: Meeting) => {
    setEditingId(meeting.id);
    setEditTitle(meeting.title);
  };

  const handleEditSave = (meetingId: string) => {
    if (editTitle.trim()) {
      onEditMeetingTitle(meetingId, editTitle.trim());
    }
    setEditingId(null);
    setEditTitle('');
  };

  const handleEditCancel = () => {
    setEditingId(null);
    setEditTitle('');
  };

  const getStatusIcon = (status: Meeting['status']) => {
    switch (status) {
      case 'recording':
        return <Mic className="w-4 h-4 text-red-500" />;
      case 'processing':
        return <Loader2 className="w-4 h-4 text-yellow-500 animate-spin" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      default:
        return <AlertCircle className="w-4 h-4 text-gray-500" />;
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
        return 'Okänd';
    }
  };

  const getStatusColor = (status: Meeting['status']) => {
    switch (status) {
      case 'recording':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'processing':
        return 'bg-yellow-50 text-yellow-700 border-yellow-200';
      case 'completed':
        return 'bg-green-50 text-green-700 border-green-200';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  const sortedMeetings = [...meetings].sort((a, b) => {
    const dateA = new Date(a.date).getTime();
    const dateB = new Date(b.date).getTime();
    return dateB - dateA; // Senaste mötet först
  });

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/20 z-40 transition-opacity"
          onClick={onClose}
        />
      )}
      
      {/* Drawer */}
      <div className={`
        fixed bottom-0 left-0 right-0 z-50 
        bg-background/95 backdrop-blur-lg border-t border-border/30
        transform transition-transform duration-300 ease-out
        ${isOpen ? 'translate-y-0' : 'translate-y-full'}
        max-h-[70vh] overflow-hidden
      `}>
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border/30">
            <div className="flex items-center space-x-2">
              <Clock className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold">Möteshistorik</h2>
              <Badge variant="secondary" className="rounded-full">
                {meetings.length}
              </Badge>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="rounded-full w-8 h-8 p-0"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Content */}
          <div className="p-4 overflow-y-auto max-h-[calc(70vh-80px)]">
            {sortedMeetings.length === 0 ? (
              <div className="text-center py-12">
                <Clock className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Inga möten än</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Starta din första inspelning för att komma igång
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {sortedMeetings.map((meeting) => (
                  <Card key={meeting.id} className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          {editingId === meeting.id ? (
                            <div className="flex items-center space-x-2">
                              <input
                                type="text"
                                value={editTitle}
                                onChange={(e) => setEditTitle(e.target.value)}
                                className="flex-1 px-2 py-1 border rounded-md text-sm"
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleEditSave(meeting.id);
                                  if (e.key === 'Escape') handleEditCancel();
                                }}
                                autoFocus
                              />
                              <Button
                                size="sm"
                                onClick={() => handleEditSave(meeting.id)}
                                className="h-7 px-2"
                              >
                                Spara
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={handleEditCancel}
                                className="h-7 px-2"
                              >
                                Avbryt
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center space-x-2">
                              <CardTitle className="text-base font-medium cursor-pointer hover:text-primary transition-colors"
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
                          
                          <div className="flex items-center space-x-4 mt-2 text-sm text-muted-foreground">
                            <div className="flex items-center space-x-1">
                              <Calendar className="w-3 h-3" />
                              <span>{formatDistance(new Date(meeting.date), new Date(), { addSuffix: true, locale: sv })}</span>
                            </div>
                            {meeting.duration && (
                              <div className="flex items-center space-x-1">
                                <Clock className="w-3 h-3" />
                                <span>{Math.floor(meeting.duration / 60)}:{(meeting.duration % 60).toString().padStart(2, '0')}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <Badge variant="outline" className={getStatusColor(meeting.status)}>
                            <div className="flex items-center space-x-1">
                              {getStatusIcon(meeting.status)}
                              <span>{getStatusText(meeting.status)}</span>
                            </div>
                          </Badge>
                          
                          {meeting.status === 'completed' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onStartChat(meeting)}
                              className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                            >
                              <MessageSquare className="w-4 h-4" />
                            </Button>
                          )}
                          
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onDeleteMeeting(meeting.id)}
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    
                    {meeting.summary && (
                      <CardContent className="pt-0">
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {meeting.summary.replace(/[#*]/g, '').substring(0, 120)}...
                        </p>
                        
                        {meeting.actionItems && meeting.actionItems.length > 0 && (
                          <div className="mt-2 flex items-center space-x-2">
                            <span className="text-xs text-muted-foreground">Handlingspoäng:</span>
                            <Badge variant="secondary" className="text-xs">
                              {meeting.actionItems.length}
                            </Badge>
                          </div>
                        )}
                      </CardContent>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};