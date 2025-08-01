# 🎙️ Möteskollen - Säker AI-driven Möteshantering

> **Ett open source-projekt som visar möjligheterna med Berget AI:s API för säker, lokal datahantering**

Möteskollen är en modern webbapplikation som kombinerar realtids-transkribering med AI-driven protokollgenerering - allt medan din data förblir säker och lokal. Projektet demonstrerar hur man kan bygga kraftfulla AI-applikationer utan att kompromissa med datasäkerhet.

## ✨ Vad gör detta projekt unikt?

### 🔒 **Säkerhet i fokus**
- **100% GDPR-kompatibel** - All data bearbetas inom Sverige/EU
- **Lokal datalagring** - Möten och protokoll sparas endast i din webbläsare
- **Minimal molnexponering** - Ljudfiler skickas till Berget AI endast för transkribering och raderas automatiskt
- **Kryptering** - Säker överföring och lokal kryptering av känslig data

### 🚀 **Avancerad teknik**
- **Hybrid transkribering** - Kombinerar Web Speech API med Berget AI för optimal noggrannhet
- **Realtids-protokoll** - Live-transkribering med automatisk protokollgenerering
- **AI-assistent** - Chatta om dina möten med kontextmedveten AI
- **Neumorphic design** - Modern, tillgänglig användargränssnitt

### 🛠️ **Teknisk stack**
- **Frontend**: React 18 + TypeScript + Vite
- **UI**: Tailwind CSS + shadcn/ui komponenter
- **AI**: Berget AI API för transkribering och textgenerering
- **Säkerhet**: DOMPurify, säker tokenhantering, CSP headers
- **Audio**: Web Audio API + MediaRecorder för ljudbearbetning

## 🎯 Varför detta projekt?

Detta projekt visar hur man kan:

1. **Integrera AI-tjänster säkert** - Använd kraftfulla AI-API:er utan att lagra känslig data i molnet
2. **Bygga hybrid lösningar** - Kombinera lokala webbläsar-API:er med externa AI-tjänster
3. **Implementera säkerhet från grunden** - GDPR-kompatibilitet och datasäkerhet som första prioritet
4. **Skapa moderna användargränssnitt** - Responsiv design med avancerade interaktioner

## 🚀 Kom igång

### Förutsättningar
- Node.js 18+ 
- En Berget AI API-nyckel ([skaffa här](https://berget.ai))

### Installation

```bash
# Klona projektet
git clone <YOUR_GIT_URL>
cd <YOUR_PROJECT_NAME>

# Installera beroenden
npm install

# Starta utvecklingsservern
npm run dev
```

Öppna [http://localhost:5173](http://localhost:5173) och börja utforska!

## 🏗️ Arkitektur & Säkerhet

### Dataflöde
```
📱 Webbläsare (lokal lagring)
    ↓ Säker HTTPS
🇸🇪 Berget AI (Sverige)
    ↓ Transkribering
📱 Tillbaka till lokal lagring
```

### Säkerhetsimplementering
- **Tokenhantering**: Säker lagring med kryptering i localStorage
- **Input-sanitering**: DOMPurify för alla användarinmatningar
- **CSP headers**: Skydd mot XSS-attacker
- **Rate limiting**: Begränsning av API-anrop
- **Session management**: Automatisk utloggning vid inaktivitet

## 🔧 Utforska koden

### Kärnkomponenter

#### `src/services/bergetApi.ts`
Huvudintegration med Berget AI API:
- Säker autentisering med device flow
- Automatisk token-förnyelse
- Felhantering och retry-logik
- Transkribering och AI-textgenerering

#### `src/hooks/useHybridTranscription.ts`
Avancerad ljudbearbetning:
- Kombinerar Web Speech API med Berget AI
- Realtids-segmentering av ljud
- Automatisk protokollstädning
- Ljudnivå-visualisering

#### `src/lib/security.ts`
Säkerhetsramverk:
- Input-sanitering och validering
- Säker tokenhantering
- Session management
- GDPR-kompatibel datahantering

#### `src/components/TranscriptionApp.tsx`
Huvudapplikation:
- Live-transkribering med caption-overlay
- Protokollgenerering i realtid
- Möteshantering och historik
- AI-chat integration

### Intressanta tekniska lösningar

#### 1. **Hybrid transkribering**
```typescript
// Kombinerar lokal Speech API med Berget AI
const { segments } = useHybridTranscription(handleBergetTranscription);
```

#### 2. **Säker API-integration**
```typescript
// Automatisk token-förnyelse med säker lagring
await this.makeAuthenticatedRequest(url, options);
```

#### 3. **Realtids-protokoll**
```typescript
// Live-städning av protokoll under inspelning
const cleanedProtocol = await bergetApi.cleanupProtocol(currentProtocol);
```

## 🎨 Design & UX

Projektet implementerar en modern "neumorphic" designfilosofi:
- **Minimalistisk färgpalett** - Fokus på innehåll, inte distraktioner
- **Mjuka skuggor** - Neumorphic effekter för djup och taktilitet  
- **Responsiv design** - Fungerar perfekt på alla enheter
- **Tillgänglighet** - WCAG-kompatibel med tangentbordsnavigation

## 🔮 Utbyggnadsmöjligheter

Detta projekt är designat för att vara utbyggbart:

### 🎯 **AI & Machine Learning**
- Implementera speaker diarization (vem säger vad)
- Automatisk mötesklassificering
- Sentiment-analys av diskussioner
- Prediktiv textgenerering

### 📊 **Analytics & Insights**
- Mötesstatistik och trender
- Handlingspoäng-uppföljning
- Team-produktivitetsanalys
- Export till projekthanteringsverktyg

### 🔗 **Integrationer**
- Kalendersynkronisering (Google Calendar, Outlook)
- Slack/Teams-integration
- CRM-kopplingar
- Webhook-stöd för externa system

### 🏢 **Enterprise-funktioner**
- Multi-tenant arkitektur
- SSO-integration (SAML, OAuth)
- Audit logs och compliance
- Bulk-operationer och API

## 🤝 Bidra till projektet

Vi välkomnar bidrag! Här är några områden där du kan hjälpa till:

### 🐛 **Bugfixar & förbättringar**
- Förbättra ljudkvalitet och transkriberingsnoggrannhet
- Optimera prestanda för långa möten
- Förbättra felhantering och användarfeedback

### ✨ **Nya funktioner**
- Implementera offline-stöd med Service Workers
- Lägg till stöd för fler språk
- Bygg mobilapp med Capacitor
- Skapa desktop-app med Tauri

### 📚 **Dokumentation**
- API-dokumentation för utvecklare
- Användarguider och tutorials
- Arkitekturdokumentation
- Säkerhetsanalys och penetrationstester

## 📄 Licens

MIT License - Se [LICENSE](LICENSE) för detaljer.

## 🙏 Erkännanden

- **Berget AI** - För det fantastiska svenska AI-API:et
- **shadcn/ui** - För de vackra UI-komponenterna  
- **Tailwind CSS** - För det flexibla designsystemet
- **React-communityn** - För inspiration och verktyg

---

**Byggt med ❤️ i Sverige för en säkrare AI-framtid**

> *"Kraftfull AI behöver inte kompromissa med integritet"*

## 🛠️ Utveckling & Deploy

### Lokalt utveckling
```bash
npm run dev          # Starta utvecklingsserver
npm run build        # Bygg för produktion
npm run preview      # Förhandsgranska produktionsbygge
npm run lint         # Kör linting
```

### Deploy med Lovable
Detta projekt är byggt med [Lovable](https://lovable.dev) och kan enkelt deployas:

1. Öppna [Lovable Project](https://lovable.dev/projects/a4050037-f32b-465a-9f1a-eb19276ecfa1)
2. Klicka på Share → Publish
3. Din app är live!

### Anpassad domän
För att koppla en egen domän:
1. Gå till Project > Settings > Domains i Lovable
2. Klicka Connect Domain
3. Följ instruktionerna för DNS-konfiguration

Läs mer: [Setting up a custom domain](https://docs.lovable.dev/tips-tricks/custom-domain#step-by-step-guide)
