import React from 'react';
import { BergetAuthProvider, useBergetAuthContext } from './BergetAuthProvider';
import { BergetAuthDialog } from './BergetAuthDialog';

interface AuthSetupProps {
  onAuthenticated: () => void;
}

const AuthSetupContent: React.FC<AuthSetupProps> = ({ onAuthenticated }) => {
  const { isAuthenticated } = useBergetAuthContext();

  React.useEffect(() => {
    if (isAuthenticated) {
      onAuthenticated();
    }
  }, [isAuthenticated, onAuthenticated]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted p-4 flex items-center justify-center">
      <BergetAuthDialog
        isOpen={true}
        onClose={() => {}} // Kan inte stängas i denna kontext
        onAuthenticated={onAuthenticated}
        title="Möteskollen"
        description="Powered by Berget AI"
        showGDPRInfo={true}
      />
    </div>
  );
};

export const AuthSetup: React.FC<AuthSetupProps> = ({ onAuthenticated }) => {
  return (
    <BergetAuthProvider>
      <AuthSetupContent onAuthenticated={onAuthenticated} />
    </BergetAuthProvider>
  );
};
