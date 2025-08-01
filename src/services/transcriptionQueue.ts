import { 
  Subject, 
  BehaviorSubject, 
  Observable, 
  merge, 
  timer, 
  EMPTY,
  of,
  throwError,
  from,
  pipe
} from 'rxjs';
import { 
  map, 
  scan, 
  mergeMap, 
  catchError, 
  retry, 
  delay,
  tap,
  filter,
  distinctUntilChanged,
  shareReplay,
  startWith,
  switchMap,
  concatMap
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
}

export interface TranscriptionState {
  segments: AudioSegment[];
  fullTranscription: string;
  lastTwoLines: string[];
  isProcessing: boolean;
}

export interface BergetApiInterface {
  transcribeAudio(audioBlob: Blob): Promise<{ text: string }>;
}

// Higher-order functions för retry-logik
const createRetryStrategy = (maxRetries: number = 2) => 
  retry({
    count: maxRetries,
    delay: (error, retryCount) => {
      console.log(`Retry attempt ${retryCount} after error:`, error.message);
      return timer(Math.pow(2, retryCount) * 1000);
    }
  });

// Ren funktion för att skapa Berget AI-anrop med pipe-arkitektur
const createBergetTranscription = (bergetApi: BergetApiInterface) => 
  (segment: AudioSegment): Observable<AudioSegment> => {
    if (!segment.audioData) {
      return throwError(() => new Error('Ingen audiodata tillgänglig'));
    }

    // Elegant pipe-baserad transcription pipeline
    const transcribeWithBerget = pipe(
      map((audio: Blob) => audio), // Konvertera till rätt format om nödvändigt
      mergeMap((wav: Blob) => from(bergetApi.transcribeAudio(wav))),
      createRetryStrategy(2),
      map((result: { text: string }) => result.text),
      map((text: string) => cleanBergetText(text))
    );

    return of(segment.audioData).pipe(
      transcribeWithBerget,
      map(cleanedText => ({
        ...segment,
        text: cleanedText,
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
          return of({
            ...initialSegment,
            retryCount: (initialSegment.retryCount || 0) + 1,
            isProcessing: false
          });
        }),
        // Lägg till delay för att säkerställa att processing-segmentet hinner visas först
        delay(100)
      );
      
      return merge(
        initialStream$,
        processingStream$,
        bergetStream$
      );
    }
    
    return initialStream$;
  };

// Ren funktion för att bygga tillstånd från segment
const buildTranscriptionState = (segments: AudioSegment[]): TranscriptionState => {
  // Sortera segment efter tidsstämpel
  const sortedSegments = [...segments].sort((a, b) => a.audioStart - b.audioStart);

  // Bygg fullständig transkribering
  const fullTranscription = sortedSegments
    .map(s => s.text)
    .join(' ')
    .trim();

  // Extrahera de senaste två raderna
  const lines = fullTranscription.split(/[.!?]+/).filter(line => line.trim());
  const lastTwoLines = lines.slice(-2).map(line => line.trim());

  return {
    segments: sortedSegments,
    fullTranscription,
    lastTwoLines,
    isProcessing: sortedSegments.some(s => s.isProcessing)
  };
};

export class TranscriptionQueue {
  private segmentInputSubject = new Subject<AudioSegment>();
  private stateSubject = new BehaviorSubject<TranscriptionState>({
    segments: [],
    fullTranscription: '',
    lastTwoLines: [],
    isProcessing: false
  });

  private bergetApi: BergetApiInterface;

  constructor(bergetApi: BergetApiInterface) {
    this.bergetApi = bergetApi;
    this.setupTranscriptionPipeline();
  }

  private setupTranscriptionPipeline(): void {
    // Skapa funktioner med bergetApi injicerat
    const bergetTranscribe = createBergetTranscription(this.bergetApi);
    const createSegment = createSegmentStream(bergetTranscribe);

    // Huvudström som bearbetar alla segment
    const allSegmentUpdates$ = this.segmentInputSubject.pipe(
      // Skapa segment-ström för varje input
      mergeMap(createSegment),
      shareReplay(1)
    );

    // Bygg tillstånd från alla segment-uppdateringar
    const transcriptionState$ = allSegmentUpdates$.pipe(
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
        prev.isProcessing === curr.isProcessing
      ),
      
      shareReplay(1)
    );

    // Prenumerera på tillståndsändringar
    transcriptionState$.subscribe(state => {
      this.stateSubject.next(state);
    });
  }


  // Publika metoder
  addSegment(segment: Omit<AudioSegment, 'timestamp'>): void {
    const fullSegment: AudioSegment = {
      ...segment,
      timestamp: new Date()
    };
    this.segmentInputSubject.next(fullSegment);
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
      isProcessing: false
    });
  }

  destroy(): void {
    this.segmentInputSubject.complete();
    this.stateSubject.complete();
  }
}
