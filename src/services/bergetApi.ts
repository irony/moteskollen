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

  // Summera och städa text till protokoll
  async summarizeToProtocol(text: string): Promise<SummaryResponse> {
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
            content: `Du är en professionell sekreterare som skapar strukturerade mötesprotokoll på svenska. 
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

  private extractActionItems(text: string): string[] {
    const actionRegex = /(?:handlingspoint|åtgärd|uppgift|todo).*?(?=\n|$)/gi;
    const matches = text.match(actionRegex) || [];
    return matches.map(match => match.trim());
  }
}

export const bergetApi = new BergetApiService();