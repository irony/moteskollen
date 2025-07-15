import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { SecurityService } from '@/lib/security'

// Initialize security headers
SecurityService.addSecurityHeaders();

createRoot(document.getElementById("root")!).render(<App />);
