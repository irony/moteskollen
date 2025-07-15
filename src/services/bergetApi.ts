interface BergetAuthResponse {
  access_token: string;
  expires_in: number;
  refresh_token: string;
  token_type: string;
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

class BergetApiService {
  private baseUrl = 'https://api.berget.ai';
  private apiKey: string | null = null;

  constructor() {
    this.apiKey = localStorage.getItem('berget_api_key');
  }

  // Device Token Flow för att skapa konto/logga in
  async initiateDeviceAuth(): Promise<{ device_code: string; user_code: string; verification_uri: string }> {
    const response = await fetch(`${this.baseUrl}/auth/device`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: 'protokoll-klippare',
        scope: 'api transcription'
      })
    });

    if (!response.ok) {
      throw new Error('Kunde inte initiera enhetsautentisering');
    }

    return response.json();
  }

  // Hämta access token med device code
  async getAccessToken(deviceCode: string): Promise<BergetAuthResponse> {
    const response = await fetch(`${this.baseUrl}/auth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
        device_code: deviceCode,
        client_id: 'protokoll-klippare'
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Kunde inte hämta access token');
    }

    const tokenData = await response.json();
    this.setApiKey(tokenData.access_token);
    return tokenData;
  }

  setApiKey(key: string) {
    this.apiKey = key;
    localStorage.setItem('berget_api_key', key);
  }

  getApiKey(): string | null {
    return this.apiKey;
  }

  clearApiKey() {
    this.apiKey = null;
    localStorage.removeItem('berget_api_key');
  }

  // Transkribera ljudfil
  async transcribeAudio(audioBlob: Blob): Promise<TranscriptionResponse> {
    if (!this.apiKey) {
      throw new Error('API-nyckel saknas');
    }

    const formData = new FormData();
    formData.append('file', audioBlob, 'audio.webm');
    formData.append('language', 'sv');

    const response = await fetch(`${this.baseUrl}/v1/audio/transcriptions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: formData
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Transkribering misslyckades: ${response.status} - ${errorText}`);
    }

    return response.json();
  }

  // OCR för dokument
  async processDocument(documentBlob: Blob): Promise<{ text: string }> {
    if (!this.apiKey) {
      throw new Error('API-nyckel saknas');
    }

    // Kontrollera filstorlek (max 10MB)
    if (documentBlob.size > 10 * 1024 * 1024) {
      throw new Error('Filen är för stor. Max storlek är 10MB.');
    }

    // Kontrollera filtyp
    const supportedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'text/plain',
      'image/jpeg',
      'image/png',
      'image/jpg'
    ];
    
    if (!supportedTypes.includes(documentBlob.type)) {
      throw new Error(`Filtyp ${documentBlob.type} stöds inte. Använd PDF, DOC, DOCX, TXT, JPG eller PNG.`);
    }

    console.log(`Processar dokument: ${documentBlob.type}, storlek: ${(documentBlob.size / 1024).toFixed(1)}KB`);

    try {
      // Konvertera blob till base64
      const base64Data = await this.blobToBase64(documentBlob);
      const mimeType = documentBlob.type || 'application/octet-stream';
      const dataUrl = `data:${mimeType};base64,${base64Data}`;

      console.log('Skickar OCR-begäran...');

      // Försök med async processing för större filer
      const useAsync = documentBlob.size > 1024 * 1024; // 1MB

      const response = await fetch(`${this.baseUrl}/v1/ocr`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
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
    if (!this.apiKey) {
      throw new Error('API-nyckel saknas');
    }

    const currentDate = new Date().toLocaleDateString('sv-SE', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });

    const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
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

    if (!response.ok) {
      throw new Error('Summering misslyckades');
    }

    const result = await response.json();
    const summary = result.choices[0].message.content;

    // Extrahera handlingsområden ur svaret
    const actionItems = this.extractActionItems(summary);

    return {
      summary,
      action_items: actionItems
    };
  }

  // Generera text med AI
  async generateText(prompt: string): Promise<string> {
    if (!this.apiKey) {
      throw new Error('API-nyckel saknas');
    }

    const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
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

  // Chatta med AI om möten med tool support
  async chatWithMeetings(message: string, meetingContext?: string): Promise<string> {
    if (!this.apiKey) {
      throw new Error('API-nyckel saknas');
    }

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

    const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
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
    if (!this.apiKey) {
      throw new Error('API-nyckel saknas');
    }

    const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
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