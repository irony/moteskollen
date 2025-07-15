import { useState, useRef, useCallback } from 'react';

interface UseAudioRecorderResult {
  isRecording: boolean;
  audioLevel: number;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
  pauseRecording: () => void;
  resumeRecording: () => void;
  isPaused: boolean;
  error: string | null;
}

export const useAudioRecorder = (
  onAudioChunk?: (chunk: Blob) => void,
  chunkInterval: number = 8000 // 8 sekunder
): UseAudioRecorderResult => {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const chunkTimerRef = useRef<NodeJS.Timeout | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      setIsPaused(false);
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000
        } 
      });

      streamRef.current = stream;

      // Sätt upp ljudanalys för volymvisualisering
      audioContextRef.current = new AudioContext();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      source.connect(analyserRef.current);

      // Starta MediaRecorder
      mediaRecorderRef.current = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      chunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0 && !isPaused) {
          chunksRef.current.push(event.data);
        }
      };

      // Hantera när chunk är klar (för auto-skickning)
      mediaRecorderRef.current.onstop = () => {
        if (chunksRef.current.length > 0 && onAudioChunk && !isPaused) {
          const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
          onAudioChunk(blob);
          chunksRef.current = []; // Återställ för nästa chunk
          
          // Starta om inspelning om den fortfarande ska pågå
          if (isRecording && mediaRecorderRef.current && streamRef.current) {
            mediaRecorderRef.current.start();
            startChunkTimer();
          }
        }
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);

      // Starta volymmonitoring
      monitorAudioLevel();
      
      // Starta timer för chunks
      startChunkTimer();

    } catch (err) {
      setError('Kunde inte komma åt mikrofonen. Kontrollera behörigheter.');
      console.error('Recording error:', err);
    }
  }, [isRecording, isPaused, onAudioChunk, chunkInterval]);

  const stopRecording = useCallback(async (): Promise<void> => {
    setIsRecording(false);
    setIsPaused(false);

    // Stoppa chunk timer
    if (chunkTimerRef.current) {
      clearTimeout(chunkTimerRef.current);
      chunkTimerRef.current = null;
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

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      
      // Stoppa chunk timer
      if (chunkTimerRef.current) {
        clearTimeout(chunkTimerRef.current);
        chunkTimerRef.current = null;
      }
    }
  }, []);

  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      
      // Återstarta chunk timer
      startChunkTimer();
    }
  }, []);

  const startChunkTimer = useCallback(() => {
    if (chunkTimerRef.current) {
      clearTimeout(chunkTimerRef.current);
    }
    
    chunkTimerRef.current = setTimeout(() => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording' && !isPaused) {
        mediaRecorderRef.current.stop();
      }
    }, chunkInterval);
  }, [chunkInterval, isPaused]);

  const monitorAudioLevel = useCallback(() => {
    if (!analyserRef.current) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    
    const updateLevel = () => {
      if (!analyserRef.current || !isRecording || isPaused) return;

      analyserRef.current.getByteFrequencyData(dataArray);
      
      // Beräkna genomsnittlig volym
      const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
      const normalizedLevel = Math.min(average / 128, 1);
      
      setAudioLevel(normalizedLevel);

      animationFrameRef.current = requestAnimationFrame(updateLevel);
    };

    updateLevel();
  }, [isRecording, isPaused]);

  return {
    isRecording,
    isPaused,
    audioLevel,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    error
  };
};