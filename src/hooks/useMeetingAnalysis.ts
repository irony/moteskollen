import { useState, useEffect, useCallback } from 'react';
import { bergetApi } from '@/services/bergetApi';

interface MeetingAnalysis {
  purpose: string;
  suggestedTitle: string;
  participants: string[];
  estimatedParticipants: number;
  suggestedTemplate: string;
  actionPoints: string[];
  confidence: number;
}

interface UseMeetingAnalysisResult {
  analysis: MeetingAnalysis | null;
  isAnalyzing: boolean;
  error: string | null;
  analyzeTranscription: (text: string) => Promise<void>;
}

export const useMeetingAnalysis = (): UseMeetingAnalysisResult => {
  const [analysis, setAnalysis] = useState<MeetingAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analyzeTranscription = useCallback(async (text: string) => {
    if (!text || text.length < 50) return; // Behöver tillräckligt med text för analys
    
    setIsAnalyzing(true);
    setError(null);
    
    try {
      const result = await bergetApi.analyzeMeeting(text);
      setAnalysis(result);
    } catch (err) {
      console.error('Meeting analysis error:', err);
      setError(err instanceof Error ? err.message : 'Analys misslyckades');
    } finally {
      setIsAnalyzing(false);
    }
  }, []);

  return {
    analysis,
    isAnalyzing,
    error,
    analyzeTranscription
  };
};