import React, { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Upload, 
  FileAudio, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  X,
  Loader2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface UploadQueueItem {
  id: string;
  file: File;
  status: 'waiting' | 'processing' | 'completed' | 'error';
  progress: number;
  estimatedTime?: number;
  startTime?: number;
  error?: string;
}

interface FileUploadDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onFileProcessed: (file: File, result: any) => void;
}

export const FileUploadDialog: React.FC<FileUploadDialogProps> = ({
  isOpen,
  onClose,
  onFileProcessed
}) => {
  const [uploadQueue, setUploadQueue] = useState<UploadQueueItem[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const supportedFormats = [
    'audio/mp3', 'audio/mpeg', 'audio/wav', 'audio/m4a', 
    'audio/aac', 'audio/ogg', 'audio/webm', 'audio/mp4',
    'audio/x-m4a', 'audio/mp4a-latm', 'audio/x-mp4',
    'video/mp4', // M4A filer rapporteras ibland som video/mp4
    'application/octet-stream' // Fallback för okända binära filer
  ];

  const estimateProcessingTime = (fileSize: number): number => {
    // Ungefär 8 minuter för 1 timmes möte (60MB fil)
    // Så cirka 0.13 minuter per MB
    const sizeInMB = fileSize / (1024 * 1024);
    return Math.max(1, Math.round(sizeInMB * 0.13)); // Minst 1 minut
  };

  const formatFileSize = (bytes: number): string => {
    const sizes = ['B', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatTime = (minutes: number): string => {
    if (minutes < 1) return '< 1 min';
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}min`;
  };

  const processUploadedFile = async (meeting: any, transcription: string) => {
    try {
      // Simulera progress
      const progressInterval = setInterval(() => {
        // Progress-uppdatering skulle behöva implementeras med state management
        // som kan nås från denna komponent
      }, 2000);

      // Bearbeta med Berget AI
      const { bergetApi } = await import('@/services/bergetApi');
      const result = await bergetApi.summarizeToProtocol(transcription);

      clearInterval(progressInterval);

      toast({
        title: "Bearbetning klar",
        description: `Filen har bearbetats framgångsrikt.`
      });

    } catch (error: any) {
      toast({
        title: "Bearbetning misslyckades",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const addFilesToQueue = (files: File[]) => {
    const validFiles = files.filter(file => {
      if (!supportedFormats.includes(file.type)) {
        toast({
          title: "Filformat stöds inte",
          description: `${file.name} har ett format som inte stöds.`,
          variant: "destructive"
        });
        return false;
      }
      
      if (file.size > 500 * 1024 * 1024) { // 500MB limit
        toast({
          title: "Fil för stor",
          description: `${file.name} är större än 500MB.`,
          variant: "destructive"
        });
        return false;
      }
      
      return true;
    });

    const newItems: UploadQueueItem[] = validFiles.map(file => ({
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      file,
      status: 'waiting',
      progress: 0,
      estimatedTime: estimateProcessingTime(file.size)
    }));

    setUploadQueue(prev => [...prev, ...newItems]);
    
    // Starta bearbetning om kön var tom
    if (uploadQueue.length === 0 && newItems.length > 0) {
      processNextInQueue([...uploadQueue, ...newItems]);
    }
  };

  const processNextInQueue = async (queue: UploadQueueItem[]) => {
    const nextItem = queue.find(item => item.status === 'waiting');
    if (!nextItem) return;

    // Uppdatera status till processing
    setUploadQueue(prev => prev.map(item => 
      item.id === nextItem.id 
        ? { ...item, status: 'processing', startTime: Date.now() }
        : item
    ));

    try {
      // Simulera progress baserat på uppskattad tid
      const progressInterval = setInterval(() => {
        setUploadQueue(prev => prev.map(item => {
          if (item.id === nextItem.id && item.status === 'processing') {
            const elapsed = (Date.now() - (item.startTime || Date.now())) / 1000 / 60; // minuter
            const estimatedTotal = item.estimatedTime || 1;
            const newProgress = Math.min(95, (elapsed / estimatedTotal) * 100);
            return { ...item, progress: newProgress };
          }
          return item;
        }));
      }, 2000);

      // Importera bergetApi dynamiskt
      const { bergetApi } = await import('@/services/bergetApi');
      const result = await bergetApi.transcribeAudio(nextItem.file);

      clearInterval(progressInterval);

      // Uppdatera till completed
      setUploadQueue(prev => prev.map(item => 
        item.id === nextItem.id 
          ? { ...item, status: 'completed', progress: 100 }
          : item
      ));

      // Anropa callback
      onFileProcessed(nextItem.file, result);

      toast({
        title: "Fil bearbetad",
        description: `${nextItem.file.name} har transkriberats framgångsrikt.`
      });

      // Bearbeta nästa fil i kön
      setTimeout(() => {
        setUploadQueue(currentQueue => {
          processNextInQueue(currentQueue);
          return currentQueue;
        });
      }, 1000);

    } catch (error: any) {
      // Uppdatera till error
      setUploadQueue(prev => prev.map(item => 
        item.id === nextItem.id 
          ? { ...item, status: 'error', error: error.message }
          : item
      ));

      toast({
        title: "Bearbetning misslyckades",
        description: `${nextItem.file.name}: ${error.message}`,
        variant: "destructive"
      });

      // Fortsätt med nästa fil trots fel
      setTimeout(() => {
        setUploadQueue(currentQueue => {
          processNextInQueue(currentQueue);
          return currentQueue;
        });
      }, 1000);
    }
  };

  const removeFromQueue = (id: string) => {
    setUploadQueue(prev => prev.filter(item => item.id !== id));
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      addFilesToQueue(files);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    addFilesToQueue(files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const getStatusIcon = (status: UploadQueueItem['status']) => {
    switch (status) {
      case 'waiting':
        return <Clock className="w-4 h-4 text-muted-foreground" />;
      case 'processing':
        return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
    }
  };

  const getStatusText = (status: UploadQueueItem['status']) => {
    switch (status) {
      case 'waiting':
        return 'Väntar';
      case 'processing':
        return 'Bearbetar';
      case 'completed':
        return 'Klart';
      case 'error':
        return 'Fel';
    }
  };

  const clearCompleted = () => {
    setUploadQueue(prev => prev.filter(item => item.status !== 'completed'));
  };

  const hasCompleted = uploadQueue.some(item => item.status === 'completed');
  const isProcessing = uploadQueue.some(item => item.status === 'processing');

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Upload className="w-5 h-5" />
            <span>Ladda upp ljudfiler</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Uppladdningsområde */}
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              isDragOver 
                ? 'border-primary bg-primary/5' 
                : 'border-border hover:border-primary/50'
            }`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            <FileAudio className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">
              Dra och släpp ljudfiler här
            </h3>
            <p className="text-muted-foreground mb-4">
              eller klicka för att välja filer
            </p>
            <Button onClick={() => fileInputRef.current?.click()}>
              Välj filer
            </Button>
            
            <div className="mt-4 text-sm text-muted-foreground">
              <p>Stödda format: MP3, M4A, WAV, AAC, OGG</p>
              <p>Max filstorlek: 500MB per fil</p>
            </div>
          </div>

          {/* Information om bearbetningstid */}
          <Alert>
            <Clock className="h-4 w-4" />
            <AlertDescription>
              <strong>Bearbetningstid:</strong> Ungefär 8 minuter för 1 timmes möte. 
              Filer bearbetas i ordning och du kan ladda upp flera samtidigt.
            </AlertDescription>
          </Alert>

          {/* Kö */}
          {uploadQueue.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">Bearbetningskö ({uploadQueue.length})</h3>
                {hasCompleted && (
                  <Button variant="outline" size="sm" onClick={clearCompleted}>
                    Rensa klara
                  </Button>
                )}
              </div>

              <div className="space-y-3 max-h-60 overflow-y-auto">
                {uploadQueue.map((item) => (
                  <div key={item.id} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2">
                          {getStatusIcon(item.status)}
                          <span className="font-medium truncate">{item.file.name}</span>
                          <Badge variant="outline" className="text-xs">
                            {getStatusText(item.status)}
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">
                          {formatFileSize(item.file.size)}
                          {item.estimatedTime && item.status === 'waiting' && (
                            <span> • Uppskattad tid: {formatTime(item.estimatedTime)}</span>
                          )}
                        </div>
                      </div>
                      
                      {item.status !== 'processing' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFromQueue(item.id)}
                          className="h-8 w-8 p-0"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      )}
                    </div>

                    {item.status === 'processing' && (
                      <div className="space-y-2">
                        <Progress value={item.progress} className="h-2" />
                        <div className="text-xs text-muted-foreground">
                          {Math.round(item.progress)}% • Bearbetar med Berget AI...
                        </div>
                      </div>
                    )}

                    {item.status === 'error' && item.error && (
                      <div className="mt-2 text-sm text-red-600">
                        Fel: {item.error}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Stäng-knapp */}
          <div className="flex justify-end">
            <Button 
              variant="outline" 
              onClick={onClose}
              disabled={isProcessing}
            >
              {isProcessing ? 'Bearbetar...' : 'Stäng'}
            </Button>
          </div>
        </div>

        {/* Gömd filinput */}
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />
      </DialogContent>
    </Dialog>
  );
};
