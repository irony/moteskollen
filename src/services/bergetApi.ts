interface BergetAuthResponse {
  access_token?: string;
  token?: string;
  expires_in?: number;
  refresh_token?: string;
  token_type?: string;
  status?: string;
  error?: string;
}

interface RefreshTokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

interface TranscriptionResponse {
  text: string;
  segments?: Array<{
    start: number;
    end: number;
    text: string;
  }>;
}

interface SummaryResponse {
  summary: string;
  action_items?: string[];
}

interface MeetingAnalysisResponse {
  purpose: string;
  suggestedTitle: string;
  participants: string[];
  estimatedParticipants: number;
  suggestedTemplate: string;
  actionPoints: string[];
  confidence: number;
}

interface TokenUsageResponse {
  usage: Array<{
    date: string;
    model: string;
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
    cost: {
      amount: number;
      currency: string;
    };
  }>;
  total: {
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
    cost: {
      amount: number;
      currency: string;
    };
  };
  period: {
    start: string;
    end: string;
  };
}

interface SubscriptionUsageResponse {
  name: string;
  status: string;
  startDate: string;
  createDate: string;
  partnerId: string;
  planCode: string;
  endDate: string;
  cancelDate: string;
  currentBillingPeriodStartDate: string;
  currentBillingPeriodEndDate: string;
  usage: {
    currentUsageAmountCents: number;
    externalHistoricalUsageAmountCents: number;
    fromDateTime: string;
    toDateTime: string;
    invoicedUsageAmountCents: number;
  };
}

interface ApiError {
  message: string;
  type: 'quota_exceeded' | 'invalid_api_key' | 'server_error' | 'unknown';
  code?: string;
}

class BergetApiService {
  private baseUrl = 'https://api.berget.ai';
  private apiKey: string | null = null;
  private refreshToken: string | null = null;

  constructor() {
    // Import security service dynamically to avoid circular imports
    import('../lib/security').then(({ securityService }) => {
      this.apiKey = securityService.getSecureToken('berget_api_key');
      this.refreshToken = securityService.getSecureToken('berget_refresh_token');
    });
  }

  // Refresh access token using refresh token
  async refreshAccessToken(): Promise<RefreshTokenResponse> {
    if (!this.refreshToken) {
      throw new Error('Ingen refresh token tillgänglig');
    }

    const response = await fetch(`${this.baseUrl}/v1/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        refresh_token: this.refreshToken,
        is_device_token: true
      })
    });

    if (!response.ok) {
      // Om refresh token är ogiltig, rensa tokens och kasta fel
      this.clearTokens();
      const errorText = await response.text();
      throw new Error(`Kunde inte förnya access token: ${response.status} - ${errorText}`);
    }

    const tokenData: RefreshTokenResponse = await response.json();
    
    // Spara de nya tokens
    await this.storeTokens(tokenData.access_token, tokenData.refresh_token);
    
    return tokenData;
  }

  // Store tokens securely
  private async storeTokens(accessToken: string, refreshToken: string) {
    this.refreshToken = refreshToken;
    const { securityService } = await import('../lib/security');
    securityService.setSecureToken('berget_refresh_token', refreshToken);
  }

  // Clear all tokens
  private clearTokens() {
    this.apiKey = null;
    this.refreshToken = null;
    import('../lib/security').then(({ securityService }) => {
      securityService.removeSecureToken('berget_api_key');
      securityService.removeSecureToken('berget_refresh_token');
    });
  }

  // Enhanced API request method with automatic token refresh
  private async makeAuthenticatedRequest(url: string, options: RequestInit = {}): Promise<Response> {
    if (!this.apiKey) {
      throw new Error('API-nyckel saknas');
    }

    // Add authorization header
    const headers = {
      ...options.headers,
      'Authorization': `Bearer ${this.apiKey}`,
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    // If we get a 401 and have a refresh token, try to refresh
    if (response.status === 401 && this.refreshToken) {
      try {
        console.log('Access token expired, refreshing...');
        const newTokens = await this.refreshAccessToken();
        
        // Create new API key with refreshed access token
        const newApiKey = await this.createApiKey(newTokens.access_token);
        
        // Retry the original request with new API key
        const retryHeaders = {
          ...options.headers,
          'Authorization': `Bearer ${newApiKey}`,
        };

        return fetch(url, {
          ...options,
          headers: retryHeaders,
        });
      } catch (refreshError) {
        console.error('Token refresh failed:', refreshError);
        throw new Error('API-nyckeln har gått ut och kunde inte förnyas. Vänligen logga in igen.');
      }
    }

    return response;
  }

  // Device Token Flow för att skapa konto/logga in
  async initiateDeviceAuth(): Promise<{ device_code: string; user_code: string; verification_uri: string; interval: number; expires_in: number }> {
    const response = await fetch(`${this.baseUrl}/v1/auth/device`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Device auth error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return {
      device_code: data.device_code,
      user_code: data.user_code,
      verification_uri: data.verification_url,
      interval: data.interval,
      expires_in: data.expires_in
    };
  }

  // Hämta access token med device code
  async getAccessToken(deviceCode: string): Promise<BergetAuthResponse> {
    const response = await fetch(`${this.baseUrl}/v1/auth/device/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        device_code: deviceCode
      })
    });

    const tokenData = await response.json();
    
    // Spara refresh token om det finns
    if (tokenData.refresh_token) {
      await this.storeTokens(tokenData.access_token || tokenData.token, tokenData.refresh_token);
    }
    
    return tokenData;
  }

  // Skapa API-nyckel med access token
  async createApiKey(accessToken: string): Promise<string> {
    const response = await fetch(`${this.baseUrl}/v1/api-keys`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Protokoll Klippare',
        description: 'Skapad från Protokoll Klippare applikation'
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Kunde inte skapa API-nyckel: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    const apiKey = result.key;
    
    if (!apiKey) {
      throw new Error('API-nyckel saknas i svaret');
    }

    this.setApiKey(apiKey);
    return apiKey;
  }

  // Skapa API-nyckel med Keycloak token (behålls för bakåtkompatibilitet)
  async createApiKeyWithKeycloak(keycloakToken: string): Promise<string> {
    return this.createApiKey(keycloakToken);
  }

  setApiKey(key: string) {
    this.apiKey = key;
    import('../lib/security').then(({ securityService }) => {
      securityService.setSecureToken('berget_api_key', key);
    });
  }

  getApiKey(): string | null {
    return this.apiKey;
  }

  clearApiKey() {
    this.clearTokens();
  }

  // Hämta token-användningsstatistik
  async getTokenUsage(startDate?: string, endDate?: string): Promise<TokenUsageResponse> {
    let url = `${this.baseUrl}/v1/usage/tokens`;
    const params = new URLSearchParams();
    
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    
    if (params.toString()) {
      url += `?${params.toString()}`;
    }

    const response = await this.makeAuthenticatedRequest(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      const error = await this.parseApiError(response);
      throw error;
    }

    return response.json();
  }

  // Hämta prenumerationsanvändning
  async getSubscriptionUsage(): Promise<SubscriptionUsageResponse> {
    const response = await this.makeAuthenticatedRequest(`${this.baseUrl}/v1/usage/subscriptions`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      const error = await this.parseApiError(response);
      throw error;
    }

    return response.json();
  }

  // Analysera API-fel och returnera strukturerat fel
  private async parseApiError(response: Response): Promise<ApiError> {
    let errorData: any = {};
    
    try {
      const text = await response.text();
      errorData = JSON.parse(text);
    } catch {
      // Om JSON parsing misslyckas, använd bara status
    }

    let errorType: ApiError['type'] = 'unknown';
    let message = errorData.error?.message || errorData.message || `HTTP ${response.status}`;

    // Identifiera feltyp baserat på status och meddelande
    if (response.status === 429 || message.toLowerCase().includes('quota') || message.toLowerCase().includes('limit')) {
      errorType = 'quota_exceeded';
      message = 'Du har nått din API-kvot. Vänligen fyll på ditt konto för att fortsätta.';
    } else if (response.status === 401 || message.toLowerCase().includes('invalid') || message.toLowerCase().includes('unauthorized')) {
      errorType = 'invalid_api_key';
      message = 'API-nyckeln är ogiltig eller har gått ut. Vänligen logga in igen.';
    } else if (response.status >= 500) {
      errorType = 'server_error';
      message = 'Serverfel. Vänligen försök igen om ett ögonblick.';
    }

    return {
      message,
      type: errorType,
      code: errorData.error?.code || errorData.code
    };
  }

  // Uppdaterad felhantering för alla API-anrop
  private async handleApiResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      const error = await this.parseApiError(response);
      throw error;
    }
    return response.json();
  }

  // Transkribera ljudfil
  async transcribeAudio(audioBlob: Blob, retries: number = 2): Promise<TranscriptionResponse> {
    // Validate file upload
    const file = new File([audioBlob], 'audio.webm', { type: 'audio/webm' });
    const { securityService } = await import('../lib/security');
    const validation = securityService.validateFileUpload(file);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const formData = new FormData();
    formData.append('file', audioBlob, 'audio.webm');
    formData.append('language', 'sv');

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await this.makeAuthenticatedRequest(`${this.baseUrl}/v1/audio/transcriptions`, {
          method: 'POST',
          body: formData
        });

        return await this.handleApiResponse<TranscriptionResponse>(response);
      } catch (error: any) {
        console.log(`Transkribering försök ${attempt + 1}/${retries + 1} misslyckades:`, error.message);
        
        // If it's the last attempt or not a server error, throw
        if (attempt === retries || !error.message.includes('Serverfel')) {
          if (error.type === 'quota_exceeded') {
            throw new Error(`${error.message}\n\nGå till https://berget.ai för att fylla på ditt konto.`);
          }
          throw new Error(`Transkribering misslyckades: ${error.message}`);
        }
        
        // Wait before retry (exponential backoff)
        const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
        console.log(`Väntar ${delay}ms innan nästa försök...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  // OCR för dokument
  async processDocument(documentBlob: Blob): Promise<{ text: string }> {
    // Use security service for file validation
    const file = new File([documentBlob], 'document', { type: documentBlob.type });
    const { securityService } = await import('../lib/security');
    const validation = securityService.validateFileUpload(file);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    console.log(`Processar dokument: ${documentBlob.type}, storlek: ${(documentBlob.size / 1024).toFixed(1)}KB`);

    try {
      // Konvertera blob till base64
      const base64Data = await this.blobToBase64(documentBlob);
      const mimeType = documentBlob.type || 'application/octet-stream';
      const dataUrl = `data:${mimeType};base64,${base64Data}`;

      console.log('Skickar OCR-begäran...');

      // Använd alltid async processing
      const useAsync = true;

      const response = await this.makeAuthenticatedRequest(`${this.baseUrl}/v1/ocr`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'docling-v1',
          document: {
            url: dataUrl,
            type: 'document'
          },
          async: useAsync,
          options: {
            tableMode: 'fast', // Använd 'fast' istället för 'accurate' för bättre prestanda
            ocrMethod: 'easyocr',
            doOcr: true,
            doTableStructure: true,
            outputFormat: 'md',
            includeImages: false
          }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `OCR misslyckades: ${response.status}`;
        
        try {
          const errorObj = JSON.parse(errorText);
          errorMessage += ` - ${errorObj.error?.message || errorText}`;
        } catch {
          errorMessage += ` - ${errorText}`;
        }
        
        throw new Error(errorMessage);
      }

      const result = await response.json();

      if (useAsync) {
        // Hantera asynkron bearbetning
        return await this.pollForOCRResult(result.resultUrl);
      } else {
        return { text: result.content };
      }

    } catch (error: any) {
      console.error('OCR-fel:', error);
      
      // Ge mer specifika felmeddelanden
      if (error.message.includes('413')) {
        throw new Error('Filen är för stor för servern att bearbeta.');
      } else if (error.message.includes('timeout')) {
        throw new Error('Timeout vid bearbetning. Försök med en mindre fil.');
      } else if (error.message.includes('OCR_SERVICE_ERROR')) {
        throw new Error('OCR-tjänsten kunde inte bearbeta dokumentet. Kontrollera att filen inte är korrupt.');
      }
      
      throw error;
    }
  }

  // Polla för asynkrona OCR-resultat
  private async pollForOCRResult(resultUrl: string): Promise<{ text: string }> {
    const maxAttempts = 30; // Max 30 försök (ca 1 minut)
    let attempts = 0;

    while (attempts < maxAttempts) {
      try {
        const response = await fetch(resultUrl, {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
          }
        });

        if (response.status === 200) {
          const result = await response.json();
          return { text: result.content };
        } else if (response.status === 202) {
          // Fortfarande bearbetar
          const retryAfter = parseInt(response.headers.get('Retry-After') || '2');
          await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
          attempts++;
        } else {
          throw new Error(`Fel vid hämtning av resultat: ${response.status}`);
        }
      } catch (error) {
        attempts++;
        if (attempts >= maxAttempts) {
          throw new Error('Timeout vid väntan på OCR-resultat');
        }
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    throw new Error('Timeout vid väntan på OCR-resultat');
  }

  // Hjälpfunktion för att konvertera blob till base64
  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          // Ta bort "data:mime/type;base64," prefix
          const base64 = reader.result.split(',')[1];
          resolve(base64);
        } else {
          reject(new Error('Kunde inte konvertera fil till base64'));
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  // Summera och städa text till protokoll
  async summarizeToProtocol(text: string, customSystemPrompt?: string): Promise<SummaryResponse> {
    const currentDate = new Date().toLocaleDateString('sv-SE', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });

    const response = await this.makeAuthenticatedRequest(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [
          {
            role: 'system',
            content: customSystemPrompt || `Du är en professionell sekreterare som skapar strukturerade mötesprotokoll på svenska. 
            Omvandla den transkriberade texten till ett välorganiserat protokoll med följande struktur:
            
            # Protokoll
            **Datum:** ${currentDate}
            
            ## Sammanfattning
            [Kortfattad sammanfattning av mötet]
            
            ## Viktiga beslut
            [Lista viktiga beslut som fattades]
            
            ## Handlingspoäng
            [Lista åtgärder med ansvarig person om nämnt]
            
            ## Uppföljning
            [Vad som behöver följas upp]
            
            Använd markdown-formattering, professionell ton och korrigera språkfel från transkriberingen. 
            Fokusera på substans och viktiga punkter, inte småprat.`
          },
          {
            role: 'user',
            content: `Skapa ett strukturerat protokoll från denna transkribering:\n\n${text}`
          }
        ],
        temperature: 0.3,
        max_tokens: 2000
      })
    });

    try {
      const result = await this.handleApiResponse<any>(response);
      const summary = result.choices[0].message.content;

      // Extrahera handlingsområden ur svaret
      const actionItems = this.extractActionItems(summary);

      return {
        summary,
        action_items: actionItems
      };
    } catch (error: any) {
      if (error.type === 'quota_exceeded') {
        throw new Error(`${error.message}\n\nGå till https://berget.ai för att fylla på ditt konto.`);
      }
      throw new Error(`Summering misslyckades: ${error.message}`);
    }
  }

  // Generera text med AI
  async generateText(prompt: string): Promise<string> {
    const response = await this.makeAuthenticatedRequest(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 100
      })
    });

    if (!response.ok) {
      throw new Error('Text generering misslyckades');
    }

    const result = await response.json();
    return result.choices[0].message.content.trim();
  }

  // Städa och förbättra protokoll i realtid
  async cleanupProtocol(currentProtocol: string): Promise<string> {
    const response = await this.makeAuthenticatedRequest(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [
          {
            role: 'system',
            content: `Du städar och förbättrar live-protokoll från pågående möten. Din uppgift:

1. Rätta språkfel och stavfel
2. Förbättra meningsbyggnad utan att ändra betydelse
3. Ta bort upprepningar och fyllnadsord ("eh", "mm", etc.)
4. Behåll ALLA viktiga detaljer och beslut
5. Kombinera meningar som hör ihop
6. Om någon rättar sig ("nej vänta, det var..." etc) - använd den rättade versionen
7. Behåll kronologisk ordning
8. Svara bara med den förbättrade texten, inga extra kommentarer

Regler:
- Ändra ALDRIG faktainnehåll eller beslut
- Ta bort bara språkliga fel, inte innehåll
- Om text är otydlig, behåll den som den är`
          },
          {
            role: 'user',
            content: `Städa detta live-protokoll:\n\n${currentProtocol}`
          }
        ],
        temperature: 0.1,
        max_tokens: 1500
      })
    });

    if (!response.ok) {
      console.error('Protocol cleanup failed:', response.status);
      return currentProtocol; // Returnera original vid fel
    }

    const result = await response.json();
    return result.choices[0].message.content.trim();
  }

  // Chatta med AI om möten med tool support
  async chatWithMeetings(message: string, meetingContext?: string): Promise<string> {
    const systemPrompt = meetingContext 
      ? `Du är en AI-assistent som hjälper med att analysera och diskutera möten. Du har tillgång till följande möteskontext: "${meetingContext}". Svara på svenska och ge hjälpsamma och relevanta svar baserat på mötesinnehållet.

När användaren ber dig skapa ett protokoll, använd create_protocol verktyget.
När användaren frågar om andra möten, använd get_meeting_content verktyget för att hämta information.`
      : `Du är en AI-assistent som hjälper med mötesanalys och protokollhantering. Du kan svara på frågor om möten generellt, ge råd om bästa praxis för mötesstrukturer, protokollskrivning och uppföljning. Svara alltid på svenska.

När användaren ber dig skapa ett protokoll, använd create_protocol verktyget.
När användaren frågar om andra möten, använd get_meeting_content verktyget för att hämta information.`;

    const tools = [
      {
        type: "function",
        function: {
          name: "create_protocol",
          description: "Skapa ett mötesprotokoll baserat på mötesinnehåll",
          parameters: {
            type: "object",
            properties: {
              meeting_content: {
                type: "string",
                description: "Mötesinnehållet som ska omvandlas till protokoll"
              },
              title: {
                type: "string",
                description: "Titel för protokollet"
              },
              participants: {
                type: "array",
                items: { type: "string" },
                description: "Lista på deltagare"
              }
            },
            required: ["meeting_content", "title"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "get_meeting_content",
          description: "Hämta innehåll från andra möten",
          parameters: {
            type: "object",
            properties: {
              meeting_id: {
                type: "string",
                description: "ID för mötet som ska hämtas"
              },
              search_query: {
                type: "string",
                description: "Sökfråga för att hitta specifikt innehåll"
              }
            },
            required: ["search_query"]
          }
        }
      }
    ];

    const response = await this.makeAuthenticatedRequest(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: "mistralai/Magistral-Small-2506",
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: message
          }
        ],
        tools: tools,
        tool_choice: "auto",
        temperature: 0.7,
        max_tokens: 1000
      })
    });

    if (!response.ok) {
      throw new Error('Chat misslyckades');
    }

    const result = await response.json();
    const choice = result.choices[0];
    
    // Hantera tool calls
    if (choice.message.tool_calls) {
      let finalResponse = choice.message.content || '';
      
      for (const toolCall of choice.message.tool_calls) {
        const toolResult = await this.handleToolCall(toolCall, meetingContext);
        finalResponse += `\n\n${toolResult}`;
      }
      
      return finalResponse;
    }

    return choice.message.content?.trim() || '';
  }

  // Hantera tool calls
  private async handleToolCall(toolCall: any, meetingContext?: string): Promise<string> {
    const { name, arguments: args } = toolCall.function;
    
    switch (name) {
      case 'create_protocol':
        const parsedArgs = JSON.parse(args);
        const protocol = await this.summarizeToProtocol(
          parsedArgs.meeting_content || meetingContext || '',
          `Skapa ett professionellt mötesprotokoll med titeln "${parsedArgs.title}" och deltagarna: ${parsedArgs.participants?.join(', ') || 'Okänt'}`
        );
        return `**Protokoll skapat:**\n\n${protocol.summary}`;
        
      case 'get_meeting_content':
        const searchArgs = JSON.parse(args);
        // Här skulle vi normalt hämta från en databas, men för nu returnerar vi mock data
        return `**Mötesinnehåll hittat:**\n\nTyvärr kan jag inte hämta andra möten ännu - denna funktionalitet kommer att implementeras när vi har en databas för att lagra möten.`;
        
      default:
        return `Okänt verktyg: ${name}`;
    }
  }

  // Analysera pågående möte för att identifiera typ och deltagare
  async analyzeMeeting(transcriptionText: string): Promise<MeetingAnalysisResponse> {
    const response = await this.makeAuthenticatedRequest(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [
          {
            role: 'system',
            content: `Analysera denna mötestext och ge en JSON-respons med följande struktur:
            {
              "purpose": "kort beskrivning av mötets syfte",
              "suggestedTitle": "förslag på mötestitel (max 50 tecken)",
              "participants": ["lista på identifierade deltagare"],
              "estimatedParticipants": antal_personer_som_pratar,
              "suggestedTemplate": "typ av möte (standup/review/planning/general)",
              "actionPoints": ["lista på identifierade handlingspunkter"],
              "confidence": 0.8
            }
            
            Basera analysen på vad som faktiskt sägs i mötet. Om information saknas, använd "Okänt" eller tomma arrayer.`
          },
          {
            role: 'user',
            content: `Analysera detta möte: ${transcriptionText}`
          }
        ],
        temperature: 0.3,
        max_tokens: 1000
      })
    });

    if (!response.ok) {
      throw new Error('Mötesanalys misslyckades');
    }

    const result = await response.json();
    const content = result.choices[0].message.content;
    
    try {
      // Försök extrahera JSON från svaret
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.error('Kunde inte parsa mötesanalys JSON:', e);
    }

    // Fallback om JSON-parsing misslyckas
    return {
      purpose: "Kunde inte analysera mötets syfte",
      suggestedTitle: "Möte",
      participants: [],
      estimatedParticipants: 1,
      suggestedTemplate: "general",
      actionPoints: [],
      confidence: 0.1
    };
  }

  private extractActionItems(text: string): string[] {
    const actionRegex = /(?:handlingspoint|åtgärd|uppgift|todo).*?(?=\n|$)/gi;
    const matches = text.match(actionRegex) || [];
    return matches.map(match => match.trim());
  }
}

export const bergetApi = new BergetApiService();