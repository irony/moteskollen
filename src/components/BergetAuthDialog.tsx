import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, ExternalLink, Shield, Key } from 'lucide-react';
import { useBergetAuthContext } from './BergetAuthProvider';

interface BergetAuthDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthenticated?: () => void;
  title?: string;
  description?: string;
  showGDPRInfo?: boolean;
}

export const BergetAuthDialog: React.FC<BergetAuthDialogProps> = ({
  isOpen,
  onClose,
  onAuthenticated,
  title = "Autentisera med Berget AI",
  description = "Powered by Berget AI",
  showGDPRInfo = true
}) => {
  const {
    isLoading,
    error,
    deviceAuth,
    startDeviceAuth,
    authenticateWithApiKey
  } = useBergetAuthContext();

  const [step, setStep] = React.useState<'choice' | 'device' | 'manual'>('choice');
  const [manualKey, setManualKey] = React.useState('');

  React.useEffect(() => {
    if (isOpen) {
      setStep('choice');
      setManualKey('');
    }
  }, [isOpen]);

  const handleDeviceAuth = async () => {
    await startDeviceAuth();
    setStep('device');
  };

  const handleManualAuth = async () => {
    if (!manualKey.trim()) {
      return;
    }
    await authenticateWithApiKey(manualKey);
    if (onAuthenticated) {
      onAuthenticated();
    }
    onClose();
  };

  const handleAuthSuccess = () => {
    if (onAuthenticated) {
      onAuthenticated();
    }
    onClose();
  };

  // Lyssna på autentiseringsframgång
  React.useEffect(() => {
    if (!isLoading && !error && !deviceAuth && step === 'device') {
      handleAuthSuccess();
    }
  }, [isLoading, error, deviceAuth, step]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 flex items-center justify-center">
            <img src="/logo.svg" alt="Möteskollen" className="w-16 h-16" />
          </div>
          <div>
            <DialogTitle className="text-2xl">{title}</DialogTitle>
            <CardDescription className="text-base">
              {description}
            </CardDescription>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* GDPR/Säkerhetsinformation */}
          {showGDPRInfo && (
            <Alert>
              <Shield className="h-4 w-4" />
              <AlertDescription>
                <strong>100% GDPR-kompatibel</strong><br />
                All data bearbetas inom Sverige. Inget skickas utanför EU.
              </AlertDescription>
            </Alert>
          )}

          {step === 'choice' && (
            <div className="space-y-4">
              <h3 className="font-semibold">Kom igång med Berget AI</h3>
              
              <Button 
                onClick={handleDeviceAuth}
                disabled={isLoading}
                className="w-full"
                size="lg"
              >
                {isLoading ? (
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
                  onKeyDown={(e) => e.key === 'Enter' && handleManualAuth()}
                />
              </div>

              <Button 
                onClick={handleManualAuth} 
                className="w-full"
                disabled={!manualKey.trim() || isLoading}
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : null}
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
        </div>
      </DialogContent>
    </Dialog>
  );
};
