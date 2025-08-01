import { vi } from 'vitest'

// Mock Web APIs som inte finns i jsdom
Object.defineProperty(window, 'MediaRecorder', {
  writable: true,
  value: vi.fn().mockImplementation(() => ({
    start: vi.fn(),
    stop: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    ondataavailable: null,
    onstop: null,
    state: 'inactive',
  })),
})

Object.defineProperty(navigator, 'mediaDevices', {
  writable: true,
  value: {
    getUserMedia: vi.fn().mockResolvedValue({
      getTracks: () => [{ stop: vi.fn() }],
    }),
  },
})

Object.defineProperty(window, 'AudioContext', {
  writable: true,
  value: vi.fn().mockImplementation(() => ({
    createMediaStreamSource: vi.fn().mockReturnValue({
      connect: vi.fn(),
    }),
    createAnalyser: vi.fn().mockReturnValue({
      fftSize: 256,
      frequencyBinCount: 128,
      getByteFrequencyData: vi.fn(),
    }),
    close: vi.fn(),
  })),
})

// Mock Speech Recognition
Object.defineProperty(window, 'webkitSpeechRecognition', {
  writable: true,
  value: vi.fn().mockImplementation(() => ({
    continuous: true,
    interimResults: true,
    lang: 'sv-SE',
    maxAlternatives: 1,
    start: vi.fn(),
    stop: vi.fn(),
    onresult: null,
    onerror: null,
  })),
})

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(() => null),
  setItem: vi.fn(() => null),
  removeItem: vi.fn(() => null),
  clear: vi.fn(() => null),
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true,
})

// Exportera för användning i tester
export { localStorageMock };

// Mock fetch globalt för alla tester
global.fetch = vi.fn()
