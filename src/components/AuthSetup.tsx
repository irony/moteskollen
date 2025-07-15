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
  const [deviceAuthData, setDeviceAuthData] = useState<any>(null);
  const [manualKey, setManualKey] = useState('');

  const startDeviceAuth = async () => {
    setLoading(true);
    setError(null);
    try {
      const authData = await bergetApi.initiateDeviceAuth();
      setDeviceAuthData(authData);
      setStep('device');
      
      // Starta polling för att vänta på användarens godkännande
      pollForToken(authData.device_code);
    } catch (err) {
      setError('Kunde inte starta enhetsautentisering');
    } finally {
      setLoading(false);
    }
  };

  const pollForToken = async (deviceCode: string) => {
    const maxAttempts = 30; // 5 minuter med 10 sekunders intervall
    let attempts = 0;

    const poll = async () => {
      try {
        await bergetApi.getAccessToken(deviceCode);
        onAuthenticated();
      } catch (err: any) {
        attempts++;
        
        if (err.message.includes('authorization_pending')) {
          if (attempts < maxAttempts) {
            setTimeout(poll, 10000); // Försök igen om 10 sekunder
          } else {
            setError('Tidsgränsen för autentisering har löpt ut. Försök igen.');
            setStep('choice');
          }
        } else if (err.message.includes('slow_down')) {
          setTimeout(poll, 15000); // Vänta lite längre
        } else {
          setError(`Autentisering misslyckades: ${err.message}`);
          setStep('choice');
        }
      }
    };

    poll();
  };

  const handleManualKey = () => {
    if (!manualKey.trim()) {
      setError('Ange en giltig API-nyckel');
      return;
    }

    bergetApi.setApiKey(manualKey.trim());
    onAuthenticated();
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
                Skapa konto / Logga in med Berget AI
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

          {step === 'device' && deviceAuthData && (
            <div className="space-y-4 text-center">
              <div className="space-y-2">
                <h3 className="font-semibold">Slutför autentisering</h3>
                <p className="text-sm text-muted-foreground">
                  Öppna länken nedan och ange koden:
                </p>
              </div>

              <div className="bg-muted p-4 rounded-lg">
                <p className="font-mono text-2xl font-bold">
                  {deviceAuthData.user_code}
                </p>
              </div>

              <Button asChild className="w-full">
                <a 
                  href={deviceAuthData.verification_uri} 
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