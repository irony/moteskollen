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
        // Final resultat - skapa eller uppdatera segment
        const segmentId = pendingSegmentId || Date.now().toString();
        
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

        // Skicka ljudsegment till Berget AI för förbättring
        if (transcript.trim().length > 10) { // Endast för meningsfulla segment
          sendAudioSegmentToBerget(segmentId, segmentStartTimeRef.current, audioTime);
        }

        // Uppdatera start för nästa segment
        segmentStartTimeRef.current = audioTime;
        pendingSegmentId = null;

      } else {
        // Interim resultat - uppdatera temporärt segment
        if (!pendingSegmentId) {
          pendingSegmentId = Date.now().toString();
        }

        setSegments(prev => {
          const existingIndex = prev.findIndex(s => s.id === pendingSegmentId);
          const tempSegment: TranscriptionSegment = {
            id: pendingSegmentId!,
            text: transcript + ' ...',
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
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('Speech recognition error:', event.error);
      if (event.error === 'no-speech') {
        // Vanligt, behöver inte visa fel
        return;
      }
      setError(`Taligenkänning: ${event.error}`);
    };

    return recognition;
  }, [speechSupported]);

  const sendAudioSegmentToBerget = async (segmentId: string, startTime: number, endTime: number) => {
    try {
      // Hitta motsvarande ljuddata
      const segmentDuration = endTime - startTime;
      if (segmentDuration < 1 || !audioChunksRef.current.length) return;

      // Skapa blob från aktuella chunks (förenklad - i produktion skulle vi vilja ha exakt segment)
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      
      // Importera bergetApi dynamiskt för att undvika cirkulär import
      const { bergetApi } = await import('@/services/bergetApi');
      const result = await bergetApi.transcribeAudio(audioBlob);

      // Uppdatera segmentet med Berget AI:s resultat
      setSegments(prev => prev.map(segment => 
        segment.id === segmentId
          ? {
              ...segment,
              text: result.text,
              isLocal: false,
              confidence: 0.95 // Hög confidence för Berget AI
            }
          : segment
      ));

      // Callback för fullständig transkribering
      if (onBergetTranscription) {
        onBergetTranscription(result.text);
      }

    } catch (err) {
      console.error('Berget transcription error:', err);
      // Behåll lokala resultatet vid fel
    }
  };

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      setSegments([]);
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000
        } 
      });

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

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
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

    } catch (err) {
      setError('Kunde inte komma åt mikrofonen. Kontrollera behörigheter.');
      console.error('Recording error:', err);
    }
  }, [setupSpeechRecognition, speechSupported, onBergetTranscription]);

  const stopRecording = useCallback(async () => {
    setIsRecording(false);

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

  // Rensa vid unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
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