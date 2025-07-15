import React, { useState, useEffect } from 'react';
import { AuthSetup } from '@/components/AuthSetup';
import { TranscriptionApp } from '@/components/TranscriptionApp';
import { ProtocolList } from '@/components/ProtocolList';
import { bergetApi } from '@/services/bergetApi';

type AppState = 'auth' | 'main' | 'protocols';

const Index = () => {
  const [appState, setAppState] = useState<AppState>('auth');

  useEffect(() => {
    // Kontrollera om användaren redan är autentiserad
    const apiKey = bergetApi.getApiKey();
    if (apiKey) {
      setAppState('main');
    }
  }, []);

  const handleAuthenticated = () => {
    setAppState('main');
  };

  const handleLogout = () => {
    bergetApi.clearApiKey();
    setAppState('auth');
  };

  const showProtocols = () => {
    setAppState('protocols');
  };

  const showMain = () => {
    setAppState('main');
  };

  switch (appState) {
    case 'auth':
      return <AuthSetup onAuthenticated={handleAuthenticated} />;
    
    case 'protocols':
      return <ProtocolList onBack={showMain} />;
    
    case 'main':
    default:
      return (
        <TranscriptionApp 
          onShowProtocols={showProtocols}
          onLogout={handleLogout}
        />
      );
  }
};

export default Index;
