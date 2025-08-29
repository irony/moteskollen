import { useState, useEffect } from 'react';
import { useTranscriptionQueue } from './useTranscriptionQueue';

interface TranscriptionStatistics {
  totalSegments: number;
  pendingSegments: number;
  totalWords: number;
  averageConfidence: number;
  processingRate: number;
  wordsPerMinute: number;
  qualityScore: 'excellent' | 'good' | 'fair' | 'poor';
}

export const useTranscriptionStatistics = () => {
  const transcriptionQueue = useTranscriptionQueue();
  const [statistics, setStatistics] = useState<TranscriptionStatistics>({
    totalSegments: 0,
    pendingSegments: 0,
    totalWords: 0,
    averageConfidence: 0,
    processingRate: 0,
    wordsPerMinute: 0,
    qualityScore: 'fair'
  });
  const [startTime] = useState(Date.now());

  useEffect(() => {
    const updateStatistics = () => {
      const queueStats = transcriptionQueue.getStatistics();
      const elapsedMinutes = (Date.now() - startTime) / (1000 * 60);
      const wordsPerMinute = elapsedMinutes > 0 ? queueStats.totalWords / elapsedMinutes : 0;
      
      let qualityScore: 'excellent' | 'good' | 'fair' | 'poor' = 'fair';
      if (queueStats.averageConfidence >= 0.9) qualityScore = 'excellent';
      else if (queueStats.averageConfidence >= 0.8) qualityScore = 'good';
      else if (queueStats.averageConfidence >= 0.6) qualityScore = 'fair';
      else qualityScore = 'poor';

      setStatistics({
        ...queueStats,
        wordsPerMinute,
        qualityScore
      });
    };

    // Uppdatera statistik varje sekund
    const interval = setInterval(updateStatistics, 1000);
    updateStatistics(); // Initial uppdatering

    return () => clearInterval(interval);
  }, [transcriptionQueue, startTime]);

  return statistics;
};
