import { createRoot } from 'react-dom/client';

import App from './App';

import './index.css';

if ('serviceWorker' in navigator) window.addEventListener('load', () => void navigator.serviceWorker.register('/sw.js').then((registration) => {
  void registration.update();
  registration.addEventListener('updatefound', () => registration.installing?.addEventListener('statechange', () => {
    if (registration.installing?.state === 'installed' && navigator.serviceWorker.controller && !document.activeElement?.matches('input, textarea, [contenteditable="true"]')) registration.waiting?.postMessage({ type: 'SKIP_WAITING' });
  }));
  navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload());
}));

createRoot(document.getElementById('root')!).render(<App />);
