import { Compass, ExternalLink, PlusSquare, Share, X } from 'lucide-react';

export function isAppleMobileBrowser() {
  if (typeof window === 'undefined') return false;
  const ua = window.navigator.userAgent;
  return /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function isStandaloneApp() {
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

type Props = { open: boolean; onClose: () => void };

export function IosInstallModal({ open, onClose }: Props) {
  if (!open) return null;

  return <div className="fixed inset-0 z-[75] grid place-items-center bg-[#050617]/80 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="ios-install-title">
    <div className="relative w-full max-w-md overflow-hidden rounded-[1.8rem] border border-[#ffe39a]/25 bg-[#0b1022]/95 shadow-[0_30px_80px_rgba(0,0,0,.62)]">
      <button type="button" onClick={onClose} aria-label="Fechar guia de instalação" className="absolute right-4 top-4 z-10 grid h-10 w-10 place-items-center rounded-full border border-white/12 bg-[#101126]/95 text-white/60 transition hover:border-primary/35 hover:text-primary"><X className="h-4 w-4" /></button>
      <div className="border-b border-white/10 bg-[radial-gradient(circle_at_20%_0%,rgba(246,204,107,.18),transparent_48%)] p-5 pr-16 sm:p-6 sm:pr-16">
        <span className="grid h-11 w-11 place-items-center rounded-2xl border border-[#ffe7a4]/35 bg-[#dcae42]/12 text-[#ffe09a]"><Compass className="h-5 w-5" /></span>
        <p className="mt-4 text-[10px] font-bold uppercase tracking-[.2em] text-[#ffd873]/80">iPhone</p>
        <h2 id="ios-install-title" className="mt-1 font-display text-xl font-bold tracking-tight text-[#fff1ce]">Instale o app no seu iPhone</h2>
        <p className="mt-2 text-sm leading-6 text-[#d8d9e8]">Leva menos de um minuto e deixa o Renker Niver Barco com ícone próprio — além de liberar os avisos.</p>
      </div>
      <ol className="space-y-3 p-5 sm:p-6">
        <li className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/15 p-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-white/8 text-sm font-bold text-[#ffe39a]">1</span><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/12 bg-[#101126] text-[#9fd9ff]"><Compass className="h-4 w-4" /></span><p className="text-sm leading-5 text-[#e8e9f2]"><strong>Abra este link no Safari.</strong><br /><span className="text-xs text-white/50">Se veio do Telegram, use o menu e escolha abrir no Safari.</span></p></li>
        <li className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/15 p-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-white/8 text-sm font-bold text-[#ffe39a]">2</span><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/12 bg-[#101126] text-[#9fd9ff]"><Share className="h-4 w-4" /></span><p className="text-sm leading-5 text-[#e8e9f2]">Toque em <strong>Compartilhar</strong>, o quadrado com a seta para cima.</p></li>
        <li className="flex items-center gap-3 rounded-2xl border border-[#f6cc6b]/28 bg-[#dcae42]/10 p-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[#e9b94d] text-sm font-bold text-[#161003]">3</span><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-[#ffe39a]/35 bg-[#dcae42]/15 text-[#ffe09a]"><PlusSquare className="h-4 w-4" /></span><p className="text-sm leading-5 text-[#fff0ce]">Escolha <strong>“Adicionar à Tela de Início”</strong> e depois <strong>“Adicionar”.</strong></p></li>
      </ol>
      <div className="flex gap-2 border-t border-white/10 p-5 pt-4 sm:px-6 sm:pb-6"><button type="button" onClick={onClose} className="min-h-11 flex-1 rounded-xl border border-white/12 px-4 text-sm font-semibold text-white/70 transition hover:bg-white/5 hover:text-white">Agora não</button><button type="button" onClick={onClose} className="premium-cta shimmer flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-[#fff0b4]/60 bg-gradient-to-r from-[#ffe399] via-[#efbd4f] to-[#c87520] px-4 text-sm font-bold text-[#150d05]">Entendi <ExternalLink className="h-3.5 w-3.5" /></button></div>
    </div>
  </div>;
}
