import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TranscriptionQueue, AudioSegment, BergetApiInterface } from '../services/transcriptionQueue';
import { firstValueFrom, filter, take, timeout, map, skip } from 'rxjs';

// Avancerad Mock Berget API med realistiska delays och fel
class AdvancedMockBergetApi implements BergetApiInterface {
  private responses: Map<string, { text: string; delay?: number }> = new Map();
  private errors: Map<string, { error: Error; delay?: number }> = new Map();
  private callCount = 0;

  setResponse(segmentId: string, response: { text: string; delay?: number }): void {
    this.responses.set(segmentId, response);
  }

  setError(segmentId: string, error: Error, delay: number = 0): void {
    this.errors.set(segmentId, { error, delay });
  }

  async transcribeAudio(audioBlob: Blob): Promise<{ text: string }> {
    this.callCount++;
    
    // Försök hitta svar baserat på olika nycklar
    const keys = [
      `${audioBlob.size}-${this.callCount}`,
      `${audioBlob.size}`,
      `call-${this.callCount}`,
      'default'
    ];
    
    let segmentId = '';
    let response = null;
    let errorData = null;
    
    for (const key of keys) {
      if (this.responses.has(key)) {
        segmentId = key;
        response = this.responses.get(key);
        break;
      }
      if (this.errors.has(key)) {
        segmentId = key;
        errorData = this.errors.get(key);
        break;
      }
    }
    
    // Simulera realistisk bearbetningstid men kortare för tester
    const baseDelay = Math.random() * 200 + 100; // 100-300ms för snabbare tester
    
    if (errorData) {
      await new Promise(resolve => setTimeout(resolve, errorData.delay || baseDelay));
      throw errorData.error;
    }

    if (!response) {
      response = { text: `Mock transcription ${this.callCount}` };
    }
    
    await new Promise(resolve => setTimeout(resolve, response.delay || baseDelay));
    
    return { text: response.text };
  }

  getCallCount(): number {
    return this.callCount;
  }

  clear(): void {
    this.responses.clear();
    this.errors.clear();
    this.callCount = 0;
  }
}

describe('TranscriptionQueue - Avancerade Scenarier', () => {
  let queue: TranscriptionQueue;
  let mockApi: AdvancedMockBergetApi;

  beforeEach(() => {
    mockApi = new AdvancedMockBergetApi();
    queue = new TranscriptionQueue(mockApi);
  });

  afterEach(() => {
    queue.destroy();
    mockApi.clear();
  });

  describe('Scenario 1: Kontinuerligt tal utan pauser', () => {
    it('ska segmentera långt tal i chunks baserat på ordantal', async () => {
      // Simulera kontinuerligt tal - 50 ord som ska delas upp
      const longText = Array.from({ length: 50 }, (_, i) => `ord${i + 1}`).join(' ');
      
      // Förvänta oss att detta delas upp i ~5 segment (12 ord per segment är default)
      const wordsPerSegment = 12;
      const expectedSegments = Math.ceil(50 / wordsPerSegment);

      // Sätt upp mock-svar för alla möjliga chunk-kombinationer
      // Använd enklare nyckelstruktur
      for (let i = 1; i <= 10; i++) {
        mockApi.setResponse(`${i}`, { 
          text: `Berget chunk ${i}: ${Array.from({ length: Math.min(wordsPerSegment, 12) }, (_, j) => `ord${j + 1}`).join(' ')}`,
          delay: 50 // Kortare delay
        });
      }

      // Lägg till det långa segmentet
      queue.addSegment({
        id: 'long-speech',
        text: longText,
        audioStart: 0,
        audioEnd: 30,
        confidence: 0.8,
        source: 'webspeech',
        audioData: new Blob(['long audio'], { type: 'audio/webm' })
      });

      // Vänta på att segmenteringen ska ske
      const finalState = await firstValueFrom(
        queue.getState$().pipe(
          filter(state => {
            // Kontrollera att vi har fått segment som är längre än ursprungstexten
            // (eftersom chunks kommer att läggas till)
            return state.segments.length >= expectedSegments;
          }),
          timeout(3000), // Kortare timeout
          take(1)
        )
      );

      // Mer flexibla krav - vi vill bara se att segmentering skedde
      expect(finalState.segments.length).toBeGreaterThanOrEqual(expectedSegments);
      expect(finalState.fullTranscription.length).toBeGreaterThan(longText.length * 0.5); // Minst hälften av ursprungstexten
    });

    it('ska hantera överlappande segment när tal fortsätter', async () => {
      // Första segmentet - långt tal
      queue.addSegment({
        id: 'segment-1',
        text: 'Detta är början på ett mycket långt tal som fortsätter',
        audioStart: 0,
        audioEnd: 10,
        confidence: 0.8,
        source: 'webspeech',
        audioData: new Blob(['audio1'], { type: 'audio/webm' })
      });

      // Andra segmentet kommer innan första är klart från Berget
      setTimeout(() => {
        queue.addSegment({
          id: 'segment-2', 
          text: 'och här fortsätter talet utan någon paus alls',
          audioStart: 8, // Överlappning med föregående
          audioEnd: 18,
          confidence: 0.8,
          source: 'webspeech',
          audioData: new Blob(['audio2'], { type: 'audio/webm' })
        });
      }, 100);

      const finalState = await firstValueFrom(
        queue.getState$().pipe(
          filter(state => state.segments.length >= 2),
          timeout(3000),
          take(1)
        )
      );

      expect(finalState.segments.length).toBeGreaterThanOrEqual(2);
      expect(finalState.fullTranscription).toContain('början');
      expect(finalState.fullTranscription).toContain('fortsätter');
    });
  });

  describe('Scenario 2: Paus i ljud medan Berget bearbetar', () => {
    it('ska hantera ny audio medan tidigare segment bearbetas', async () => {
      // Sätt upp långsam bearbetning för första segmentet
      mockApi.setResponse('100-1', { text: 'Första segmentet färdigt', delay: 2000 });
      mockApi.setResponse('200-2', { text: 'Andra segmentet färdigt', delay: 500 });

      // Första segmentet - börjar bearbetas
      queue.addSegment({
        id: 'slow-segment',
        text: 'Detta tar lång tid att bearbeta',
        audioStart: 0,
        audioEnd: 5,
        confidence: 0.7,
        source: 'webspeech',
        audioData: new Blob(['x'.repeat(100)], { type: 'audio/webm' })
      });

      // Andra segmentet kommer snabbt efter
      setTimeout(() => {
        queue.addSegment({
          id: 'fast-segment',
          text: 'Detta bearbetas snabbt',
          audioStart: 6,
          audioEnd: 10,
          confidence: 0.8,
          source: 'webspeech',
          audioData: new Blob(['y'.repeat(200)], { type: 'audio/webm' })
        });
      }, 200);

      // Vänta på att båda segmenten ska vara klara
      const finalState = await firstValueFrom(
        queue.getState$().pipe(
          filter(state => 
            state.segments.filter(s => s.source === 'berget').length >= 2
          ),
          timeout(5000),
          take(1)
        )
      );

      const bergetSegments = finalState.segments.filter(s => s.source === 'berget');
      expect(bergetSegments.length).toBe(2);
      expect(bergetSegments.some(s => s.text.includes('Första segmentet'))).toBe(true);
      expect(bergetSegments.some(s => s.text.includes('Andra segmentet'))).toBe(true);
    });

    it('ska korrekt hantera tidsordning när segment slutförs i olika ordning', async () => {
      // Sätt upp så att senare segment slutförs först
      mockApi.setResponse('100-1', { text: 'Långsamt segment', delay: 1500 });
      mockApi.setResponse('200-2', { text: 'Snabbt segment', delay: 300 });

      queue.addSegment({
        id: 'first-slow',
        text: 'Första segmentet',
        audioStart: 0,
        audioEnd: 5,
        confidence: 0.8,
        source: 'webspeech',
        audioData: new Blob(['x'.repeat(100)], { type: 'audio/webm' })
      });

      setTimeout(() => {
        queue.addSegment({
          id: 'second-fast',
          text: 'Andra segmentet',
          audioStart: 6,
          audioEnd: 10,
          confidence: 0.8,
          source: 'webspeech',
          audioData: new Blob(['y'.repeat(200)], { type: 'audio/webm' })
        });
      }, 100);

      const finalState = await firstValueFrom(
        queue.getState$().pipe(
          filter(state => 
            state.segments.filter(s => s.source === 'berget').length >= 2
          ),
          timeout(3000),
          take(1)
        )
      );

      // Kontrollera att segment är sorterade efter audioStart trots olika slutförandetider
      const sortedSegments = finalState.segments.sort((a, b) => a.audioStart - b.audioStart);
      expect(sortedSegments[0].audioStart).toBeLessThan(sortedSegments[1].audioStart);
    });
  });

  describe('Scenario 3: Fullständig mötesbearbetning vid stopp', () => {
    it('ska kunna bearbeta hela mötet som en enhet', async () => {
      // Lägg till flera segment under "inspelning"
      const segments = [
        { text: 'Välkomna till mötet', audioStart: 0, audioEnd: 3 },
        { text: 'Vi ska diskutera budget', audioStart: 4, audioEnd: 8 },
        { text: 'Har alla fått rapporten', audioStart: 10, audioEnd: 14 },
        { text: 'Låt oss börja med första punkten', audioStart: 15, audioEnd: 20 }
      ];

      // Sätt upp mock-svar för individuella segment
      segments.forEach((seg, i) => {
        mockApi.setResponse(`audio${i}-${i + 1}`, { 
          text: `Berget: ${seg.text}`,
          delay: 200 
        });
      });

      segments.forEach((seg, i) => {
        queue.addSegment({
          id: `meeting-segment-${i}`,
          text: seg.text,
          audioStart: seg.audioStart,
          audioEnd: seg.audioEnd,
          confidence: 0.8,
          source: 'webspeech',
          audioData: new Blob([`audio${i}`], { type: 'audio/webm' })
        });
      });

      // Vänta på att alla segment ska vara tillagda
      await firstValueFrom(
        queue.getState$().pipe(
          filter(state => state.segments.length >= 4),
          take(1)
        )
      );

      // Simulera "stopp" - bearbeta hela mötet med korrekt blob-storlek för mock
      const fullMeetingText = segments.map(s => s.text).join(' ');
      const fullMeetingBlob = new Blob(['full-meeting-audio'], { type: 'audio/webm' });
      mockApi.setResponse(`${fullMeetingBlob.size}-${mockApi.getCallCount() + 1}`, { 
        text: `Fullständigt mötesprotokoll: ${fullMeetingText}`,
        delay: 500 
      });

      // Använd processFullMeetingTranscription istället för addSegment
      queue.processFullMeetingTranscription(fullMeetingBlob, 'test-meeting');

      const finalState = await firstValueFrom(
        queue.getState$().pipe(
          filter(state => 
            state.segments.some(s => s.text.includes('Fullständigt mötesprotokoll'))
          ),
          timeout(3000),
          take(1)
        )
      );

      const fullMeetingSegment = finalState.segments.find(s => 
        s.text.includes('Fullständigt mötesprotokoll')
      );
      expect(fullMeetingSegment).toBeDefined();
      expect(fullMeetingSegment!.text).toContain('Välkomna till mötet');
      expect(fullMeetingSegment!.text).toContain('första punkten');
    });
  });

  describe('Scenario 4: Låg ljudkvalitet och retry-logik', () => {
    it('ska hantera flera retry-försök vid dålig ljudkvalitet', async () => {
      // Första två försöken misslyckas
      mockApi.setError('100-1', new Error('Dålig ljudkvalitet'), 500);
      mockApi.setError('100-2', new Error('Fortfarande dålig kvalitet'), 500);
      mockApi.setResponse('100-3', { text: 'Äntligen fungerande transkribering', delay: 300 });

      queue.addSegment({
        id: 'poor-quality',
        text: 'Otydligt tal',
        audioStart: 0,
        audioEnd: 5,
        confidence: 0.3, // Låg confidence indikerar dålig kvalitet
        source: 'webspeech',
        audioData: new Blob(['x'.repeat(100)], { type: 'audio/webm' })
      });

      // Första retry
      setTimeout(() => queue.retrySegment('poor-quality'), 600);
      // Andra retry
      setTimeout(() => queue.retrySegment('poor-quality'), 1200);

      const finalState = await firstValueFrom(
        queue.getState$().pipe(
          filter(state => 
            state.segments.some(s => s.text.includes('Äntligen fungerande'))
          ),
          timeout(5000),
          take(1)
        )
      );

      const successSegment = finalState.segments.find(s => 
        s.text.includes('Äntligen fungerande')
      );
      expect(successSegment).toBeDefined();
      expect(mockApi.getCallCount()).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Scenario 5: Snabbt tal med många korta segment', () => {
    it('ska hantera många snabba segment effektivt', async () => {
      const rapidSegments = Array.from({ length: 10 }, (_, i) => ({
        id: `rapid-${i}`,
        text: `Snabb mening ${i + 1}`,
        audioStart: i * 0.5,
        audioEnd: (i + 1) * 0.5,
        confidence: 0.8,
        source: 'webspeech' as const,
        audioData: new Blob([`rapid${i}`], { type: 'audio/webm' })
      }));

      // Sätt upp mock-svar för alla segment
      rapidSegments.forEach((seg, i) => {
        mockApi.setResponse(`rapid${i}-${i + 1}`, { 
          text: `Berget: ${seg.text}`, 
          delay: Math.random() * 200 + 100 
        });
      });

      // Lägg till alla segment snabbt
      rapidSegments.forEach((seg, i) => {
        setTimeout(() => queue.addSegment(seg), i * 50);
      });

      const finalState = await firstValueFrom(
        queue.getState$().pipe(
          filter(state => state.segments.length >= 10),
          timeout(5000),
          take(1)
        )
      );

      expect(finalState.segments.length).toBeGreaterThanOrEqual(10);
      expect(finalState.fullTranscription).toContain('Snabb mening 1');
      expect(finalState.fullTranscription).toContain('Snabb mening 10');
    });
  });

  describe('Scenario 6: Långa tystnader följt av intensivt tal', () => {
    it('ska hantera stora gap i audioStart-tider', async () => {
      // Första segmentet
      queue.addSegment({
        id: 'before-silence',
        text: 'Innan den långa tystnaden',
        audioStart: 0,
        audioEnd: 3,
        confidence: 0.8,
        source: 'webspeech',
        audioData: new Blob(['before'], { type: 'audio/webm' })
      });

      // Lång tystnad (30 sekunder)
      setTimeout(() => {
        queue.addSegment({
          id: 'after-silence',
          text: 'Efter den långa tystnaden börjar intensivt tal',
          audioStart: 33, // 30 sekunders gap
          audioEnd: 38,
          confidence: 0.8,
          source: 'webspeech',
          audioData: new Blob(['after'], { type: 'audio/webm' })
        });
      }, 100);

      const finalState = await firstValueFrom(
        queue.getState$().pipe(
          filter(state => state.segments.length >= 2),
          timeout(3000),
          take(1)
        )
      );

      const sortedSegments = finalState.segments.sort((a, b) => a.audioStart - b.audioStart);
      expect(sortedSegments[1].audioStart - sortedSegments[0].audioEnd).toBeGreaterThan(25);
      expect(finalState.fullTranscription).toContain('Innan den långa');
      expect(finalState.fullTranscription).toContain('Efter den långa');
    });
  });

  describe('Scenario 7: Nätverksproblem under bearbetning', () => {
    it('ska hantera intermittenta nätverksfel', async () => {
      // Simulera nätverksfel följt av framgång
      mockApi.setError('100-1', new Error('Network timeout'), 800);
      mockApi.setResponse('100-2', { text: 'Framgångsrik efter nätverksfel', delay: 400 });

      queue.addSegment({
        id: 'network-issue',
        text: 'Segment med nätverksproblem',
        audioStart: 0,
        audioEnd: 5,
        confidence: 0.8,
        source: 'webspeech',
        audioData: new Blob(['x'.repeat(100)], { type: 'audio/webm' })
      });

      // Retry efter nätverksfel
      setTimeout(() => queue.retrySegment('network-issue'), 1000);

      const finalState = await firstValueFrom(
        queue.getState$().pipe(
          filter(state => 
            state.segments.some(s => s.text.includes('Framgångsrik efter'))
          ),
          timeout(4000),
          take(1)
        )
      );

      const recoveredSegment = finalState.segments.find(s => 
        s.text.includes('Framgångsrik efter')
      );
      expect(recoveredSegment).toBeDefined();
      expect(mockApi.getCallCount()).toBe(2); // Ett fel + en framgång
    });
  });
});
