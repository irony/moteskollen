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
  windowWhen, 
  mergeMap, 
  catchError, 
  retry, 
  delay,
  tap,
  filter,
  distinctUntilChanged,
  shareReplay
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
  private segmentSubject = new Subject<AudioSegment>();
  private stateSubject = new BehaviorSubject<TranscriptionState>({
    segments: [],
    fullTranscription: '',
    lastTwoLines: [],
    isProcessing: false
  });

  private bergetApi: BergetApiInterface;
  private windowTrigger = new Subject<void>();
  private maxWindowSize = 5;
  private windowTimeoutMs = 3000;

  constructor(bergetApi: BergetApiInterface) {
    this.bergetApi = bergetApi;
    this.setupTranscriptionPipeline();
  }

  private setupTranscriptionPipeline(): void {
    // Huvudpipeline för att hantera segment
    const segmentStream$ = this.segmentSubject.pipe(
      // Gruppera segment i fönster baserat på timer eller antal
      windowWhen(() => 
        merge(
          timer(this.windowTimeoutMs),
          this.segmentSubject.pipe(
            scan((count) => count + 1, 0),
            filter(count => count >= this.maxWindowSize),
            map(() => void 0)
          )
        )
      ),
      // Bearbeta varje fönster av segment
      mergeMap(window$ => 
        window$.pipe(
          scan((acc: AudioSegment[], segment: AudioSegment) => {
            // Uppdatera befintligt segment eller lägg till nytt
            const existingIndex = acc.findIndex(s => s.id === segment.id);
            if (existingIndex >= 0) {
              acc[existingIndex] = { ...acc[existingIndex], ...segment };
            } else {
              acc.push(segment);
            }
            return acc;
          }, [])
        )
      ),
      // Skicka segment till Berget AI för förbättring
      mergeMap(segments => this.processSegmentsWithBerget(segments)),
      // Bygg upp det fullständiga transkriptionstillståndet
      scan((state: TranscriptionState, updatedSegments: AudioSegment[]) => {
        // Slå samman nya segment med befintliga
        const allSegments = [...state.segments];
        
        updatedSegments.forEach(updatedSegment => {
          const existingIndex = allSegments.findIndex(s => s.id === updatedSegment.id);
          if (existingIndex >= 0) {
            allSegments[existingIndex] = updatedSegment;
          } else {
            allSegments.push(updatedSegment);
          }
        });

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

    // Prenumerera på strömmen och uppdatera state
    segmentStream$.subscribe(state => {
      this.stateSubject.next(state);
    });
  }

  private processSegmentsWithBerget(segments: AudioSegment[]): Observable<AudioSegment[]> {
    const segmentsToProcess = segments.filter(s => 
      s.source === 'webspeech' && 
      s.audioData && 
      !s.isProcessing &&
      (s.retryCount || 0) < 3
    );

    if (segmentsToProcess.length === 0) {
      return of(segments);
    }

    // Markera segment som bearbetas
    const processingSegments = segments.map(s => 
      segmentsToProcess.some(ps => ps.id === s.id) 
        ? { ...s, isProcessing: true }
        : s
    );

    // Bearbeta varje segment parallellt
    const bergetRequests$ = segmentsToProcess.map(segment =>
      this.transcribeWithBerget(segment).pipe(
        catchError(error => {
          console.error(`Berget transcription failed for segment ${segment.id}:`, error);
          // Returnera ursprungligt segment med ökat retry-antal
          return of({
            ...segment,
            retryCount: (segment.retryCount || 0) + 1,
            isProcessing: false
          });
        })
      )
    );

    if (bergetRequests$.length === 0) {
      return of(processingSegments);
    }

    return merge(...bergetRequests$).pipe(
      scan((acc: AudioSegment[], updatedSegment: AudioSegment) => {
        const index = acc.findIndex(s => s.id === updatedSegment.id);
        if (index >= 0) {
          acc[index] = updatedSegment;
        }
        return acc;
      }, processingSegments),
      // Vänta tills alla requests är klara
      filter((_, index) => index === bergetRequests$.length - 1),
      map(finalSegments => finalSegments)
    );
  }

  private transcribeWithBerget(segment: AudioSegment): Observable<AudioSegment> {
    if (!segment.audioData) {
      return throwError(new Error('Ingen audiodata tillgänglig'));
    }

    return new Observable(observer => {
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
      retry({
        count: 2,
        delay: (error, retryCount) => timer(Math.pow(2, retryCount) * 1000)
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
    this.segmentSubject.next(fullSegment);
  }

  updateSegment(segmentId: string, updates: Partial<AudioSegment>): void {
    const currentState = this.stateSubject.value;
    const segment = currentState.segments.find(s => s.id === segmentId);
    
    if (segment) {
      const updatedSegment = { ...segment, ...updates };
      this.segmentSubject.next(updatedSegment);
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
        retryCount: (segment.retryCount || 0) + 1,
        isProcessing: false
      };
      this.segmentSubject.next(retrySegment);
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
    this.segmentSubject.complete();
    this.stateSubject.complete();
    this.windowTrigger.complete();
  }
}
