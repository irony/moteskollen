import React, { createContext, useContext, ReactNode } from 'react';
import { useBergetAuth } from '@/hooks/useBergetAuth';

interface BergetAuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  deviceAuth: {
    device_code: string;
    user_code: string;
    verification_uri: string;
    interval: number;
    expires_in: number;
  } | null;
  startDeviceAuth: () => Promise<void>;
  authenticateWithApiKey: (apiKey: string) => Promise<void>;
  logout: () => void;
  checkAuthStatus: () => boolean;
}

const BergetAuthContext = createContext<BergetAuthContextType | undefined>(undefined);

export const useBergetAuthContext = () => {
  const context = useContext(BergetAuthContext);
  if (!context) {
    throw new Error('useBergetAuthContext must be used within a BergetAuthProvider');
  }
  return context;
};

interface BergetAuthProviderProps {
  children: ReactNode;
}

export const BergetAuthProvider: React.FC<BergetAuthProviderProps> = ({ children }) => {
  const auth = useBergetAuth();

  return (
    <BergetAuthContext.Provider value={auth}>
      {children}
    </BergetAuthContext.Provider>
  );
};
