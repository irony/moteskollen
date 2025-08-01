import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useHybridTranscription } from '../hooks/useHybridTranscription';

// Mock bergetApi
const mockTranscribeAudio = vi.fn().mockResolvedValue({ text: 'Berget AI transkribering' });
vi.mock('../services/bergetApi', () => ({
  bergetApi: mockTranscribeAudio
}));

// Mock security service
vi.mock('../lib/security', () => ({
  securityService: {
    getSecureToken: vi.fn().mockReturnValue(null),
    setSecureToken: vi.fn(),
    removeSecureToken: vi.fn()
  }
}));

// Mock useTranscriptionQueue
const mockAddSegment = vi.fn();
const mockUpdateSegment = vi.fn();
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
    updateSegment: mockUpdateSegment,
    clear: mockClear,
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

  it('ska integrera med TranscriptionQueue för realtidstext', async () => {
    const { result } = renderHook(() => useHybridTranscription());

    // Simulera Speech Recognition resultat
    const mockRecognition = {
      continuous: true,
      interimResults: true,
      lang: 'sv-SE',
      maxAlternatives: 1,
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

    // Kontrollera att TranscriptionQueue rensas vid start
    expect(mockClear).toHaveBeenCalled();

    // Simulera interim resultat (realtidstext)
    const interimEvent = {
      results: [
        {
          0: { transcript: 'Hej detta är', confidence: 0.8 },
          isFinal: false,
          length: 1
        }
      ],
      resultIndex: 0
    };
    
    // Lägg till results som en array-liknande struktur
    (interimEvent as any).results.length = 1;

    act(() => {
      if (mockRecognition.onresult) {
        mockRecognition.onresult(interimEvent);
      }
    });

    // Kontrollera att interim text läggs till med "..."
    expect(mockAddSegment).toHaveBeenCalledWith(
      expect.objectContaining({
        text: 'Hej detta är ...',
        source: 'webspeech',
        confidence: expect.any(Number)
      })
    );
  });

  it('ska skicka audioData till TranscriptionQueue för Berget AI-bearbetning', async () => {
    const { result } = renderHook(() => useHybridTranscription());

    await act(async () => {
      await result.current.startRecording();
    });

    // Simulera att vi får en audio chunk från useAudioRecorder
    const audioChunk = new Blob(['test audio data'], { type: 'audio/webm' });
    
    act(() => {
      if (mockAudioChunkCallback) {
        mockAudioChunkCallback(audioChunk);
      }
    });

    // Kontrollera att segment med audioData läggs till för Berget AI-bearbetning
    expect(mockAddSegment).toHaveBeenCalledWith(
      expect.objectContaining({
        text: 'Bearbetar ljud...',
        audioData: audioChunk,
        source: 'webspeech',
        audioStart: expect.any(Number),
        audioEnd: expect.any(Number)
      })
    );
  });

  it('ska konvertera TranscriptionQueue-segment till rätt format', () => {
    // Simulera att TranscriptionQueue har segment
    mockState.segments = [
      {
        id: 'ws-1',
        text: 'Webspeech text...',
        timestamp: new Date(),
        audioStart: 0,
        audioEnd: 2,
        confidence: 0.7,
        source: 'webspeech' as const
      },
      {
        id: 'bg-1', 
        text: 'Förbättrad Berget text',
        timestamp: new Date(),
        audioStart: 0,
        audioEnd: 2,
        confidence: 0.95,
        source: 'berget' as const
      }
    ];

    const { result } = renderHook(() => useHybridTranscription());

    // Kontrollera att segment konverteras korrekt
    expect(result.current.segments).toHaveLength(2);
    expect(result.current.segments[0]).toEqual(
      expect.objectContaining({
        id: 'ws-1',
        text: 'Webspeech text...',
        isLocal: true, // webspeech = local
        audioStart: 0,
        audioEnd: 2,
        confidence: 0.7
      })
    );
    expect(result.current.segments[1]).toEqual(
      expect.objectContaining({
        id: 'bg-1',
        text: 'Förbättrad Berget text',
        isLocal: false, // berget = not local
        confidence: 0.95
      })
    );
  });

  it('ska hantera final Speech Recognition-resultat korrekt', async () => {
    const { result } = renderHook(() => useHybridTranscription());

    const mockRecognition = {
      continuous: true,
      interimResults: true,
      lang: 'sv-SE',
      maxAlternatives: 1,
      start: vi.fn(),
      stop: vi.fn(),
      onresult: null as any,
      onerror: null as any
    };

    (global as any).webkitSpeechRecognition = vi.fn(() => mockRecognition);

    await act(async () => {
      await result.current.startRecording();
    });

    // Simulera final resultat
    const finalEvent = {
      results: [
        {
          0: { transcript: 'Hej detta är en komplett mening', confidence: 0.9 },
          isFinal: true,
          length: 1
        }
      ],
      resultIndex: 0
    };
    
    // Lägg till results som en array-liknande struktur
    (finalEvent as any).results.length = 1;

    act(() => {
      if (mockRecognition.onresult) {
        mockRecognition.onresult(finalEvent);
      }
    });

    // Kontrollera att final text läggs till utan "..."
    expect(mockAddSegment).toHaveBeenCalledWith(
      expect.objectContaining({
        text: 'Hej detta är en komplett mening',
        source: 'webspeech',
        confidence: 0.9,
        audioStart: expect.any(Number),
        audioEnd: expect.any(Number)
      })
    );
  });
});
