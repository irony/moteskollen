import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, ExternalLink, Shield, Key } from 'lucide-react';
import { bergetApi } from '@/services/bergetApi';

interface AuthSetupProps {
  onAuthenticated: () => void;
}

export const AuthSetup: React.FC<AuthSetupProps> = ({ onAuthenticated }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'choice' | 'device' | 'manual'>('choice');
  const [deviceAuth, setDeviceAuth] = useState<{
    device_code: string;
    user_code: string;
    verification_uri: string;
    interval: number;
    expires_in: number;
  } | null>(null);
  const [manualKey, setManualKey] = useState('');

  const startDeviceAuth = async (): Promise<void> => {
    try {
      setLoading(true);
      setError('');

      const authData = await bergetApi.initiateDeviceAuth();
      setDeviceAuth(authData);
      setStep('device');

      // Starta polling för token
      pollForToken(authData.device_code, authData.interval);
    } catch (err: any) {
      setError(`Fel vid startande av autentisering: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const pollForToken = async (deviceCode: string, pollingInterval: number): Promise<void> => {
    let attempts = 0;
    const maxAttempts = 60; // Ungefär 5 minuter
    const interval = pollingInterval * 1000; // Konvertera till millisekunder

    const poll = async () => {
      try {
        const response = await bergetApi.getAccessToken(deviceCode);

        if (response.access_token) {
          // Token erhållen - autentisering klar
          localStorage.setItem('berget_token', response.access_token);
          if (response.refresh_token) {
            localStorage.setItem('berget_refresh_token', response.refresh_token);
          }
          onAuthenticated();
        } else if (response.status === 'pending') {
          // Väntar fortfarande på användarens godkännande
          attempts++;
          if (attempts < maxAttempts) {
            setTimeout(poll, interval);
          } else {
            setError('Autentisering tog för lång tid. Försök igen.');
            setStep('choice');
          }
        } else {
          setError(`Autentiseringsfel: ${response.error || 'Okänt fel'}`);
          setStep('choice');
        }
      } catch (err: any) {
        if (err.message.includes('429')) {
          // För många förfrågningar - vänta längre
          attempts++;
          if (attempts < maxAttempts) {
            setTimeout(poll, interval + 2000);
          } else {
            setError('Autentisering tog för lång tid. Försök igen.');
            setStep('choice');
          }
        } else {
          setError(`Nätverksfel: ${err.message}`);
          setStep('choice');
        }
      }
    };

    poll();
  };

  const handleManualKey = (): void => {
    if (!manualKey.trim()) {
      setError('Ange en giltig API-nyckel');
      return;
    }

    try {
      bergetApi.setApiKey(manualKey.trim());
      onAuthenticated();
    } catch (err: any) {
      setError(`Fel vid API-nyckel: ${err.message}`);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted p-4 flex items-center justify-center">
      <Card className="w-full max-w-md shadow-elegant">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-primary rounded-full flex items-center justify-center">
            <Key className="w-8 h-8 text-primary-foreground" />
          </div>
          <div>
            <CardTitle className="text-2xl">Protokoll Klippare</CardTitle>
            <CardDescription className="text-base">
              Powered by Berget AI
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* GDPR/Säkerhetsinformation */}
          <Alert>
            <Shield className="h-4 w-4" />
            <AlertDescription>
              <strong>100% GDPR-kompatibel</strong><br />
              All data bearbetas inom Sverige. Inget skickas utanför EU.
            </AlertDescription>
          </Alert>

          {step === 'choice' && (
            <div className="space-y-4">
              <h3 className="font-semibold">Kom igång med Berget AI</h3>
              
              <Button 
                onClick={startDeviceAuth}
                disabled={loading}
                className="w-full"
                size="lg"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <ExternalLink className="w-4 h-4 mr-2" />
                )}
                Logga in med Berget AI
              </Button>

              <div className="text-center">
                <span className="text-sm text-muted-foreground">eller</span>
              </div>

              <Button 
                variant="outline" 
                onClick={() => setStep('manual')}
                className="w-full"
              >
                Har redan API-nyckel
              </Button>
            </div>
          )}

          {step === 'device' && deviceAuth && (
            <div className="space-y-4 text-center">
              <div className="space-y-2">
                <h3 className="font-semibold">Slutför autentisering</h3>
                <p className="text-sm text-muted-foreground">
                  Öppna länken nedan och ange koden:
                </p>
              </div>

              <div className="bg-muted p-4 rounded-lg">
                <p className="font-mono text-2xl font-bold">
                  {deviceAuth.user_code}
                </p>
              </div>

              <Button asChild className="w-full">
                <a 
                  href={deviceAuth.verification_uri} 
                  target="_blank" 
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Öppna Berget AI
                </a>
              </Button>

              <div className="flex items-center justify-center space-x-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Väntar på godkännande...</span>
              </div>

              <Button 
                variant="ghost" 
                onClick={() => setStep('choice')}
                className="w-full"
              >
                Avbryt
              </Button>
            </div>
          )}

          {step === 'manual' && (
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Ange API-nyckel</h3>
                <Input
                  type="password"
                  placeholder="sk-..."
                  value={manualKey}
                  onChange={(e) => setManualKey(e.target.value)}
                />
              </div>

              <Button 
                onClick={handleManualKey} 
                className="w-full"
                disabled={!manualKey.trim()}
              >
                Fortsätt
              </Button>

              <Button 
                variant="ghost" 
                onClick={() => setStep('choice')}
                className="w-full"
              >
                Tillbaka
              </Button>
            </div>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
};