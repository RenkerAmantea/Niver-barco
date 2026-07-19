import { createRoot } from 'react-dom/client';

import App from './App';

import './index.css';

if ('serviceWorker' in navigator) window.addEventListener('load', () => void navigator.serviceWorker.register('/sw.js').then((registration) => {
  let refreshed = false;
  const announceUpdate = () => window.dispatchEvent(new CustomEvent('niver:pwa-update-ready', { detail: registration }));
  const activateUpdate = () => registration.waiting?.postMessage({ type: 'SKIP_WAITING' });

  void registration.update();
  if (registration.waiting) announceUpdate();
  registration.addEventListener('updatefound', () => registration.installing?.addEventListener('statechange', () => {
    if (registration.installing?.state !== 'installed' || !navigator.serviceWorker.controller) return;
    announceUpdate();
    // A atualização continua automática na maior parte dos casos. O botão é a
    // rede de segurança para navegadores que seguram a nova versão em espera.
    if (!document.activeElement?.matches('input, textarea, [contenteditable="true"]')) activateUpdate();
  }));
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!refreshed) {
      refreshed = true;
      window.location.reload();
    }
  });
  window.addEventListener('focus', () => void registration.update());
}));

createRoot(document.getElementById('root')!).render(<App />);
