import { describe, it, expect, vi, beforeEach } from 'vitest';
import { bergetApi } from '../services/bergetApi';

// Mock fetch globalt
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('BergetApi', () => {
  beforeEach(() => {
    mockFetch.mockClear();
    bergetApi.clearApiKey();
  });

  describe('API Key Management', () => {
    it('ska kunna sätta och hämta API-nyckel', () => {
      const testKey = 'test-api-key-123';
      bergetApi.setApiKey(testKey);
      
      expect(bergetApi.getApiKey()).toBe(testKey);
    });

    it('ska kunna rensa API-nyckel', () => {
      bergetApi.setApiKey('test-key');
      bergetApi.clearApiKey();
      
      expect(bergetApi.getApiKey()).toBeNull();
    });
  });

  describe('Audio Transcription', () => {
    it('ska skicka korrekt request för ljudtranskribering', async () => {
      const mockResponse = { text: 'Transkriberad text' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      bergetApi.setApiKey('test-key');
      const audioBlob = new Blob(['test audio'], { type: 'audio/webm' });
      
      const result = await bergetApi.transcribeAudio(audioBlob);
      
      expect(result.text).toBe('Transkriberad text');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.berget.ai/v1/audio/transcriptions',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-key'
          })
        })
      );
    });

    it('ska hantera API-fel korrekt', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: () => Promise.resolve('Unauthorized')
      });

      bergetApi.setApiKey('invalid-key');
      const audioBlob = new Blob(['test audio'], { type: 'audio/webm' });
      
      await expect(bergetApi.transcribeAudio(audioBlob))
        .rejects.toThrow('Transkribering misslyckades');
    });
  });

  describe('Text Generation', () => {
    it('ska kunna generera text med AI', async () => {
      const mockResponse = {
        choices: [{ message: { content: 'Genererad text' } }]
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      bergetApi.setApiKey('test-key');
      
      const result = await bergetApi.generateText('Test prompt');
      
      expect(result).toBe('Genererad text');
    });
  });

  describe('Protocol Summarization', () => {
    it('ska kunna summera text till protokoll', async () => {
      const mockResponse = {
        choices: [{ message: { content: '# Protokoll\n\nSammanfattning av mötet' } }]
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      bergetApi.setApiKey('test-key');
      
      const result = await bergetApi.summarizeToProtocol('Mötestext');
      
      expect(result.summary).toContain('Protokoll');
      expect(result.action_items).toBeDefined();
    });
  });
});
