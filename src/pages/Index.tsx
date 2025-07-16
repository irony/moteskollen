import React, { useState, useEffect } from 'react';
import { AuthSetup } from '@/components/AuthSetup';
import { TranscriptionApp } from '@/components/TranscriptionApp';
import { MeetingList } from '@/components/MeetingList';
import { MeetingDetail } from '@/components/MeetingDetail';
import { FloatingViewSelector } from '@/components/FloatingViewSelector';
import { bergetApi } from '@/services/bergetApi';
import { securityService } from '@/lib/security';

type AppState = 'auth' | 'live' | 'history' | 'meeting-detail';
type ViewMode = 'live' | 'history';

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
  const [currentView, setCurrentView] = useState<ViewMode>('history');
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);

  useEffect(() => {
    // Kontrollera om användaren redan är autentiserad
    const bergetToken = securityService.getSecureToken('berget_token');
    const apiKey = bergetApi.getApiKey();
    if (bergetToken || apiKey) {
      setAppState('history'); // Startar på historik
    }
  }, []);

  const handleAuthenticated = () => {
    setAppState('history');
  };

  const handleLogout = () => {
    // Rensa alla autentiseringsdata säkert
    securityService.clearAllAuthData();
    bergetApi.clearApiKey();
    setAppState('auth');
    setCurrentView('history');
    setSelectedMeeting(null);
  };

  const handleViewChange = (view: ViewMode) => {
    setCurrentView(view);
    setAppState(view);
    setSelectedMeeting(null);
  };

  const handleSelectMeeting = (meeting: Meeting) => {
    setSelectedMeeting(meeting);
    setAppState('meeting-detail');
  };

  const handleBackToHistory = () => {
    setAppState('history');
    setCurrentView('history');
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

  // Visa floating selector endast när användaren är autentiserad
  const showFloatingSelector = appState !== 'auth';

  switch (appState) {
    case 'auth':
      return <AuthSetup onAuthenticated={handleAuthenticated} />;
    
    case 'history':
      return (
        <>
          <FloatingViewSelector 
            currentView={currentView}
            onViewChange={handleViewChange}
            className="fixed bottom-20 left-1/2 transform -translate-x-1/2 z-30"
          />
          <MeetingList 
            onLogout={handleLogout}
            onSelectMeeting={handleSelectMeeting}
            onStartRecording={() => handleViewChange('live')}
          />
        </>
      );
    
    case 'live':
      return (
        <>
          <FloatingViewSelector 
            currentView={currentView}
            onViewChange={handleViewChange}
            className="fixed bottom-24 left-1/2 transform -translate-x-1/2 z-30"
          />
          <TranscriptionApp 
            onLogout={handleLogout}
          />
        </>
      );
    
    case 'meeting-detail':
      return selectedMeeting ? (
        <MeetingDetail 
          meeting={selectedMeeting}
          onBack={handleBackToHistory}
          onUpdateMeeting={handleUpdateMeeting}
        />
      ) : null;
    
    default:
      return (
        <>
          <FloatingViewSelector 
            currentView={currentView}
            onViewChange={handleViewChange}
            className="fixed bottom-20 left-1/2 transform -translate-x-1/2 z-30"
          />
          <MeetingList 
            onLogout={handleLogout}
            onSelectMeeting={handleSelectMeeting}
            onStartRecording={() => handleViewChange('live')}
          />
        </>
      );
  }
};

export default Index;
