import { useState, useRef, useCallback, useEffect } from 'react';
import { useTranscriptionQueue } from './useTranscriptionQueue';
import { useAudioRecorder } from './useAudioRecorder';

// Speech Recognition types (inline för att undvika import-problem)
interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: {
    readonly length: number;
    [index: number]: {
      readonly isFinal: boolean;
      readonly length: number;
      [index: number]: {
        readonly transcript: string;
        readonly confidence: number;
      };
    };
  };
}

interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string;
  readonly message: string;
}

interface TranscriptionSegment {
  id: string;
  text: string;
  timestamp: Date;
  isLocal: boolean; // true = Speech API, false = Berget AI
  audioStart: number;
  audioEnd?: number;
  confidence?: number;
}

interface UseHybridTranscriptionResult {
  isRecording: boolean;
  audioLevel: number;
  segments: TranscriptionSegment[];
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
  error: string | null;
}

export const useHybridTranscription = (
  onBergetTranscription?: (text: string) => void,
  options?: {
    maxWordsPerSegment?: number;
    enableFullMeetingProcessing?: boolean;
  }
): UseHybridTranscriptionResult => {
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);
  const segmentStartTimeRef = useRef<number>(0);
  const recordingStartTimeRef = useRef<number>(0);
  const fullMeetingAudioRef = useRef<Blob[]>([]);

  // Använd den nya TranscriptionQueue med options
  const transcriptionQueue = useTranscriptionQueue({
    maxWordsPerSegment: options?.maxWordsPerSegment || 12,
    retryDelayMs: 1000
  });
  
  // Använd AudioRecorder för ljudhantering
  const audioRecorder = useAudioRecorder((audioChunk) => {
    // Spara för fullständig mötesbearbetning
    fullMeetingAudioRef.current.push(audioChunk);
    
    // När vi får en audio chunk, skapa ett segment och skicka till transcription queue
    const now = new Date();
    const audioTime = (now.getTime() - recordingStartTimeRef.current) / 1000;
    
    const segmentId = `audio-${Date.now()}`;
    
    transcriptionQueue.addSegment({
      id: segmentId,
      text: 'Bearbetar ljud...', // Placeholder text medan Berget AI bearbetar
      audioStart: audioTime - 8, // 8 sekunder bakåt (chunk-storlek)
      audioEnd: audioTime,
      confidence: 0.5,
      source: 'webspeech',
      audioData: audioChunk,
      segmentType: 'live'
    });
    
    console.log('Audio chunk sent to TranscriptionQueue for Berget AI processing');
  }, 8000);

  // Kontrollera Speech API support
  const speechSupported = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;

  const setupSpeechRecognition = useCallback(() => {
    if (!speechSupported) return null;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'sv-SE';
    recognition.maxAlternatives = 1;

    let pendingSegmentId: string | null = null;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const lastResult = event.results[event.results.length - 1];
      const transcript = lastResult[0].transcript;
      const confidence = lastResult[0].confidence;
      const isFinal = lastResult.isFinal;

      const now = new Date();
      const audioTime = (now.getTime() - recordingStartTimeRef.current) / 1000;

      if (isFinal) {
        // Final resultat - lägg till i transcription queue
        const segmentId = pendingSegmentId || `speech-${Date.now()}`;
        
        transcriptionQueue.addSegment({
          id: segmentId,
          text: transcript.trim(),
          audioStart: segmentStartTimeRef.current,
          audioEnd: audioTime,
          confidence,
          source: 'webspeech'
        });

        // Återställ för nästa segment
        segmentStartTimeRef.current = audioTime;
        pendingSegmentId = null;

      } else {
        // Interim resultat - visa realtidstext
        if (!pendingSegmentId) {
          pendingSegmentId = `speech-interim-${Date.now()}`;
          
          // Lägg till nytt interim segment
          transcriptionQueue.addSegment({
            id: pendingSegmentId,
            text: transcript + ' ...',
            audioStart: segmentStartTimeRef.current,
            confidence: confidence * 0.7,
            source: 'webspeech'
          });
        } else {
          // Uppdatera befintligt interim segment
          transcriptionQueue.updateSegment(pendingSegmentId, {
            text: transcript + ' ...',
            confidence: confidence * 0.7
          });
        }
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('Speech recognition error:', event.error);
      if (event.error === 'no-speech') {
        // Starta om recognition
        setTimeout(() => {
          if (recognitionRef.current && audioRecorder.isRecording) {
            try {
              recognitionRef.current.start();
            } catch (e) {
              console.log('Could not restart recognition:', e);
            }
          }
        }, 1000);
        return;
      }
      
      const errorMessages: Record<string, string> = {
        'network': 'Nätverksfel - kontrollera internetanslutning',
        'not-allowed': 'Mikrofon inte tillåten - kontrollera behörigheter',
        'service-not-allowed': 'Taligenkänning blockerad av säkerhetsinställningar',
        'bad-grammar': 'Grammatikfel i taligenkänning',
        'language-not-supported': 'Svenska stöds inte',
        'no-speech': 'Inget tal upptäckt',
        'audio-capture': 'Mikrofonfel - kontrollera enheten'
      };
      
      const message = errorMessages[event.error] || `Taligenkänning: ${event.error}`;
      setError(message);
    };

    return recognition;
  }, [speechSupported, transcriptionQueue, audioRecorder.isRecording]);

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      transcriptionQueue.clear();
      
      recordingStartTimeRef.current = Date.now();
      segmentStartTimeRef.current = 0;

      // Starta ljudinspelning
      await audioRecorder.startRecording();

      // Sätt upp Speech Recognition
      if (speechSupported) {
        recognitionRef.current = setupSpeechRecognition();
        if (recognitionRef.current) {
          recognitionRef.current.start();
        }
      }

    } catch (err) {
      setError('Kunde inte komma åt mikrofonen. Kontrollera behörigheter.');
      console.error('Recording error:', err);
    }
  }, [setupSpeechRecognition, speechSupported, audioRecorder, transcriptionQueue]);

  const stopRecording = useCallback(async () => {
    // Stoppa Speech Recognition
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }

    // Stoppa ljudinspelning
    await audioRecorder.stopRecording();

    // Om fullständig mötesbearbetning är aktiverad, bearbeta hela mötet
    if (options?.enableFullMeetingProcessing && fullMeetingAudioRef.current.length > 0) {
      console.log('Processing full meeting audio...');
      
      // Kombinera alla audio chunks till en blob
      const fullMeetingBlob = new Blob(fullMeetingAudioRef.current, { type: 'audio/webm' });
      
      // Skicka för fullständig bearbetning
      transcriptionQueue.processFullMeeting(fullMeetingBlob, `meeting-${Date.now()}`);
      
      // Rensa audio chunks
      fullMeetingAudioRef.current = [];
    }
  }, [audioRecorder, options?.enableFullMeetingProcessing, transcriptionQueue]);

  // Konvertera TranscriptionQueue segments till vårt format
  const segments: TranscriptionSegment[] = transcriptionQueue.state.segments.map(segment => ({
    id: segment.id,
    text: segment.text,
    timestamp: segment.timestamp,
    isLocal: segment.source === 'webspeech',
    audioStart: segment.audioStart,
    audioEnd: segment.audioEnd,
    confidence: segment.confidence
  }));

  // Callback för Berget transcription
  useEffect(() => {
    if (onBergetTranscription) {
      const bergetSegments = segments.filter(s => !s.isLocal);
      if (bergetSegments.length > 0) {
        const latestBergetText = bergetSegments[bergetSegments.length - 1].text;
        onBergetTranscription(latestBergetText);
      }
    }
  }, [segments, onBergetTranscription]);

  return {
    isRecording: audioRecorder.isRecording,
    audioLevel: audioRecorder.audioLevel,
    segments,
    startRecording,
    stopRecording,
    error: error || audioRecorder.error || (!speechSupported ? 'Taligenkänning stöds inte i denna webbläsare' : null)
  };
};
