import { useState, useCallback } from 'react';
import { bergetApi } from '@/services/bergetApi';
import { securityService } from '@/lib/security';

interface DeviceAuthData {
  device_code: string;
  user_code: string;
  verification_uri: string;
  interval: number;
  expires_in: number;
}

interface UseBergetAuthResult {
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  deviceAuth: DeviceAuthData | null;
  startDeviceAuth: () => Promise<void>;
  authenticateWithApiKey: (apiKey: string) => Promise<void>;
  logout: () => void;
  checkAuthStatus: () => boolean;
}

export const useBergetAuth = (): UseBergetAuthResult => {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    // Kontrollera om användaren redan är autentiserad
    const bergetToken = securityService.getSecureToken('berget_token');
    const apiKey = bergetApi.getApiKey();
    return !!(bergetToken || apiKey);
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deviceAuth, setDeviceAuth] = useState<DeviceAuthData | null>(null);

  const checkAuthStatus = useCallback((): boolean => {
    const bergetToken = securityService.getSecureToken('berget_token');
    const apiKey = bergetApi.getApiKey();
    const authenticated = !!(bergetToken || apiKey);
    setIsAuthenticated(authenticated);
    return authenticated;
  }, []);

  const startDeviceAuth = useCallback(async (): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);

      const authData = await bergetApi.initiateDeviceAuth();
      setDeviceAuth(authData);

      // Starta polling för token
      pollForToken(authData.device_code, authData.interval);
    } catch (err: any) {
      setError(securityService.createSafeErrorMessage(err));
      setIsLoading(false);
    }
  }, []);

  const pollForToken = async (deviceCode: string, pollingInterval: number): Promise<void> => {
    let attempts = 0;
    const maxAttempts = 60; // Ungefär 5 minuter
    const interval = pollingInterval * 1000;

    const poll = async () => {
      try {
        const response = await bergetApi.getAccessToken(deviceCode);

        if (response.access_token || response.token) {
          const token = response.access_token || response.token;
          
          try {
            // Skapa API-nyckel med access token
            await bergetApi.createApiKey(token);
            
            // Spara tokens säkert
            securityService.setSecureToken('berget_token', token);
            if (response.refresh_token) {
              securityService.setSecureToken('berget_refresh_token', response.refresh_token);
            }
            
            setIsAuthenticated(true);
            setIsLoading(false);
            setDeviceAuth(null);
          } catch (apiError: any) {
            console.error('API key creation error:', apiError);
            setError(securityService.createSafeErrorMessage(apiError));
            setIsLoading(false);
          }
        } else if (response.status === 'pending') {
          attempts++;
          if (attempts < maxAttempts) {
            setTimeout(poll, interval);
          } else {
            setError('Autentisering tog för lång tid. Försök igen.');
            setIsLoading(false);
            setDeviceAuth(null);
          }
        } else {
          setError(`Autentiseringsfel: ${response.error || 'Okänt fel'}`);
          setIsLoading(false);
          setDeviceAuth(null);
        }
      } catch (err: any) {
        if (err.message.includes('429')) {
          attempts++;
          if (attempts < maxAttempts) {
            setTimeout(poll, interval + 2000);
          } else {
            setError('Autentisering tog för lång tid. Försök igen.');
            setIsLoading(false);
            setDeviceAuth(null);
          }
        } else {
          setError(securityService.createSafeErrorMessage(err));
          setIsLoading(false);
          setDeviceAuth(null);
        }
      }
    };

    poll();
  };

  const authenticateWithApiKey = useCallback(async (apiKey: string): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);

      const sanitizedKey = securityService.sanitizeInput(apiKey.trim());
      bergetApi.setApiKey(sanitizedKey);
      
      setIsAuthenticated(true);
      setIsLoading(false);
    } catch (err: any) {
      setError(securityService.createSafeErrorMessage(err));
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback((): void => {
    securityService.clearAllAuthData();
    bergetApi.clearApiKey();
    setIsAuthenticated(false);
    setDeviceAuth(null);
    setError(null);
  }, []);

  return {
    isAuthenticated,
    isLoading,
    error,
    deviceAuth,
    startDeviceAuth,
    authenticateWithApiKey,
    logout,
    checkAuthStatus
  };
};
