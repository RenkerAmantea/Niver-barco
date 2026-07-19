import { createRoot } from 'react-dom/client';

import App from './App';

import './index.css';

if ('serviceWorker' in navigator) window.addEventListener('load', () => void navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).then((registration) => {
  let refreshed = false;
  const announceUpdate = () => window.dispatchEvent(new CustomEvent('niver:pwa-update-ready', { detail: registration }));
  const activateUpdate = () => registration.waiting?.postMessage({ type: 'SKIP_WAITING' });

  const checkForUpdate = () => void registration.update();
  checkForUpdate();
  // Alguns launchers mantêm o PWA aberto por muito tempo. Revalidar evita que
  // uma pessoa fique numa versão antiga só porque não fechou o aplicativo.
  const updateTimer = window.setInterval(checkForUpdate, 60_000);
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
  window.addEventListener('focus', checkForUpdate);
  window.addEventListener('beforeunload', () => window.clearInterval(updateTimer), { once: true });
}));

createRoot(document.getElementById('root')!).render(<App />);
