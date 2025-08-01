import { 
  Subject, 
  BehaviorSubject, 
  Observable, 
  timer,
  of,
  throwError,
  from,
  merge,
  combineLatest
} from 'rxjs';
import { 
  map, 
  scan, 
  mergeMap, 
  catchError, 
  retry,
  distinctUntilChanged,
  shareReplay,
  startWith,
  debounceTime,
  buffer,
  filter,
  concatMap,
  delay,
  tap
} from 'rxjs/operators';

export interface AudioSegment {
  id: string;
  text: string;
  timestamp: Date;
  audioStart: number;
  audioEnd?: number;
  confidence: number;
  source: 'webspeech' | 'berget';
  audioData?: Blob;
  retryCount?: number;
  isProcessing?: boolean;
  segmentType?: 'live' | 'chunk' | 'full-meeting';
  wordCount?: number;
}

export interface TranscriptionState {
  segments: AudioSegment[];
  fullTranscription: string;
  lastTwoLines: string[];
  isProcessing: boolean;
  pendingSegments: number;
  totalWordCount: number;
  averageConfidence: number;
}

export interface BergetApiInterface {
  transcribeAudio(audioBlob: Blob): Promise<{ text: string }>;
}

// Ren funktion för att skapa Berget AI-anrop med pipe-arkitektur
const createBergetTranscription = (bergetApi: BergetApiInterface) => 
  (segment: AudioSegment): Observable<AudioSegment> => {
    if (!segment.audioData) {
      return throwError(() => new Error('Ingen audiodata tillgänglig'));
    }

    return from(bergetApi.transcribeAudio(segment.audioData)).pipe(
      retry({
        count: 2,
        delay: (error, retryCount) => {
          console.log(`Retry attempt ${retryCount} for segment ${segment.id} after error:`, error.message);
          return timer(Math.pow(2, retryCount) * 1000);
        }
      }),
      map(result => ({
        ...segment,
        text: cleanBergetText(result.text),
        source: 'berget' as const,
        confidence: 0.95,
        isProcessing: false
      }))
    );
  };

// Ren funktion för att rensa Berget-text
const cleanBergetText = (text: string): string => {
  if (!text) return '';
  
  return text
    .replace(/&lt\s*i&gt/gi, '')
    .replace(/&[a-zA-Z0-9#]+;/g, '')
    .replace(/(.)\1{3,}/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
};

// Ren funktion för att räkna ord
const countWords = (text: string): number => {
  return text.trim().split(/\s+/).filter(word => word.length > 0).length;
};

// Ren funktion för att segmentera långt tal
const segmentLongText = (segment: AudioSegment, maxWordsPerSegment: number = 12): AudioSegment[] => {
  const words = segment.text.trim().split(/\s+/);
  
  if (words.length <= maxWordsPerSegment) {
    return [{ ...segment, wordCount: words.length }];
  }

  const segments: AudioSegment[] = [];
  const totalDuration = (segment.audioEnd || segment.audioStart + 10) - segment.audioStart;
  const wordsPerSecond = words.length / totalDuration;

  for (let i = 0; i < words.length; i += maxWordsPerSegment) {
    const segmentWords = words.slice(i, Math.min(i + maxWordsPerSegment, words.length));
    const segmentText = segmentWords.join(' ');
    const segmentDuration = segmentWords.length / wordsPerSecond;
    const segmentStart = segment.audioStart + (i / wordsPerSecond);

    segments.push({
      ...segment,
      id: `${segment.id}-chunk-${Math.floor(i / maxWordsPerSegment)}`,
      text: segmentText,
      audioStart: segmentStart,
      audioEnd: segmentStart + segmentDuration,
      segmentType: 'chunk',
      wordCount: segmentWords.length
    });
  }

  return segments;
};

// Ren funktion för att hantera överlappande segment
const mergeOverlappingSegments = (segments: AudioSegment[]): AudioSegment[] => {
  if (segments.length <= 1) return segments;

  const sorted = [...segments].sort((a, b) => a.audioStart - b.audioStart);
  const merged: AudioSegment[] = [];
  let current = sorted[0];

  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i];
    const currentEnd = current.audioEnd || current.audioStart + 5;
    
    // Om segment överlappar mer än 2 sekunder, slå ihop dem
    if (next.audioStart < currentEnd - 2) {
      current = {
        ...current,
        id: `${current.id}-merged-${next.id}`,
        text: `${current.text} ${next.text}`,
        audioEnd: Math.max(currentEnd, next.audioEnd || next.audioStart + 5),
        confidence: Math.max(current.confidence, next.confidence),
        wordCount: (current.wordCount || 0) + (next.wordCount || 0)
      };
    } else {
      merged.push(current);
      current = next;
    }
  }
  
  merged.push(current);
  return merged;
};

// Ren funktion för att skapa segment-ström
const createSegmentStream = (bergetTranscribe: (segment: AudioSegment) => Observable<AudioSegment>) => 
  (initialSegment: AudioSegment): Observable<AudioSegment> => {
    // Börja med ursprungligt segment
    const initialStream$ = of(initialSegment);
    
    // Om det är webspeech med audioData, försök förbättra
    if (initialSegment.source === 'webspeech' && 
        initialSegment.audioData && 
        (initialSegment.retryCount || 0) < 3) {
      
      const processingStream$ = of({ ...initialSegment, isProcessing: true });
      
      const bergetStream$ = bergetTranscribe(initialSegment).pipe(
        catchError(error => {
          console.error(`Berget transcription failed for segment ${initialSegment.id}:`, error);
          // Returnera fel-segment omedelbart
          return of({
            ...initialSegment,
            retryCount: (initialSegment.retryCount || 0) + 1,
            isProcessing: false
          });
        }),
        // Säkerställ att vi alltid får ett resultat
        startWith({ ...initialSegment, isProcessing: true })
      );
      
      return bergetStream$;
    }
    
    return initialStream$;
  };

// Ren funktion för att bygga tillstånd från segment
const buildTranscriptionState = (segments: AudioSegment[]): TranscriptionState => {
  // Slå ihop överlappande segment först
  const mergedSegments = mergeOverlappingSegments(segments);
  
  // Sortera segment efter tidsstämpel
  const sortedSegments = [...mergedSegments].sort((a, b) => a.audioStart - b.audioStart);

  // Bygg fullständig transkribering
  const fullTranscription = sortedSegments
    .map(s => s.text)
    .join(' ')
    .trim();

  // Extrahera de senaste två raderna
  const lines = fullTranscription.split(/[.!?]+/).filter(line => line.trim());
  const lastTwoLines = lines.slice(-2).map(line => line.trim());

  // Beräkna statistik
  const totalWordCount = sortedSegments.reduce((sum, s) => sum + (s.wordCount || countWords(s.text)), 0);
  const averageConfidence = sortedSegments.length > 0 
    ? sortedSegments.reduce((sum, s) => sum + s.confidence, 0) / sortedSegments.length 
    : 0;
  const pendingSegments = sortedSegments.filter(s => s.isProcessing).length;

  return {
    segments: sortedSegments,
    fullTranscription,
    lastTwoLines,
    isProcessing: sortedSegments.some(s => s.isProcessing),
    pendingSegments,
    totalWordCount,
    averageConfidence
  };
};

export class TranscriptionQueue {
  private segmentInputSubject = new Subject<AudioSegment>();
  private fullMeetingSubject = new Subject<{ audioData: Blob; meetingId: string }>();
  private stateSubject = new BehaviorSubject<TranscriptionState>({
    segments: [],
    fullTranscription: '',
    lastTwoLines: [],
    isProcessing: false,
    pendingSegments: 0,
    totalWordCount: 0,
    averageConfidence: 0
  });

  private bergetApi: BergetApiInterface;
  private maxWordsPerSegment = 12;
  private retryDelayMs = 1000;

  constructor(bergetApi: BergetApiInterface, options?: { 
    maxWordsPerSegment?: number;
    retryDelayMs?: number;
  }) {
    this.bergetApi = bergetApi;
    this.maxWordsPerSegment = options?.maxWordsPerSegment || 12;
    this.retryDelayMs = options?.retryDelayMs || 1000;
    this.setupTranscriptionPipeline();
  }

  private setupTranscriptionPipeline(): void {
    // Skapa funktioner med bergetApi injicerat
    const bergetTranscribe = createBergetTranscription(this.bergetApi);
    const createSegment = this.createAdvancedSegmentStream(bergetTranscribe);

    // Hantera vanliga segment med segmentering av långt tal
    const segmentedInput$ = this.segmentInputSubject.pipe(
      // Segmentera långt tal automatiskt
      mergeMap(segment => {
        const wordCount = countWords(segment.text);
        if (wordCount > this.maxWordsPerSegment && segment.source === 'webspeech') {
          return from(segmentLongText(segment, this.maxWordsPerSegment));
        }
        return of({ ...segment, wordCount });
      }),
      shareReplay(1)
    );

    // Huvudström som bearbetar alla segment
    const allSegmentUpdates$ = segmentedInput$.pipe(
      // Skapa segment-ström för varje input med concurrency control
      mergeMap(createSegment, 3), // Max 3 samtidiga Berget API-anrop
      shareReplay(1)
    );

    // Hantera fullständig mötesbearbetning
    const fullMeetingUpdates$ = this.fullMeetingSubject.pipe(
      mergeMap(({ audioData, meetingId }) => 
        this.processFullMeeting(audioData, meetingId)
      ),
      shareReplay(1)
    );

    // Kombinera alla uppdateringar
    const combinedUpdates$ = merge(allSegmentUpdates$, fullMeetingUpdates$);

    // Bygg tillstånd från alla segment-uppdateringar
    const transcriptionState$ = combinedUpdates$.pipe(
      // Samla alla segment i en Map för effektiv uppdatering
      scan((segmentMap: Map<string, AudioSegment>, updatedSegment: AudioSegment) => {
        const newMap = new Map(segmentMap);
        newMap.set(updatedSegment.id, updatedSegment);
        return newMap;
      }, new Map<string, AudioSegment>()),
      
      // Konvertera Map till tillstånd
      map(segmentMap => buildTranscriptionState(Array.from(segmentMap.values()))),
      
      // Bara uppdatera när tillståndet faktiskt ändras
      distinctUntilChanged((prev, curr) => 
        prev.segments.length === curr.segments.length &&
        prev.fullTranscription === curr.fullTranscription &&
        prev.isProcessing === curr.isProcessing &&
        prev.pendingSegments === curr.pendingSegments
      ),
      
      shareReplay(1)
    );

    // Prenumerera på tillståndsändringar
    transcriptionState$.subscribe(state => {
      this.stateSubject.next(state);
    });
  }


  // Avancerad segment-ström med förbättrad felhantering
  private createAdvancedSegmentStream = (bergetTranscribe: (segment: AudioSegment) => Observable<AudioSegment>) => 
    (initialSegment: AudioSegment): Observable<AudioSegment> => {
      // Börja med ursprungligt segment
      const initialStream$ = of(initialSegment);
      
      // Om det är webspeech med audioData, försök förbättra
      if (initialSegment.source === 'webspeech' && 
          initialSegment.audioData && 
          (initialSegment.retryCount || 0) < 3) {
        
        const processingStream$ = of({ ...initialSegment, isProcessing: true });
        
        const bergetStream$ = bergetTranscribe(initialSegment).pipe(
          // Retry med exponential backoff
          retry({
            count: 2,
            delay: (error, retryCount) => {
              console.log(`Retry attempt ${retryCount} for segment ${initialSegment.id}`);
              return timer(this.retryDelayMs * Math.pow(2, retryCount - 1));
            }
          }),
          catchError(error => {
            console.error(`Berget transcription failed for segment ${initialSegment.id}:`, error);
            // Returnera fel-segment med ökat retry count
            return of({
              ...initialSegment,
              retryCount: (initialSegment.retryCount || 0) + 1,
              isProcessing: false
            });
          }),
          // Säkerställ att vi alltid får ett resultat
          startWith({ ...initialSegment, isProcessing: true })
        );
        
        return bergetStream$;
      }
      
      return initialStream$;
    };

  // Bearbeta hela mötet som en enhet
  private processFullMeeting(audioData: Blob, meetingId: string): Observable<AudioSegment> {
    const fullMeetingSegment: AudioSegment = {
      id: `full-meeting-${meetingId}`,
      text: 'Bearbetar hela mötet...',
      timestamp: new Date(),
      audioStart: 0,
      audioEnd: 0, // Kommer att uppdateras
      confidence: 0.5,
      source: 'webspeech',
      audioData,
      segmentType: 'full-meeting',
      isProcessing: true
    };

    return from(this.bergetApi.transcribeAudio(audioData)).pipe(
      map(result => ({
        ...fullMeetingSegment,
        text: cleanBergetText(result.text),
        source: 'berget' as const,
        confidence: 0.98,
        isProcessing: false,
        wordCount: countWords(result.text)
      })),
      retry({
        count: 2,
        delay: (error, retryCount) => {
          console.log(`Full meeting retry attempt ${retryCount}`);
          return timer(this.retryDelayMs * Math.pow(2, retryCount));
        }
      }),
      catchError(error => {
        console.error('Full meeting transcription failed:', error);
        return of({
          ...fullMeetingSegment,
          text: 'Fullständig mötesbearbetning misslyckades',
          isProcessing: false,
          confidence: 0.1
        });
      }),
      startWith(fullMeetingSegment)
    );
  }

  // Publika metoder
  addSegment(segment: Omit<AudioSegment, 'timestamp'>): void {
    const fullSegment: AudioSegment = {
      ...segment,
      timestamp: new Date(),
      wordCount: countWords(segment.text)
    };
    this.segmentInputSubject.next(fullSegment);
  }

  // Ny metod för att bearbeta hela mötet
  processFullMeetingTranscription(audioData: Blob, meetingId: string = Date.now().toString()): void {
    this.fullMeetingSubject.next({ audioData, meetingId });
  }

  updateSegment(segmentId: string, updates: Partial<AudioSegment>): void {
    const currentState = this.stateSubject.value;
    const segment = currentState.segments.find(s => s.id === segmentId);
    
    if (segment) {
      const updatedSegment = { ...segment, ...updates };
      // Skapa en ny ström för det uppdaterade segmentet
      this.segmentInputSubject.next(updatedSegment);
    }
  }

  getState$(): Observable<TranscriptionState> {
    return this.stateSubject.asObservable();
  }

  getCurrentState(): TranscriptionState {
    return this.stateSubject.value;
  }

  retrySegment(segmentId: string): void {
    const currentState = this.stateSubject.value;
    const segment = currentState.segments.find(s => s.id === segmentId);
    
    if (segment && segment.source === 'webspeech') {
      const retrySegment: AudioSegment = {
        ...segment,
        retryCount: 0, // Återställ retry count för ny försök
        isProcessing: false,
        source: 'webspeech' // Säkerställ att det behandlas som webspeech igen
      };
      this.segmentInputSubject.next(retrySegment);
    }
  }

  clear(): void {
    this.stateSubject.next({
      segments: [],
      fullTranscription: '',
      lastTwoLines: [],
      isProcessing: false,
      pendingSegments: 0,
      totalWordCount: 0,
      averageConfidence: 0
    });
  }

  // Ny metod för att få statistik
  getStatistics(): { 
    totalSegments: number;
    pendingSegments: number;
    totalWords: number;
    averageConfidence: number;
    processingRate: number;
  } {
    const state = this.getCurrentState();
    const bergetSegments = state.segments.filter(s => s.source === 'berget').length;
    const totalSegments = state.segments.length;
    
    return {
      totalSegments,
      pendingSegments: state.pendingSegments,
      totalWords: state.totalWordCount,
      averageConfidence: state.averageConfidence,
      processingRate: totalSegments > 0 ? bergetSegments / totalSegments : 0
    };
  }

  destroy(): void {
    this.segmentInputSubject.complete();
    this.fullMeetingSubject.complete();
    this.stateSubject.complete();
  }
}
