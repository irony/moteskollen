import { createRoot } from 'react-dom/client'
import '@fontsource/inter/300.css'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'
import App from './App.tsx'
import './index.css'
import { SecurityService } from '@/lib/security'

// Initialize security headers
SecurityService.addSecurityHeaders();

createRoot(document.getElementById("root")!).render(<App />);
