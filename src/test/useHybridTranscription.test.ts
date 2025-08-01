import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useHybridTranscription } from '../hooks/useHybridTranscription';

// Mock bergetApi
vi.mock('../services/bergetApi', () => ({
  bergetApi: {
    transcribeAudio: vi.fn().mockResolvedValue({ text: 'Berget AI transkribering' })
  }
}));

// Mock useTranscriptionQueue
const mockAddSegment = vi.fn();
const mockClear = vi.fn();
const mockState = {
  segments: [],
  fullTranscription: '',
  lastTwoLines: [],
  isProcessing: false
};

vi.mock('../hooks/useTranscriptionQueue', () => ({
  useTranscriptionQueue: () => ({
    state: mockState,
    addSegment: mockAddSegment,
    clear: mockClear,
    updateSegment: vi.fn(),
    retrySegment: vi.fn()
  })
}));

// Mock useAudioRecorder
const mockStartRecording = vi.fn();
const mockStopRecording = vi.fn();
let mockAudioChunkCallback: ((chunk: Blob) => void) | undefined;

vi.mock('../hooks/useAudioRecorder', () => ({
  useAudioRecorder: (callback: (chunk: Blob) => void) => {
    mockAudioChunkCallback = callback;
    return {
      isRecording: false,
      audioLevel: 0.5,
      startRecording: mockStartRecording,
      stopRecording: mockStopRecording,
      error: null
    };
  }
}));

describe('useHybridTranscription', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockState.segments = [];
  });

  it('ska visa realtidstext från Speech Recognition', async () => {
    const { result } = renderHook(() => useHybridTranscription());

    // Simulera Speech Recognition resultat
    const mockRecognition = {
      start: vi.fn(),
      stop: vi.fn(),
      onresult: null as any,
      onerror: null as any
    };

    // Mock webkitSpeechRecognition
    (global as any).webkitSpeechRecognition = vi.fn(() => mockRecognition);

    await act(async () => {
      await result.current.startRecording();
    });

    // Simulera interim resultat (realtidstext)
    const interimEvent = {
      results: [{
        0: { transcript: 'Hej detta är', confidence: 0.8 },
        isFinal: false,
        length: 1
      }],
      resultIndex: 0,
      results: { length: 1 }
    };

    act(() => {
      if (mockRecognition.onresult) {
        mockRecognition.onresult(interimEvent);
      }
    });

    // Kontrollera att interim text visas med "..."
    expect(mockAddSegment).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining('...'),
        source: 'webspeech'
      })
    );
  });

  it('ska skicka audioData till Berget AI när audio chunks tas emot', async () => {
    const { result } = renderHook(() => useHybridTranscription());

    await act(async () => {
      await result.current.startRecording();
    });

    // Simulera att vi får en audio chunk
    const audioChunk = new Blob(['test audio'], { type: 'audio/webm' });
    
    act(() => {
      if (mockAudioChunkCallback) {
        mockAudioChunkCallback(audioChunk);
      }
    });

    // Kontrollera att segment med audioData läggs till
    expect(mockAddSegment).toHaveBeenCalledWith(
      expect.objectContaining({
        audioData: audioChunk,
        source: 'webspeech'
      })
    );
  });

  it('ska visa både webspeech och berget segment i realtid', () => {
    // Simulera att vi har både webspeech och berget segment
    mockState.segments = [
      {
        id: 'ws-1',
        text: 'Webspeech text...',
        timestamp: new Date(),
        audioStart: 0,
        confidence: 0.7,
        source: 'webspeech' as const
      },
      {
        id: 'bg-1', 
        text: 'Förbättrad Berget text',
        timestamp: new Date(),
        audioStart: 0,
        confidence: 0.95,
        source: 'berget' as const
      }
    ];

    const { result } = renderHook(() => useHybridTranscription());

    expect(result.current.segments).toHaveLength(2);
    expect(result.current.segments[0].isLocal).toBe(true); // webspeech
    expect(result.current.segments[1].isLocal).toBe(false); // berget
  });
});
