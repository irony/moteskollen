import { createRoot } from 'react-dom/client'
import '@fontsource/inter/400.css'
import '@fontsource/inter/600.css'
import App from './App.tsx'
import './index.css'
import { SecurityService } from '@/lib/security'

// Initialize CSP header (other security headers must be set by server)
SecurityService.addSecurityHeaders();

createRoot(document.getElementById("root")!).render(<App />);
