import React, { useState, useEffect } from 'react';
import { AuthSetup } from '@/components/AuthSetup';
import { TranscriptionApp } from '@/components/TranscriptionApp';
import { MeetingList } from '@/components/MeetingList';
import { MeetingDetail } from '@/components/MeetingDetail';
import { bergetApi } from '@/services/bergetApi';
import { securityService } from '@/lib/security';

type AppState = 'auth' | 'meetings' | 'recording' | 'meeting-detail';

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

const Index = () => {
  const [appState, setAppState] = useState<AppState>('auth');
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);

  useEffect(() => {
    // Kontrollera om användaren redan är autentiserad
    const bergetToken = securityService.getSecureToken('berget_token');
    const apiKey = bergetApi.getApiKey();
    if (bergetToken || apiKey) {
      setAppState('meetings'); // Startar på möteslistan istället för inspelning
    }
  }, []);

  const handleAuthenticated = () => {
    setAppState('meetings');
  };

  const handleLogout = () => {
    // Rensa alla autentiseringsdata säkert
    securityService.clearAllAuthData();
    bergetApi.clearApiKey();
    setAppState('auth');
    setSelectedMeeting(null);
  };

  const handleSelectMeeting = (meeting: Meeting) => {
    setSelectedMeeting(meeting);
    setAppState('meeting-detail');
  };

  const handleStartNewRecording = () => {
    setAppState('recording');
    setSelectedMeeting(null);
  };

  const handleBackToMeetings = () => {
    setAppState('meetings');
    setSelectedMeeting(null);
  };

  const handleUpdateMeeting = (updatedMeeting: Meeting) => {
    // Uppdatera mötet i localStorage
    const savedMeetings = JSON.parse(localStorage.getItem('meetings') || '[]');
    const updatedMeetings = savedMeetings.map((m: any) => 
      m.id === updatedMeeting.id ? updatedMeeting : m
    );
    localStorage.setItem('meetings', JSON.stringify(updatedMeetings));
    setSelectedMeeting(updatedMeeting);
  };

  switch (appState) {
    case 'auth':
      return <AuthSetup onAuthenticated={handleAuthenticated} />;
    
    case 'meetings':
      return (
        <MeetingList 
          onLogout={handleLogout}
          onSelectMeeting={handleSelectMeeting}
          onStartNewRecording={handleStartNewRecording}
        />
      );
    
    case 'recording':
      return <TranscriptionApp onLogout={handleLogout} />;
    
    case 'meeting-detail':
      return selectedMeeting ? (
        <MeetingDetail 
          meeting={selectedMeeting}
          onBack={handleBackToMeetings}
          onUpdateMeeting={handleUpdateMeeting}
        />
      ) : null;
    
    default:
      return <MeetingList 
        onLogout={handleLogout}
        onSelectMeeting={handleSelectMeeting}
        onStartNewRecording={handleStartNewRecording}
      />;
  }
};

export default Index;
