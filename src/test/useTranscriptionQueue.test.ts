import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTranscriptionQueue } from '../hooks/useTranscriptionQueue';

// Mock bergetApi
vi.mock('../services/bergetApi', () => ({
  bergetApi: {
    transcribeAudio: vi.fn().mockResolvedValue({ text: 'Mock transcription' })
  }
}));

// Mock security service
vi.mock('../lib/security', () => ({
  securityService: {
    getSecureToken: vi.fn().mockReturnValue(null),
    setSecureToken: vi.fn(),
    removeSecureToken: vi.fn()
  }
}));

describe('useTranscriptionQueue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ska initialisera med tomt tillstånd', () => {
    const { result } = renderHook(() => useTranscriptionQueue());
    
    expect(result.current.state.segments).toHaveLength(0);
    expect(result.current.state.fullTranscription).toBe('');
    expect(result.current.state.isProcessing).toBe(false);
  });

  it('ska kunna lägga till segment', async () => {
    const { result } = renderHook(() => useTranscriptionQueue());
    
    act(() => {
      result.current.addSegment({
        id: 'test-1',
        text: 'Test segment',
        audioStart: 0,
        confidence: 0.8,
        source: 'webspeech'
      });
    });

    // Vänta på att tillståndet uppdateras
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 50));
    });

    expect(result.current.state.segments).toHaveLength(1);
    expect(result.current.state.segments[0].text).toBe('Test segment');
  });

  it('ska kunna rensa tillståndet', async () => {
    const { result } = renderHook(() => useTranscriptionQueue());
    
    // Lägg till segment först
    act(() => {
      result.current.addSegment({
        id: 'test-1',
        text: 'Test segment',
        audioStart: 0,
        confidence: 0.8,
        source: 'webspeech'
      });
    });

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 50));
    });

    // Rensa
    act(() => {
      result.current.clear();
    });

    expect(result.current.state.segments).toHaveLength(0);
    expect(result.current.state.fullTranscription).toBe('');
  });
});
