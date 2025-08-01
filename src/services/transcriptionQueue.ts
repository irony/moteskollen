import { 
  Subject, 
  BehaviorSubject, 
  Observable, 
  merge, 
  timer, 
  EMPTY,
  of,
  throwError
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
  switchMap
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

export class TranscriptionQueue {
  private segmentInputSubject = new Subject<AudioSegment>();
  private stateSubject = new BehaviorSubject<TranscriptionState>({
    segments: [],
    fullTranscription: '',
    lastTwoLines: [],
    isProcessing: false
  });

  private bergetApi: BergetApiInterface;
  private segmentStreams = new Map<string, Observable<AudioSegment>>();

  constructor(bergetApi: BergetApiInterface) {
    this.bergetApi = bergetApi;
    this.setupTranscriptionPipeline();
  }

  private setupTranscriptionPipeline(): void {
    // Huvudström som samlar alla segment-strömmar
    const allSegmentUpdates$ = this.segmentInputSubject.pipe(
      mergeMap(inputSegment => this.createSegmentStream(inputSegment)),
      shareReplay(1)
    );

    // Bygg upp det fullständiga tillståndet från alla segment-uppdateringar
    const transcriptionState$ = allSegmentUpdates$.pipe(
      scan((state: TranscriptionState, updatedSegment: AudioSegment) => {
        // Uppdatera eller lägg till segment
        const allSegments = [...state.segments];
        const existingIndex = allSegments.findIndex(s => s.id === updatedSegment.id);
        
        if (existingIndex >= 0) {
          allSegments[existingIndex] = updatedSegment;
        } else {
          allSegments.push(updatedSegment);
        }

        // Sortera segment efter tidsstämpel
        allSegments.sort((a, b) => a.audioStart - b.audioStart);

        // Bygg fullständig transkribering
        const fullTranscription = allSegments
          .map(s => s.text)
          .join(' ')
          .trim();

        // Extrahera de senaste två raderna
        const lines = fullTranscription.split(/[.!?]+/).filter(line => line.trim());
        const lastTwoLines = lines.slice(-2).map(line => line.trim());

        return {
          segments: allSegments,
          fullTranscription,
          lastTwoLines,
          isProcessing: allSegments.some(s => s.isProcessing)
        };
      }, {
        segments: [],
        fullTranscription: '',
        lastTwoLines: [],
        isProcessing: false
      }),
      shareReplay(1)
    );

    // Prenumerera på tillståndsändringar
    transcriptionState$.subscribe(state => {
      this.stateSubject.next(state);
    });
  }

  /**
   * Skapar en ström för ett enskilt segment som börjar med webspeech
   * och sedan försöker förbättra med Berget AI
   */
  private createSegmentStream(initialSegment: AudioSegment): Observable<AudioSegment> {
    const segmentId = initialSegment.id;
    
    // Om vi redan har en ström för detta segment, returnera den
    if (this.segmentStreams.has(segmentId)) {
      return this.segmentStreams.get(segmentId)!;
    }

    // Skapa en ny segment-ström
    const segmentStream$ = of(initialSegment).pipe(
      // Börja med det ursprungliga segmentet
      startWith(initialSegment),
      
      // Om det är ett webspeech-segment med audioData, försök förbättra med Berget
      switchMap(segment => {
        if (segment.source === 'webspeech' && segment.audioData && (segment.retryCount || 0) < 3) {
          return of(segment).pipe(
            // Markera som bearbetas
            map(s => ({ ...s, isProcessing: true })),
            
            // Skicka till Berget AI
            switchMap(processingSegment => 
              this.transcribeWithBerget(processingSegment).pipe(
                // Vid framgång, returnera förbättrat segment
                map(improvedSegment => ({ ...improvedSegment, isProcessing: false })),
                
                // Vid fel, returnera ursprungligt segment med ökat retry-antal
                catchError(error => {
                  console.error(`Berget transcription failed for segment ${segmentId}:`, error);
                  return of({
                    ...processingSegment,
                    retryCount: (processingSegment.retryCount || 0) + 1,
                    isProcessing: false
                  });
                }),
                
                // Börja med processing-segmentet så UI:t uppdateras direkt
                startWith(processingSegment)
              )
            )
          );
        } else {
          // Returnera segmentet som det är om det inte ska bearbetas
          return of(segment);
        }
      }),
      
      // Dela strömmen så flera prenumeranter kan använda samma resultat
      shareReplay(1)
    );

    // Spara strömmen för framtida användning
    this.segmentStreams.set(segmentId, segmentStream$);
    
    return segmentStream$;
  }

  private transcribeWithBerget(segment: AudioSegment): Observable<AudioSegment> {
    if (!segment.audioData) {
      return throwError(() => new Error('Ingen audiodata tillgänglig'));
    }

    return new Observable<AudioSegment>(observer => {
      this.bergetApi.transcribeAudio(segment.audioData!)
        .then(result => {
          const improvedSegment: AudioSegment = {
            ...segment,
            text: this.cleanBergetText(result.text),
            source: 'berget',
            confidence: 0.95,
            isProcessing: false
          };
          observer.next(improvedSegment);
          observer.complete();
        })
        .catch(error => {
          observer.error(error);
        });
    }).pipe(
      // Använd RxJS inbyggda retry-funktionalitet med exponential backoff
      retry({
        count: 2,
        delay: (error, retryCount) => {
          console.log(`Retry attempt ${retryCount} for segment ${segment.id} after error:`, error.message);
          return timer(Math.pow(2, retryCount) * 1000);
        }
      })
    );
  }

  private cleanBergetText(text: string): string {
    if (!text) return '';
    
    return text
      .replace(/&lt\s*i&gt/gi, '')
      .replace(/&[a-zA-Z0-9#]+;/g, '')
      .replace(/(.)\1{3,}/g, '$1')
      .replace(/\s+/g, ' ')
      .trim();
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
      // Ta bort den gamla strömmen så en ny kan skapas
      this.segmentStreams.delete(segmentId);
      
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
    this.segmentStreams.clear();
  }
}
