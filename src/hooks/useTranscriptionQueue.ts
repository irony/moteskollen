import { useEffect, useRef, useState } from 'react';
import { TranscriptionQueue, TranscriptionState, AudioSegment } from '../services/transcriptionQueue';
import { bergetApi } from '../services/bergetApi';

export const useTranscriptionQueue = () => {
  const queueRef = useRef<TranscriptionQueue | null>(null);
  const [state, setState] = useState<TranscriptionState>({
    segments: [],
    fullTranscription: '',
    lastTwoLines: [],
    isProcessing: false
  });

  useEffect(() => {
    // Skapa kö med Berget API
    queueRef.current = new TranscriptionQueue(bergetApi);

    // Prenumerera på tillståndsändringar
    const subscription = queueRef.current.getState$().subscribe(newState => {
      setState(newState);
    });

    return () => {
      subscription.unsubscribe();
      queueRef.current?.destroy();
    };
  }, []);

  const addSegment = (segment: Omit<AudioSegment, 'timestamp'>) => {
    queueRef.current?.addSegment(segment);
  };

  const updateSegment = (segmentId: string, updates: Partial<AudioSegment>) => {
    queueRef.current?.updateSegment(segmentId, updates);
  };

  const retrySegment = (segmentId: string) => {
    queueRef.current?.retrySegment(segmentId);
  };

  const clear = () => {
    queueRef.current?.clear();
  };

  return {
    state,
    addSegment,
    updateSegment,
    retrySegment,
    clear
  };
};
