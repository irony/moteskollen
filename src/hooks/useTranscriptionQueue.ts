import { useEffect, useRef, useState } from 'react';
import { TranscriptionQueue, TranscriptionState, AudioSegment } from '../services/transcriptionQueue';
import { bergetApi } from '../services/bergetApi';

export const useTranscriptionQueue = (options?: {
  maxWordsPerSegment?: number;
  retryDelayMs?: number;
}) => {
  const queueRef = useRef<TranscriptionQueue | null>(null);
  const [state, setState] = useState<TranscriptionState>({
    segments: [],
    fullTranscription: '',
    lastTwoLines: [],
    isProcessing: false,
    pendingSegments: 0,
    totalWordCount: 0,
    averageConfidence: 0
  });

  useEffect(() => {
    // Skapa kö med Berget API och options
    queueRef.current = new TranscriptionQueue(bergetApi, options);

    // Prenumerera på tillståndsändringar
    const subscription = queueRef.current.getState$().subscribe(newState => {
      setState(newState);
    });

    return () => {
      subscription.unsubscribe();
      queueRef.current?.destroy();
    };
  }, [options]);

  const addSegment = (segment: Omit<AudioSegment, 'timestamp'>) => {
    queueRef.current?.addSegment(segment);
  };

  const updateSegment = (segmentId: string, updates: Partial<AudioSegment>) => {
    queueRef.current?.updateSegment(segmentId, updates);
  };

  const retrySegment = (segmentId: string) => {
    queueRef.current?.retrySegment(segmentId);
  };

  const processFullMeeting = (audioData: Blob, meetingId?: string) => {
    queueRef.current?.processFullMeetingTranscription(audioData, meetingId);
  };

  const getStatistics = () => {
    return queueRef.current?.getStatistics() || {
      totalSegments: 0,
      pendingSegments: 0,
      totalWords: 0,
      averageConfidence: 0,
      processingRate: 0
    };
  };

  const clear = () => {
    queueRef.current?.clear();
  };

  return {
    state,
    addSegment,
    updateSegment,
    retrySegment,
    processFullMeeting,
    getStatistics,
    clear
  };
};
