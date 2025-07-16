import { useState, useRef, useCallback, useEffect } from 'react';

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
  audioStart: number; // för att matcha med ljudsegment
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
  onBergetTranscription?: (text: string) => void
): UseHybridTranscriptionResult => {
  const [isRecording, setIsRecording] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [segments, setSegments] = useState<TranscriptionSegment[]>([]);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recognitionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const segmentStartTimeRef = useRef<number>(0);
  const recordingStartTimeRef = useRef<number>(0);
  const sentSegmentsRef = useRef<Set<string>>(new Set());
  const segmentAudioRef = useRef<Map<string, Blob[]>>(new Map());
  const currentSegmentChunksRef = useRef<Blob[]>([]);
  const cleanupTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastCleanupRef = useRef<string>('');
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);

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
    let currentInterimText = '';
    let hasBeenSentToBerget = false; // Track if current segment has been sent

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const lastResult = event.results[event.results.length - 1];
      const transcript = lastResult[0].transcript;
      const confidence = lastResult[0].confidence;
      const isFinal = lastResult.isFinal;

      const now = new Date();
      const audioTime = (now.getTime() - recordingStartTimeRef.current) / 1000;

      // Rensa tidigare silence timer vid varje resultat
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }

      if (isFinal) {
        // Final resultat - skapa eller uppdatera segment
        const segmentId = pendingSegmentId || Date.now().toString();
        
        // Spara audio-chunks för detta segment
        if (currentSegmentChunksRef.current.length > 0) {
          segmentAudioRef.current.set(segmentId, [...currentSegmentChunksRef.current]);
        }
        
        setSegments(prev => {
          const existingIndex = prev.findIndex(s => s.id === segmentId);
          const newSegment: TranscriptionSegment = {
            id: segmentId,
            text: transcript.trim(),
            timestamp: now,
            isLocal: true,
            audioStart: segmentStartTimeRef.current,
            audioEnd: audioTime,
            confidence
          };

          if (existingIndex >= 0) {
            const updated = [...prev];
            updated[existingIndex] = newSegment;
            return updated;
          } else {
            return [...prev, newSegment];
          }
        });

        // Skicka ljudsegment till Berget AI för förbättring (bara om vi inte redan skickat det)
        if (transcript.trim().length > 10 && !hasBeenSentToBerget) {
          console.log('Skickar final segment till Berget:', segmentId);
          sentSegmentsRef.current.add(segmentId);
          sendAudioSegmentToBerget(segmentId, segmentStartTimeRef.current, audioTime);
        }

        // Återställ för nästa segment
        segmentStartTimeRef.current = audioTime;
        pendingSegmentId = null;
        currentInterimText = '';
        hasBeenSentToBerget = false;
        currentSegmentChunksRef.current = [];

      } else {
        // Interim resultat - bygg ihop texten progressivt
        if (!pendingSegmentId) {
          pendingSegmentId = Date.now().toString();
        }

        // Bygg ihop interim text progressivt
        currentInterimText = transcript;

        setSegments(prev => {
          const existingIndex = prev.findIndex(s => s.id === pendingSegmentId);
          const tempSegment: TranscriptionSegment = {
            id: pendingSegmentId!,
            text: currentInterimText + ' ...',
            timestamp: now,
            isLocal: true,
            audioStart: segmentStartTimeRef.current,
            confidence: confidence * 0.7 // Lägre confidence för interim
          };

          if (existingIndex >= 0) {
            const updated = [...prev];
            updated[existingIndex] = tempSegment;
            return updated;
          } else {
            return [...prev, tempSegment];
          }
        });

        // Sätt timer för att skicka till Berget efter 300ms tystnad
        silenceTimerRef.current = setTimeout(() => {
          if (pendingSegmentId && currentInterimText.trim().length > 10 && !hasBeenSentToBerget) {
            console.log('Skickar interim segment till Berget efter tystnad:', pendingSegmentId);
            
            // Spara audio-chunks för detta segment
            if (currentSegmentChunksRef.current.length > 0) {
              segmentAudioRef.current.set(pendingSegmentId, [...currentSegmentChunksRef.current]);
            }

            hasBeenSentToBerget = true; // Mark as sent to prevent duplicate sends
            sendAudioSegmentToBerget(pendingSegmentId, segmentStartTimeRef.current, audioTime);
          }
        }, 300);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('Speech recognition error:', event.error);
      if (event.error === 'no-speech') {
        // Vanligt, behöver inte visa fel
        return;
      }
      
      // Förbättrade felmeddelanden
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
      
      // Vid nätverksfel, fortsätt med endast Berget AI
      if (event.error === 'network') {
        console.log('Växlar till endast Berget AI på grund av nätverksfel');
      }
    };

    return recognition;
  }, [speechSupported]);

  const sendAudioSegmentToBerget = async (segmentId: string, startTime: number, endTime: number) => {
    try {
      // Hämta audio-chunks för just detta segment
      const segmentChunks = segmentAudioRef.current.get(segmentId);
      if (!segmentChunks || segmentChunks.length === 0) {
        console.log('Inga audio-chunks för segment:', segmentId);
        return;
      }

      const segmentDuration = endTime - startTime;
      if (segmentDuration < 1) return;

      // Skapa blob från detta segments chunks
      const audioBlob = new Blob(segmentChunks, { type: 'audio/webm' });
      console.log(`Skickar segment ${segmentId} till Berget AI (${audioBlob.size} bytes)`);
      
      // Importera bergetApi dynamiskt för att undvika cirkulär import
      const { bergetApi } = await import('@/services/bergetApi');
      const result = await bergetApi.transcribeAudio(audioBlob);

      // Rensa bort konstiga tecken och tystnadsindikatorer från Berget AI
      const cleanText = cleanBergetText(result.text);
      
      // Hoppa över tomma eller meningslösa segment
      if (!cleanText || cleanText.length < 2) {
        console.log('Hoppade över tomt Berget-segment');
        return;
      }

      // Uppdatera segmentet med Berget AI:s resultat
      setSegments(prev => prev.map(segment => 
        segment.id === segmentId
          ? {
              ...segment,
              text: cleanText,
              isLocal: false,
              confidence: 0.95 // Hög confidence för Berget AI
            }
          : segment
      ));

      // Callback för fullständig transkribering
      if (onBergetTranscription) {
        onBergetTranscription(cleanText);
      }

    } catch (err) {
      console.error('Berget transcription error:', err);
      // Behåll lokala resultatet vid fel
    }
  };

  // Funktion för att rensa bort konstiga tecken från Berget AI
  const cleanBergetText = (text: string): string => {
    if (!text) return '';
    
    // Ta bort konstiga HTML-liknande tecken och repetitiva mönster
    let cleaned = text
      // Ta bort &lt i&gt mönster
      .replace(/&lt\s*i&gt/gi, '')
      // Ta bort andra HTML entities
      .replace(/&[a-zA-Z0-9#]+;/g, '')
      // Ta bort repetitiva tecken (mer än 3 i rad)
      .replace(/(.)\1{3,}/g, '$1')
      // Ta bort extra whitespace
      .replace(/\s+/g, ' ')
      .trim();
    
    // Om texten bara består av repetitiva tecken eller är för kort, ignorera
    if (cleaned.length < 3 || /^(.)\1*$/.test(cleaned)) {
      return '';
    }
    
    return cleaned;
  };

  const startRecording = useCallback(async () => {
    console.log('useHybridTranscription: startRecording called');
    try {
      setError(null);
      setSegments([]);
      
      console.log('Requesting microphone access...');
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000
        } 
      });
      console.log('Microphone access granted');

      streamRef.current = stream;
      recordingStartTimeRef.current = Date.now();
      segmentStartTimeRef.current = 0;

      // Sätt upp ljudanalys
      audioContextRef.current = new AudioContext();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      source.connect(analyserRef.current);

      // Sätt upp MediaRecorder för ljuddata
      mediaRecorderRef.current = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      audioChunksRef.current = [];
      currentSegmentChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
          // Lägg till chunks till aktuellt segment också
          currentSegmentChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.start(1000); // Samla data varje sekund

      // Sätt upp Speech Recognition
      if (speechSupported) {
        recognitionRef.current = setupSpeechRecognition();
        if (recognitionRef.current) {
          recognitionRef.current.start();
        }
      }

      setIsRecording(true);
      monitorAudioLevel();
      
      // Starta kontinuerlig protokollstädning var 30:e sekund
      startProtocolCleanup();

    } catch (err) {
      setError('Kunde inte komma åt mikrofonen. Kontrollera behörigheter.');
      console.error('Recording error:', err);
    }
  }, [setupSpeechRecognition, speechSupported, onBergetTranscription]);

  const stopRecording = useCallback(async () => {
    setIsRecording(false);
    
    // Stoppa protokollstädning
    if (cleanupTimerRef.current) {
      clearInterval(cleanupTimerRef.current);
      cleanupTimerRef.current = null;
    }

    // Stoppa silence timer
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    // Stoppa Speech Recognition
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }

    // Stoppa MediaRecorder
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    
    // Stoppa alla spår
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    // Rensa resurser
    sentSegmentsRef.current.clear();
    segmentAudioRef.current.clear();
    audioChunksRef.current = [];
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    setAudioLevel(0);
  }, []);

  const monitorAudioLevel = useCallback(() => {
    if (!analyserRef.current) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    
    const updateLevel = () => {
      if (!analyserRef.current || !isRecording) return;

      analyserRef.current.getByteFrequencyData(dataArray);
      
      const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
      const normalizedLevel = Math.min(average / 128, 1);
      
      setAudioLevel(normalizedLevel);

      animationFrameRef.current = requestAnimationFrame(updateLevel);
    };

    updateLevel();
  }, [isRecording]);

  // Kontinuerlig protokollstädning
  const startProtocolCleanup = useCallback(() => {
    cleanupTimerRef.current = setInterval(async () => {
      const currentProtocol = segments
        .filter(s => !s.isLocal) // Bara Berget AI-segment (de som är finpolerade)
        .map(s => s.text)
        .join(' ');

      // Bara städa om det finns tillräckligt med text och den har ändrats
      if (currentProtocol.length > 50 && currentProtocol !== lastCleanupRef.current) {
        try {
          const { bergetApi } = await import('@/services/bergetApi');
          const cleanedProtocol = await bergetApi.cleanupProtocol(currentProtocol);
          
          if (cleanedProtocol && cleanedProtocol !== currentProtocol) {
            console.log('Protokoll städat av Berget AI');
            
            // Uppdatera alla Berget AI-segment med den städade texten
            // Dela upp den städade texten proportionellt baserat på ursprungslängder
            const originalSegments = segments.filter(s => !s.isLocal);
            if (originalSegments.length > 0) {
              const wordsPerSegment = cleanedProtocol.split(' ').length / originalSegments.length;
              const cleanedWords = cleanedProtocol.split(' ');
              
              setSegments(prev => prev.map((segment, index) => {
                if (!segment.isLocal) {
                  const segmentIndex = prev.filter((s, i) => i < index && !s.isLocal).length;
                  const startWord = Math.floor(segmentIndex * wordsPerSegment);
                  const endWord = Math.floor((segmentIndex + 1) * wordsPerSegment);
                  const segmentText = cleanedWords.slice(startWord, endWord).join(' ');
                  
                  return {
                    ...segment,
                    text: segmentText || segment.text
                  };
                }
                return segment;
              }));
            }
            
            lastCleanupRef.current = cleanedProtocol;
          }
        } catch (error) {
          console.error('Protokollstädning misslyckades:', error);
        }
      }
    }, 30000); // Var 30:e sekund
  }, [segments]);

  // Rensa vid unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (cleanupTimerRef.current) {
        clearInterval(cleanupTimerRef.current);
      }
    };
  }, []);

  return {
    isRecording,
    audioLevel,
    segments,
    startRecording,
    stopRecording,
    error: error || (!speechSupported ? 'Taligenkänning stöds inte i denna webbläsare' : null)
  };
};