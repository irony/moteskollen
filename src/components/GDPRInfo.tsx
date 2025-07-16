import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Shield, Server, Smartphone, Cloud, HardDrive, Eye, X } from 'lucide-react';

interface GDPRInfoProps {
  children: React.ReactNode;
}

export const GDPRInfo: React.FC<GDPRInfoProps> = ({ children }) => {
  return (
    <Dialog>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Shield className="w-5 h-5 text-green-600" />
            <span>GDPR & Datasäkerhet</span>
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Sammanfattning */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">100% GDPR-kompatibel</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                All data bearbetas inom Sverige och EU. Vi följer strikta säkerhetsprotokoll 
                och du behåller full kontroll över dina uppgifter.
              </p>
            </CardContent>
          </Card>

          {/* Data flödesdiagram */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Dataflöde & Säkerhet</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-muted/30 p-4 rounded-lg">
                <div className="mermaid">
{`graph TD
    A[📱 Din Enhet] --> B[🔒 Lokal Lagring]
    A --> C[🎤 Ljudinspelning]
    
    C --> D[📡 Säker Överföring<br/>HTTPS + Kryptering]
    D --> E[🇸🇪 Svenska Servrar<br/>Berget Speech API]
    
    E --> F[🧠 AI-Bearbetning<br/>Inom EU]
    F --> G[📄 Transkription & Analys]
    
    G --> H[⬇️ Säker Retur]
    H --> B
    
    B --> I[💾 Permanent Lagring<br/>Endast på din enhet]
    
    style A fill:#e1f5fe
    style B fill:#e8f5e8
    style E fill:#fff3e0
    style F fill:#f3e5f5
    style I fill:#e8f5e8
    
    classDef secure fill:#e8f5e8,stroke:#4caf50,stroke-width:2px
    classDef processing fill:#fff3e0,stroke:#ff9800,stroke-width:2px
    classDef device fill:#e1f5fe,stroke:#2196f3,stroke-width:2px
    
    class A,I device
    class B,I secure
    class E,F processing`}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Detaljerad information */}
          <div className="grid md:grid-cols-2 gap-4">
            {/* Lokal lagring */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Smartphone className="w-4 h-4 text-blue-600" />
                  <span>Lokal Lagring</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-start space-x-2">
                  <Badge variant="outline" className="text-green-600 border-green-600">
                    <HardDrive className="w-3 h-3 mr-1" />
                    Säkert
                  </Badge>
                  <div>
                    <p className="font-medium">Mötesdata & Transkriptioner</p>
                    <p className="text-sm text-muted-foreground">
                      Sparas endast i din webbläsare. Ingen access för andra.
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start space-x-2">
                  <Badge variant="outline" className="text-green-600 border-green-600">
                    <Eye className="w-3 h-3 mr-1" />
                    Privat
                  </Badge>
                  <div>
                    <p className="font-medium">Användarinställningar</p>
                    <p className="text-sm text-muted-foreground">
                      Personliga inställningar lagras lokalt.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Server-bearbetning */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Server className="w-4 h-4 text-orange-600" />
                  <span>Server-bearbetning</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-start space-x-2">
                  <Badge variant="outline" className="text-orange-600 border-orange-600">
                    <Cloud className="w-3 h-3 mr-1" />
                    Tillfälligt
                  </Badge>
                  <div>
                    <p className="font-medium">Ljudfiler för transkription</p>
                    <p className="text-sm text-muted-foreground">
                      Raderas automatiskt efter bearbetning (max 24h).
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start space-x-2">
                  <Badge variant="outline" className="text-orange-600 border-orange-600">
                    <Shield className="w-3 h-3 mr-1" />
                    Krypterat
                  </Badge>
                  <div>
                    <p className="font-medium">Säker överföring</p>
                    <p className="text-sm text-muted-foreground">
                      All data krypteras under transport (HTTPS + TLS 1.3).
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Rättigheter */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Dina rättigheter enligt GDPR</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <h4 className="font-medium">✅ Rätt till information</h4>
                  <p className="text-sm text-muted-foreground">Du vet alltid vad som händer med din data</p>
                  
                  <h4 className="font-medium">✅ Rätt till radering</h4>
                  <p className="text-sm text-muted-foreground">Radera dina möten när du vill</p>
                </div>
                
                <div className="space-y-2">
                  <h4 className="font-medium">✅ Rätt till portabilitet</h4>
                  <p className="text-sm text-muted-foreground">Exportera din data i standardformat</p>
                  
                  <h4 className="font-medium">✅ Rätt till kontroll</h4>
                  <p className="text-sm text-muted-foreground">Full kontroll över vad som delas</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Kontaktinfo */}
          <Card className="bg-muted/30">
            <CardContent className="pt-6">
              <div className="text-center space-y-2">
                <p className="text-sm text-muted-foreground">
                  <strong>Frågor om datasäkerhet?</strong>
                </p>
                <p className="text-sm text-muted-foreground">
                  Kontakta oss på: <span className="font-medium">privacy@möteskollen.se</span>
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
};