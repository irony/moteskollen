import { describe, it, expect, beforeEach } from 'vitest';
import { securityService } from '../lib/security';

describe('SecurityService', () => {
  beforeEach(() => {
    // Rensa localStorage före varje test
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe('Input Sanitization', () => {
    it('ska rensa bort skadlig HTML', () => {
      const maliciousInput = '<script>alert("xss")</script>Hello';
      const sanitized = securityService.sanitizeInput(maliciousInput);
      
      expect(sanitized).toBe('Hello');
      expect(sanitized).not.toContain('<script>');
    });

    it('ska behålla säker text', () => {
      const safeInput = 'Detta är säker text 123';
      const sanitized = securityService.sanitizeInput(safeInput);
      
      expect(sanitized).toBe(safeInput);
    });
  });

  describe('Token Management', () => {
    it('ska kunna spara och hämta tokens säkert', () => {
      const testToken = 'test-token-123';
      
      // Mock localStorage för detta test
      const mockGetItem = vi.fn();
      const mockSetItem = vi.fn();
      
      Object.defineProperty(window, 'localStorage', {
        value: {
          getItem: mockGetItem,
          setItem: mockSetItem,
          removeItem: vi.fn(),
          clear: vi.fn(),
        },
        writable: true,
      });
      
      // Simulera att token sparas och hämtas
      mockSetItem.mockImplementation((key, value) => {
        if (key === 'test_key') {
          const tokenData = JSON.parse(value);
          mockGetItem.mockReturnValue(value);
        }
      });
      
      securityService.setSecureToken('test_key', testToken);
      const retrieved = securityService.getSecureToken('test_key');
      
      expect(retrieved).toBe(testToken);
    });

    it('ska returnera null för icke-existerande tokens', () => {
      const retrieved = securityService.getSecureToken('non_existent_key');
      
      expect(retrieved).toBeNull();
    });

    it('ska kunna ta bort tokens', () => {
      securityService.setSecureToken('test_key', 'test-token');
      securityService.removeSecureToken('test_key');
      
      const retrieved = securityService.getSecureToken('test_key');
      expect(retrieved).toBeNull();
    });
  });

  describe('File Validation', () => {
    it('ska acceptera giltiga filtyper', () => {
      const validFile = new File(['test'], 'test.pdf', { type: 'application/pdf' });
      const result = securityService.validateFileUpload(validFile);
      
      expect(result.valid).toBe(true);
    });

    it('ska avvisa för stora filer', () => {
      const largeFile = new File([new ArrayBuffer(200 * 1024 * 1024)], 'large.pdf', { 
        type: 'application/pdf' 
      });
      const result = securityService.validateFileUpload(largeFile);
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('för stor');
    });

    it('ska avvisa ogiltiga filtyper', () => {
      const invalidFile = new File(['test'], 'test.exe', { type: 'application/x-executable' });
      const result = securityService.validateFileUpload(invalidFile);
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('stöds inte');
    });
  });

  describe('Error Messages', () => {
    it('ska skapa säkra felmeddelanden', () => {
      const sensitiveError = new Error('Database connection failed: password=secret123');
      const safeMessage = securityService.createSafeErrorMessage(sensitiveError);
      
      expect(safeMessage).not.toContain('password=secret123');
      expect(safeMessage).toContain('fel');
    });
  });
});
