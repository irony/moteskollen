import DOMPurify from 'dompurify';

// Session timeout in milliseconds (30 minutes)
const SESSION_TIMEOUT = 30 * 60 * 1000;

// Token encryption key (in production, this should be environment-specific)
const ENCRYPTION_KEY = 'protokoll-klippare-encryption-key-2025';

interface SecureTokenData {
  token: string;
  timestamp: number;
  encrypted: boolean;
}

export class SecurityService {
  private static instance: SecurityService;
  private sessionTimer: NodeJS.Timeout | null = null;
  private lastActivity: number = Date.now();

  static getInstance(): SecurityService {
    if (!SecurityService.instance) {
      SecurityService.instance = new SecurityService();
    }
    return SecurityService.instance;
  }

  private constructor() {
    this.startSessionMonitoring();
  }

  // Input sanitization
  sanitizeInput(input: string): string {
    return DOMPurify.sanitize(input, { 
      ALLOWED_TAGS: [],
      ALLOWED_ATTR: [],
      KEEP_CONTENT: true 
    });
  }

  sanitizeHtml(html: string): string {
    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'code', 'pre'],
      ALLOWED_ATTR: ['class'],
      FORBID_TAGS: ['script', 'object', 'embed', 'iframe', 'form', 'input', 'button'],
      FORBID_ATTR: ['onclick', 'onload', 'onerror', 'onmouseover', 'onfocus', 'onblur']
    });
  }

  // Simple encryption for localStorage (not cryptographically secure but better than plain text)
  private encrypt(text: string): string {
    try {
      const encoded = btoa(text);
      return btoa(encoded + ENCRYPTION_KEY);
    } catch {
      return text; // Fallback to plain text if encryption fails
    }
  }

  private decrypt(encryptedText: string): string {
    try {
      const decoded = atob(encryptedText);
      const textWithKey = decoded.replace(ENCRYPTION_KEY, '');
      return atob(textWithKey);
    } catch {
      return encryptedText; // Fallback if decryption fails
    }
  }

  // Secure token storage
  setSecureToken(key: string, token: string): void {
    const tokenData: SecureTokenData = {
      token: this.encrypt(token),
      timestamp: Date.now(),
      encrypted: true
    };
    
    try {
      localStorage.setItem(key, JSON.stringify(tokenData));
      this.updateActivity();
    } catch (error) {
      console.error('Failed to store token securely:', error);
      // Fallback to regular storage (still better than nothing)
      localStorage.setItem(key, token);
    }
  }

  getSecureToken(key: string): string | null {
    try {
      const stored = localStorage.getItem(key);
      if (!stored) return null;

      // Try to parse as secure token data
      try {
        const tokenData: SecureTokenData = JSON.parse(stored);
        
        // Check if token has expired (24 hours)
        if (Date.now() - tokenData.timestamp > 24 * 60 * 60 * 1000) {
          this.removeSecureToken(key);
          return null;
        }

        if (tokenData.encrypted) {
          return this.decrypt(tokenData.token);
        } else {
          return tokenData.token;
        }
      } catch {
        // If parsing fails, treat as plain text (legacy support)
        return stored;
      }
    } catch (error) {
      console.error('Failed to retrieve token:', error);
      return null;
    }
  }

  removeSecureToken(key: string): void {
    localStorage.removeItem(key);
  }

  // Session management
  private startSessionMonitoring(): void {
    this.resetSessionTimer();
    
    // Listen for user activity
    const activityEvents = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    activityEvents.forEach(event => {
      document.addEventListener(event, () => this.updateActivity(), { passive: true });
    });
  }

  private updateActivity(): void {
    this.lastActivity = Date.now();
    this.resetSessionTimer();
  }

  private resetSessionTimer(): void {
    if (this.sessionTimer) {
      clearTimeout(this.sessionTimer);
    }
    
    this.sessionTimer = setTimeout(() => {
      this.handleSessionTimeout();
    }, SESSION_TIMEOUT);
  }

  private handleSessionTimeout(): void {
    // Clear all authentication data
    this.clearAllAuthData();
    
    // Notify user about session timeout
    if (window.location.pathname !== '/') {
      alert('Din session har gått ut av säkerhetsskäl. Du kommer att omdirigeras till inloggningssidan.');
      window.location.reload();
    }
  }

  clearAllAuthData(): void {
    const authKeys = ['berget_api_key', 'berget_token', 'berget_refresh_token'];
    authKeys.forEach(key => this.removeSecureToken(key));
  }

  // Error handling
  createSafeErrorMessage(error: any): string {
    // Don't expose sensitive information in error messages
    if (typeof error === 'string') {
      return this.sanitizeInput(error);
    }
    
    if (error?.message) {
      const message = error.message.toLowerCase();
      
      // Replace sensitive errors with generic messages
      if (message.includes('unauthorized') || message.includes('403') || message.includes('401')) {
        return 'Autentiseringsfel. Vänligen logga in igen.';
      }
      
      if (message.includes('network') || message.includes('fetch')) {
        return 'Nätverksfel. Kontrollera din internetanslutning.';
      }
      
      if (message.includes('token') || message.includes('api')) {
        return 'API-fel. Försök igen senare.';
      }
      
      return this.sanitizeInput(error.message);
    }
    
    return 'Ett oväntat fel inträffade. Försök igen senare.';
  }

  // Validate file uploads
  validateFileUpload(file: File): { valid: boolean; error?: string } {
    const maxSize = 100 * 1024 * 1024; // 100MB
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'text/plain',
      'image/jpeg',
      'image/png',
      'image/jpg',
      'audio/webm',
      'audio/wav',
      'audio/mp3',
      'audio/mp4',
      'audio/mpeg'
    ];

    if (file.size > maxSize) {
      return { valid: false, error: 'Filen är för stor. Maximal storlek är 100MB.' };
    }

    if (!allowedTypes.includes(file.type)) {
      return { valid: false, error: 'Filtypen stöds inte.' };
    }

    // Check for suspicious file names
    const suspiciousPatterns = ['.exe', '.bat', '.cmd', '.scr', '.js', '.vbs'];
    const fileName = file.name.toLowerCase();
    
    if (suspiciousPatterns.some(pattern => fileName.includes(pattern))) {
      return { valid: false, error: 'Filnamnet innehåller otillåtna tecken.' };
    }

    return { valid: true };
  }

  // Content Security Policy helpers
  static addSecurityHeaders(): void {
    // Add CSP meta tag if it doesn't exist
    if (!document.querySelector('meta[http-equiv="Content-Security-Policy"]')) {
      const meta = document.createElement('meta');
      meta.httpEquiv = 'Content-Security-Policy';
      meta.content = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://api.berget.ai; frame-src 'none'; object-src 'none';";
      document.head.appendChild(meta);
    }

    // Add other security headers
    const securityHeaders = [
      { name: 'X-Frame-Options', content: 'DENY' },
      { name: 'X-Content-Type-Options', content: 'nosniff' },
      { name: 'Referrer-Policy', content: 'strict-origin-when-cross-origin' },
      { name: 'Permissions-Policy', content: 'camera=(), microphone=(), geolocation=()' }
    ];

    securityHeaders.forEach(header => {
      const existingMeta = document.querySelector(`meta[http-equiv="${header.name}"]`);
      if (!existingMeta) {
        const meta = document.createElement('meta');
        meta.httpEquiv = header.name;
        meta.content = header.content;
        document.head.appendChild(meta);
      }
    });
  }

  // Rate limiting for API calls
  private apiCallTimestamps: Map<string, number[]> = new Map();

  checkRateLimit(endpoint: string, maxCalls: number = 10, timeWindowMs: number = 60000): boolean {
    const now = Date.now();
    const calls = this.apiCallTimestamps.get(endpoint) || [];
    
    // Remove old calls outside the time window
    const recentCalls = calls.filter(timestamp => now - timestamp < timeWindowMs);
    
    if (recentCalls.length >= maxCalls) {
      return false; // Rate limit exceeded
    }
    
    // Add current call
    recentCalls.push(now);
    this.apiCallTimestamps.set(endpoint, recentCalls);
    
    return true;
  }
}

export const securityService = SecurityService.getInstance();
