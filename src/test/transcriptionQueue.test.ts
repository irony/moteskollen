import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TranscriptionQueue, AudioSegment, BergetApiInterface } from '../services/transcriptionQueue';
import { firstValueFrom, take, timeout } from 'rxjs';

// Mock Berget API
class MockBergetApi implements BergetApiInterface {
  private responses: Map<string, { text: string }> = new Map();
  private delays: Map<string, number> = new Map();
  private errors: Map<string, Error> = new Map();

  setResponse(segmentId: string, response: { text: string }, delay = 0): void {
    this.responses.set(segmentId, response);
    this.delays.set(segmentId, delay);
  }

  setError(segmentId: string, error: Error): void {
    this.errors.set(segmentId, error);
  }

  async transcribeAudio(audioBlob: Blob): Promise<{ text: string }> {
    // Simulera att vi kan identifiera segment baserat på blob-storlek eller innehåll
    const segmentId = audioBlob.size.toString();
    
    if (this.errors.has(segmentId)) {
      throw this.errors.get(segmentId)!;
    }

    const delay = this.delays.get(segmentId) || 0;
    if (delay > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    return this.responses.get(segmentId) || { text: 'Mock transcription' };
  }

  clear(): void {
    this.responses.clear();
    this.delays.clear();
    this.errors.clear();
  }
}

describe('TranscriptionQueue', () => {
  let queue: TranscriptionQueue;
  let mockApi: MockBergetApi;

  beforeEach(() => {
    mockApi = new MockBergetApi();
    queue = new TranscriptionQueue(mockApi);
  });

  afterEach(() => {
    queue.destroy();
    mockApi.clear();
  });

  describe('Grundläggande funktionalitet', () => {
    it('ska kunna lägga till ett segment', async () => {
      const segment: Omit<AudioSegment, 'timestamp'> = {
        id: 'test-1',
        text: 'Hej världen',
        audioStart: 0,
        audioEnd: 2,
        confidence: 0.8,
        source: 'webspeech'
      };

      queue.addSegment(segment);

      const state = await firstValueFrom(
        queue.getState$().pipe(take(1), timeout(1000))
      );

      expect(state.segments).toHaveLength(1);
      expect(state.segments[0].text).toBe('Hej världen');
      expect(state.fullTranscription).toBe('Hej världen');
    });

    it('ska kunna uppdatera ett befintligt segment', async () => {
      const segment: Omit<AudioSegment, 'timestamp'> = {
        id: 'test-1',
        text: 'Hej världen',
        audioStart: 0,
        confidence: 0.8,
        source: 'webspeech'
      };

      queue.addSegment(segment);
      queue.updateSegment('test-1', { text: 'Hej vackra världen', confidence: 0.9 });

      const state = await firstValueFrom(
        queue.getState$().pipe(take(2), timeout(1000))
      );

      expect(state.segments[0].text).toBe('Hej vackra världen');
      expect(state.segments[0].confidence).toBe(0.9);
    });

    it('ska sortera segment efter audioStart', async () => {
      const segment1: Omit<AudioSegment, 'timestamp'> = {
        id: 'test-1',
        text: 'Andra meningen',
        audioStart: 5,
        confidence: 0.8,
        source: 'webspeech'
      };

      const segment2: Omit<AudioSegment, 'timestamp'> = {
        id: 'test-2',
        text: 'Första meningen',
        audioStart: 0,
        confidence: 0.8,
        source: 'webspeech'
      };

      queue.addSegment(segment1);
      queue.addSegment(segment2);

      const state = await firstValueFrom(
        queue.getState$().pipe(take(1), timeout(1000))
      );

      expect(state.segments[0].text).toBe('Första meningen');
      expect(state.segments[1].text).toBe('Andra meningen');
      expect(state.fullTranscription).toBe('Första meningen Andra meningen');
    });
  });

  describe('Berget AI-integration', () => {
    it('ska skicka webspeech-segment till Berget AI för förbättring', async () => {
      const audioBlob = new Blob(['test audio'], { type: 'audio/webm' });
      mockApi.setResponse(audioBlob.size.toString(), { text: 'Förbättrad text från Berget' });

      const segment: Omit<AudioSegment, 'timestamp'> = {
        id: 'test-1',
        text: 'Ursprunglig text',
        audioStart: 0,
        confidence: 0.7,
        source: 'webspeech',
        audioData: audioBlob
      };

      queue.addSegment(segment);

      // Vänta på att bearbetning ska slutföras med flera försök
      let finalState;
      let attempts = 0;
      const maxAttempts = 10;

      while (attempts < maxAttempts) {
        const state = queue.getCurrentState();
        if (state.segments.length > 0 && state.segments[0].source === 'berget') {
          finalState = state;
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 200));
        attempts++;
      }

      expect(finalState).toBeDefined();
      expect(finalState!.segments).toHaveLength(1);
      expect(finalState!.segments[0].source).toBe('berget');
      expect(finalState!.segments[0].text).toBe('Förbättrad text från Berget');
      expect(finalState!.segments[0].confidence).toBe(0.95);
    });

    it('ska hantera Berget API-fel gracefully', async () => {
      const audioBlob = new Blob(['test audio'], { type: 'audio/webm' });
      mockApi.setError(audioBlob.size.toString(), new Error('API-fel'));

      const segment: Omit<AudioSegment, 'timestamp'> = {
        id: 'test-1',
        text: 'Ursprunglig text',
        audioStart: 0,
        confidence: 0.7,
        source: 'webspeech',
        audioData: audioBlob
      };

      queue.addSegment(segment);

      // Vänta på att segmentet ska läggas till och sedan hanteras
      let finalState;
      let attempts = 0;
      const maxAttempts = 15;

      while (attempts < maxAttempts) {
        const state = queue.getCurrentState();
        if (state.segments.length > 0) {
          // Vänta lite till för att se om retry count uppdateras
          await new Promise(resolve => setTimeout(resolve, 200));
          finalState = queue.getCurrentState();
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 200));
        attempts++;
      }

      expect(finalState).toBeDefined();
      expect(finalState!.segments).toHaveLength(1);
      expect(finalState!.segments[0].text).toBe('Ursprunglig text');
      expect(finalState!.segments[0].source).toBe('webspeech');
      expect(finalState!.segments[0].retryCount).toBe(1);
    });

    it('ska kunna försöka igen med misslyckade segment', async () => {
      const audioBlob = new Blob(['test audio'], { type: 'audio/webm' });
      
      // Första försöket misslyckas
      mockApi.setError(audioBlob.size.toString(), new Error('Första fel'));

      const segment: Omit<AudioSegment, 'timestamp'> = {
        id: 'test-1',
        text: 'Ursprunglig text',
        audioStart: 0,
        confidence: 0.7,
        source: 'webspeech',
        audioData: audioBlob
      };

      queue.addSegment(segment);

      // Vänta på första misslyckade försöket
      await new Promise(resolve => setTimeout(resolve, 500));

      // Sätt upp framgångsrikt svar för retry
      mockApi.clear();
      mockApi.setResponse(audioBlob.size.toString(), { text: 'Framgångsrik retry' });

      // Försök igen
      queue.retrySegment('test-1');

      // Vänta på retry att slutföras
      let finalState;
      let attempts = 0;
      const maxAttempts = 10;

      while (attempts < maxAttempts) {
        const state = queue.getCurrentState();
        if (state.segments.length > 0 && state.segments[0].source === 'berget') {
          finalState = state;
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 200));
        attempts++;
      }

      expect(finalState).toBeDefined();
      expect(finalState!.segments[0].text).toBe('Framgångsrik retry');
      expect(finalState!.segments[0].source).toBe('berget');
    });
  });

  describe('Fönsterhantering', () => {
    it('ska gruppera segment i fönster baserat på antal', async () => {
      // Lägg till 6 segment (över maxWindowSize på 5)
      for (let i = 0; i < 6; i++) {
        queue.addSegment({
          id: `test-${i}`,
          text: `Segment ${i}`,
          audioStart: i,
          confidence: 0.8,
          source: 'webspeech'
        });
      }

      const state = await firstValueFrom(
        queue.getState$().pipe(take(1), timeout(1000))
      );

      expect(state.segments).toHaveLength(6);
      expect(state.fullTranscription).toContain('Segment 0');
      expect(state.fullTranscription).toContain('Segment 5');
    });
  });

  describe('Senaste två rader', () => {
    it('ska extrahera de senaste två raderna korrekt', async () => {
      queue.addSegment({
        id: 'test-1',
        text: 'Första meningen. Andra meningen. Tredje meningen.',
        audioStart: 0,
        confidence: 0.8,
        source: 'webspeech'
      });

      const state = await firstValueFrom(
        queue.getState$().pipe(take(1), timeout(1000))
      );

      expect(state.lastTwoLines).toHaveLength(2);
      expect(state.lastTwoLines[0]).toBe('Andra meningen');
      expect(state.lastTwoLines[1]).toBe('Tredje meningen');
    });

    it('ska hantera färre än två rader', async () => {
      queue.addSegment({
        id: 'test-1',
        text: 'Endast en mening.',
        audioStart: 0,
        confidence: 0.8,
        source: 'webspeech'
      });

      const state = await firstValueFrom(
        queue.getState$().pipe(take(1), timeout(1000))
      );

      expect(state.lastTwoLines).toHaveLength(1);
      expect(state.lastTwoLines[0]).toBe('Endast en mening');
    });
  });

  describe('Textrenning', () => {
    it('ska rensa bort HTML-entiteter från Berget-text', async () => {
      const audioBlob = new Blob(['test audio'], { type: 'audio/webm' });
      mockApi.setResponse(audioBlob.size.toString(), { 
        text: 'Text med &lt i&gt konstiga &amp; tecken &quot;här&quot;' 
      });

      const segment: Omit<AudioSegment, 'timestamp'> = {
        id: 'test-1',
        text: 'Ursprunglig text',
        audioStart: 0,
        confidence: 0.7,
        source: 'webspeech',
        audioData: audioBlob
      };

      queue.addSegment(segment);

      // Vänta på att Berget AI-bearbetning ska slutföras
      let finalState;
      let attempts = 0;
      const maxAttempts = 10;

      while (attempts < maxAttempts) {
        const state = queue.getCurrentState();
        if (state.segments.length > 0 && state.segments[0].source === 'berget') {
          finalState = state;
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 200));
        attempts++;
      }

      expect(finalState).toBeDefined();
      expect(finalState!.segments[0].text).toBe('Text med konstiga tecken här');
    });
  });
});
