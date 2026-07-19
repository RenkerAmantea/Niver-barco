import { useEffect, useState } from 'react';
import { Download, RefreshCw, X } from 'lucide-react';
import { Button } from './ui/button';

type DeferredInstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };

declare global {
  interface Window { __niverInstallPrompt?: DeferredInstallPrompt }
}

function isInstalled() {
  return window.matchMedia('(display-mode: standalone)').matches || (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function PwaControls() {
  const [installed, setInstalled] = useState(true);
  const [installPrompt, setInstallPrompt] = useState<DeferredInstallPrompt | undefined>();
  const [updateReady, setUpdateReady] = useState<ServiceWorkerRegistration | undefined>();
  const [showInstallHelp, setShowInstallHelp] = useState(false);

  useEffect(() => {
    const syncInstalled = () => setInstalled(isInstalled());
    const capturePrompt = (event: Event) => {
      event.preventDefault();
      const prompt = event as DeferredInstallPrompt;
      window.__niverInstallPrompt = prompt;
      setInstallPrompt(prompt);
    };
    const updateAvailable = (event: Event) => setUpdateReady((event as CustomEvent<ServiceWorkerRegistration>).detail);
    syncInstalled();
    setInstallPrompt(window.__niverInstallPrompt);
    window.addEventListener('beforeinstallprompt', capturePrompt);
    window.addEventListener('appinstalled', syncInstalled);
    window.addEventListener('niver:pwa-update-ready', updateAvailable);
    return () => {
      window.removeEventListener('beforeinstallprompt', capturePrompt);
      window.removeEventListener('appinstalled', syncInstalled);
      window.removeEventListener('niver:pwa-update-ready', updateAvailable);
    };
  }, []);

  if (installed && !updateReady) return null;

  const install = async () => {
    if (!installPrompt) return setShowInstallHelp(true);
    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') setInstalled(true);
    setInstallPrompt(undefined);
    window.__niverInstallPrompt = undefined;
  };

  const update = () => updateReady?.waiting?.postMessage({ type: 'SKIP_WAITING' });

  return <div className="pwa-controls fixed inset-x-4 z-[60] mx-auto w-fit max-w-[calc(100vw-2rem)]" aria-live="polite">
    <div className="flex items-center gap-2 rounded-2xl border border-[#f9d98a]/22 bg-[#0a0c1d]/90 p-2 shadow-[0_16px_42px_rgba(0,0,0,.38)] backdrop-blur-2xl">
      {updateReady ? <>
        <Button onClick={update} className="h-9 rounded-xl bg-[#f6cc6b] px-3 font-semibold text-[#171222] hover:bg-[#ffe5a3]"><RefreshCw className="mr-1.5 h-3.5 w-3.5" />Atualizar app</Button>
        <button onClick={() => setUpdateReady(undefined)} className="grid h-8 w-8 place-items-center rounded-lg text-white/55 transition hover:bg-white/10 hover:text-white" aria-label="Fechar aviso de atualização"><X className="h-4 w-4" /></button>
      </> : <>
        <Button onClick={install} variant="outline" className="h-9 rounded-xl border-[#f9d98a]/30 bg-[#f6cc6b]/10 px-3 text-[#ffe4a0] hover:bg-[#f6cc6b]/18 hover:text-[#fff0c8]"><Download className="mr-1.5 h-3.5 w-3.5" />Instalar app</Button>
        <button onClick={() => setShowInstallHelp(!showInstallHelp)} className="grid h-8 w-8 place-items-center rounded-lg text-white/55 transition hover:bg-white/10 hover:text-white" aria-label="Como instalar"><span className="font-display text-sm">?</span></button>
      </>}
    </div>
    {showInstallHelp && !updateReady && <div className="mt-2 max-w-xs rounded-2xl border border-white/10 bg-[#0a0c1d]/95 px-4 py-3 text-xs leading-relaxed text-white/75 shadow-xl backdrop-blur-2xl">
      No iPhone: toque em <strong className="text-[#fff0c8]">Compartilhar</strong> e depois em <strong className="text-[#fff0c8]">Adicionar à Tela de Início</strong>. Em outros celulares, procure “Instalar app” no menu do navegador.
    </div>}
  </div>;
}
