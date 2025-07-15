import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Calendar, FileText, Trash2, Download } from 'lucide-react';
import { format } from 'date-fns';
import { sv } from 'date-fns/locale';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Protocol {
  id: string;
  date: Date;
  title: string;
  summary: string;
  actionItems: string[];
  originalTranscription: string;
}

interface ProtocolListProps {
  onBack: () => void;
}

export const ProtocolList: React.FC<ProtocolListProps> = ({ onBack }) => {
  const [protocols, setProtocols] = useState<Protocol[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProtocol, setSelectedProtocol] = useState<Protocol | null>(null);

  useEffect(() => {
    loadProtocols();
  }, []);

  const loadProtocols = () => {
    const saved = localStorage.getItem('meeting_protocols');
    if (saved) {
      const parsed = JSON.parse(saved);
      const protocols = parsed.map((p: any) => ({
        ...p,
        date: new Date(p.date)
      }));
      setProtocols(protocols.sort((a: Protocol, b: Protocol) => b.date.getTime() - a.date.getTime()));
    }
  };

  const deleteProtocol = (id: string) => {
    const updatedProtocols = protocols.filter(p => p.id !== id);
    setProtocols(updatedProtocols);
    localStorage.setItem('meeting_protocols', JSON.stringify(updatedProtocols));
    setSelectedProtocol(null);
  };

  const exportProtocol = (protocol: Protocol) => {
    const content = `# MÖTESPROTOKOLL
**Datum:** ${format(protocol.date, 'PPP', { locale: sv })}  
**Titel:** ${protocol.title}

## SAMMANFATTNING
${protocol.summary}

${protocol.actionItems.length > 0 ? `## HANDLINGSPLAN
${protocol.actionItems.map(item => `- ${item}`).join('\n')}

` : ''}## FULLSTÄNDIG TRANSKRIBERING
${protocol.originalTranscription}
---
*Genererat av M - Powered by Berget AI*`;

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `protokoll-${format(protocol.date, 'yyyy-MM-dd')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const filteredProtocols = protocols.filter(protocol =>
    protocol.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    protocol.summary.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (selectedProtocol) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <Button variant="outline" onClick={() => setSelectedProtocol(null)}>
              ← Tillbaka till lista
            </Button>
            <div className="flex space-x-2">
              <Button 
                variant="outline" 
                onClick={() => exportProtocol(selectedProtocol)}
              >
                <Download className="w-4 h-4 mr-2" />
                Exportera
              </Button>
              <Button 
                variant="destructive" 
                onClick={() => deleteProtocol(selectedProtocol.id)}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Ta bort
              </Button>
            </div>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-2xl">{selectedProtocol.title}</CardTitle>
                <Badge variant="outline">
                  <Calendar className="w-4 h-4 mr-1" />
                  {format(selectedProtocol.date, 'PPP', { locale: sv })}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-3">Sammanfattning</h3>
                <div className="bg-muted p-4 rounded-lg prose dark:prose-invert max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {selectedProtocol.summary}
                  </ReactMarkdown>
                </div>
              </div>

              {selectedProtocol.actionItems.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-3">Handlingsplan</h3>
                  <ul className="space-y-2">
                    {selectedProtocol.actionItems.map((item, index) => (
                      <li key={index} className="flex items-start space-x-2">
                        <span className="w-2 h-2 bg-warning rounded-full mt-2 flex-shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div>
                <h3 className="text-lg font-semibold mb-3">Fullständig transkribering</h3>
                <div className="bg-muted p-4 rounded-lg prose dark:prose-invert max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {selectedProtocol.originalTranscription}
                  </ReactMarkdown>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Mötesprotokoll</h1>
          <Button variant="outline" onClick={onBack}>
            ← Tillbaka
          </Button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Sök i protokoll..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {filteredProtocols.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <FileText className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                {protocols.length === 0 ? 'Inga protokoll ännu' : 'Inga matchande protokoll'}
              </h3>
              <p className="text-muted-foreground">
                {protocols.length === 0 
                  ? 'Börja med att spela in ditt första möte'
                  : 'Försök med andra söktermer'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {filteredProtocols.map((protocol) => (
              <Card 
                key={protocol.id} 
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => setSelectedProtocol(protocol)}
              >
                <CardContent className="p-6">
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="text-lg font-semibold">{protocol.title}</h3>
                    <Badge variant="outline">
                      {format(protocol.date, 'PPp', { locale: sv })}
                    </Badge>
                  </div>
                  
                  <p className="text-muted-foreground mb-3 line-clamp-2">
                    {protocol.summary.substring(0, 200)}...
                  </p>

                  <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                    {protocol.actionItems.length > 0 && (
                      <span>{protocol.actionItems.length} handlingspoäng</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};