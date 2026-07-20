import { useEffect, useState } from 'react';
import { Bell, BellOff, RotateCw } from 'lucide-react';
import { useSession } from '@/hooks/use-session';
import { Switch } from '@/components/ui/switch';

const defaultPreferences = { announcements: true, mentions: true, replies: true, photos: true };
type PreferenceKey = keyof typeof defaultPreferences;

function keyToUint8Array(base64: string) {
  const normalized = base64.replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(normalized.padEnd(normalized.length + ((4 - normalized.length % 4) % 4), '='));
  return Uint8Array.from(raw, char => char.charCodeAt(0));
}

function sameApplicationServerKey(subscription: PushSubscription, publicKey: string) {
  const currentKey = subscription.options.applicationServerKey;
  if (!currentKey) return false;
  const expected = keyToUint8Array(publicKey);
  const current = new Uint8Array(currentKey);
  return current.length === expected.length && current.every((value, index) => value === expected[index]);
}

async function getVerifiedServiceWorker() {
  // Um deploy incompleto chegou a deixar um PWA antigo procurando `sw.js` e
  // recebendo 404. Conferir o arquivo antes do registro troca um erro técnico
  // críptico por uma recuperação previsível e impede assinar push em worker
  // quebrado/cacheado.
  const workerResponse = await fetch('/sw.js', { cache: 'no-store' });
  const contentType = workerResponse.headers.get('content-type') || '';
  if (!workerResponse.ok || !contentType.includes('javascript')) {
    throw new Error('A atualização do app ainda está sendo aplicada. Feche e abra o app, aguarde um minuto e tente novamente.');
  }
  const registration = await navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' });
  await registration.update();
  if (registration.waiting) registration.waiting.postMessage({ type: 'SKIP_WAITING' });
  return navigator.serviceWorker.ready;
}

function workerSummary(registration: ServiceWorkerRegistration | null) {
  if (!registration) return 'nenhum';
  return [
    registration.active ? `ativo:${new URL(registration.active.scriptURL).pathname}` : 'ativo:não',
    registration.waiting ? `aguardando:${new URL(registration.waiting.scriptURL).pathname}` : 'aguardando:não',
    registration.installing ? `instalando:${new URL(registration.installing.scriptURL).pathname}` : 'instalando:não',
  ].join(', ');
}

async function resetOnlyThisAppsPushState() {
  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(registrations
    .filter((registration) => new URL(registration.scope).origin === window.location.origin)
    .map((registration) => registration.unregister()));
  const keys = await caches.keys();
  await Promise.all(keys
    .filter((key) => key.startsWith('niver-barco-'))
    .map((key) => caches.delete(key)));
}

export function PushControls() {
  const { session } = useSession();
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('unsupported');
  const [subscribed, setSubscribed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [message, setMessage] = useState('');
  const [diagnostic, setDiagnostic] = useState('');
  const [preferences, setPreferences] = useState(() => { try { return { ...defaultPreferences, ...JSON.parse(localStorage.getItem('niver_push_preferences') ?? '{}') }; } catch { return defaultPreferences; } });
  const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
  const isStandalone = window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

  useEffect(() => {
    let active = true;
    const inspect = async () => {
      if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
        if (active) { setPermission('unsupported'); setChecking(false); }
        return;
      }
      setPermission(Notification.permission);
      if (Notification.permission !== 'granted') {
        if (active) { setSubscribed(false); setChecking(false); }
        return;
      }
      const registration = await getVerifiedServiceWorker();
      const subscription = await registration.pushManager.getSubscription();
      if (active) { setSubscribed(Boolean(subscription)); setChecking(false); }
    };
    void inspect().catch(() => { if (active) { setSubscribed(false); setChecking(false); } });
    return () => { active = false; };
  }, []);

  const enable = async (nextPreferences = preferences) => {
    if (!session) return;
    if (isIOS && !isStandalone) { setMessage('No iPhone, notificações só funcionam pelo app instalado. Toque em “Compartilhar” no Safari → “Adicionar à Tela de Início” e abra pelo novo ícone Renker Niver.'); return; }
    setChecking(true); setMessage(''); setDiagnostic('');
    let stage = 'início';
    let registration: ServiceWorkerRegistration | null = null;
    let configFingerprint = 'indisponível';
    let hadSubscription = false;
    try {
      stage = 'configuração do servidor';
      const configResponse = await fetch('/api/push/config', { cache: 'no-store' });
      const config = await configResponse.json();
      if (!configResponse.ok || !config.supported || !config.publicKey) throw new Error('Push está sendo preparado. Tente em alguns minutos.');
      const healthResponse = await fetch('/api/push/health', { cache: 'no-store' });
      const health = await healthResponse.json().catch(() => null);
      if (!healthResponse.ok || !health?.configured) throw new Error('O servidor de notificações não está configurado.');
      if (!health.pairMatches) throw new Error('A configuração de segurança do push no servidor não confere. Já identificamos o ponto para correção.');
      configFingerprint = health.publicKeyFingerprint ?? 'indisponível';
      stage = 'permissão do navegador';
      const nextPermission = await Notification.requestPermission();
      setPermission(nextPermission);
      if (nextPermission !== 'granted') { setSubscribed(false); setMessage('Você pode ativar depois nas permissões do navegador.'); return; }
      stage = 'service worker';
      registration = await getVerifiedServiceWorker();
      const previousSubscription = await registration.pushManager.getSubscription();
      hadSubscription = Boolean(previousSubscription);
      const options = { userVisibleOnly: true, applicationServerKey: keyToUint8Array(config.publicKey) };
      let subscription: PushSubscription;
      // Do not unsubscribe a healthy Chrome subscription on every tap. On
      // Android that immediate unsubscribe/subscribe cycle can itself trigger
      // "Registration failed - push service error" after a domain update.
      if (previousSubscription && sameApplicationServerKey(previousSubscription, config.publicKey)) {
        subscription = previousSubscription;
      } else {
        if (previousSubscription) await previousSubscription.unsubscribe();
        try {
          stage = 'inscrição no serviço de push do Chrome';
          subscription = await registration.pushManager.subscribe(options);
        } catch (firstError) {
          // O fluxo antigo desregistrava o worker e tentava se inscrever de
          // novo na mesma execução. `navigator.serviceWorker.ready` pode
          // devolver aquele worker antigo nesse intervalo, ou seja: a
          // “segunda tentativa” nunca era realmente limpa. No Android isso
          // mantém o AbortError. Fazemos a recuperação em duas vidas: limpa
          // apenas este app, recarrega e só então permite uma nova inscrição.
          const message = firstError instanceof Error ? firstError.message : '';
          if (!/push service|registration failed|abort/i.test(message)) throw firstError;
          const repairKey = `niver_push_repair:${window.location.origin}`;
          if (!sessionStorage.getItem(repairKey)) {
            stage = 'recuperação limpa do app';
            sessionStorage.setItem(repairKey, '1');
            await resetOnlyThisAppsPushState();
            setMessage('Preparei uma ativação limpa deste app. Ele será recarregado agora; depois toque em “Concluir ativação” uma vez.');
            window.setTimeout(() => window.location.reload(), 350);
            return;
          }
          throw firstError;
        }
      }
      sessionStorage.removeItem(`niver_push_repair:${window.location.origin}`);
      stage = 'salvamento da inscrição';
      const response = await fetch('/api/push/subscriptions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ guestId: session.id, subscription, preferences: nextPreferences }) });
      if (!response.ok) throw new Error('Não foi possível salvar a inscrição deste aparelho.');
      setSubscribed(true);
      setMessage('Pronto: este aparelho receberá avisos do barco.');
    } catch (error) {
      setSubscribed(false);
      const rawMessage = error instanceof Error ? error.message : '';
      const errorName = error instanceof Error ? error.name : typeof error;
      setDiagnostic([
        `etapa: ${stage}`,
        `erro: ${errorName || 'desconhecido'}`,
        `mensagem: ${rawMessage || 'sem mensagem'}`,
        `permissão: ${Notification.permission}`,
        `origem: ${window.location.origin}`,
        `PWA: ${isStandalone ? 'sim' : 'não'}`,
        `seguro: ${window.isSecureContext ? 'sim' : 'não'}`,
        `online: ${navigator.onLine ? 'sim' : 'não'}`,
        `chave VAPID: ${configFingerprint}`,
        `worker: ${workerSummary(registration)}`,
        `inscrição antes: ${hadSubscription ? 'sim' : 'não'}`,
        `Chrome: ${(navigator.userAgent.match(/Chrome\/([0-9.]+)/)?.[1]) ?? 'não identificado'}`,
      ].join('\n'));
      const isApple = isIOS;
      const isPushServiceError = /push service|registration failed/i.test(rawMessage);
      setMessage(isApple && isPushServiceError ? 'No iPhone, abra o convite pelo ícone instalado na Tela de Início (não pelo Safari/Telegram) e tente de novo.' : (!isApple && isPushServiceError ? 'O Chrome não conseguiu falar com o serviço de push. Abra o convite pelo Google Chrome (não Telegram/Mi Browser), confira se o Chrome e o Google Play Services estão atualizados e tente de novo.' : (rawMessage || 'Não foi possível ativar agora.')));
    } finally { setChecking(false); }
  };

  const copyDiagnostic = async () => {
    try { await navigator.clipboard.writeText(diagnostic); setMessage('Diagnóstico copiado.'); }
    catch { setMessage('Não foi possível copiar automaticamente. Selecione o texto abaixo e me envie.'); }
  };

  const togglePreference = async (key: PreferenceKey) => {
    const next = { ...preferences, [key]: !preferences[key] }; setPreferences(next); localStorage.setItem('niver_push_preferences', JSON.stringify(next));
    if (permission === 'granted' && subscribed) await enable(next);
  };

  if (isIOS && !isStandalone) return <section id="notificacoes" className="glass-card rounded-3xl border border-primary/30 p-5"><div className="flex items-start gap-3"><div className="grid h-10 w-10 place-items-center rounded-2xl border border-primary/30 bg-primary/10 text-primary"><BellOff className="h-5 w-5" /></div><div><h2 className="font-display text-lg">Instale para receber avisos</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">No iPhone, o push não funciona pelo Safari nem pelo navegador do Telegram. Abra no Safari, toque em Compartilhar → <strong className="text-foreground">Adicionar à Tela de Início</strong> e entre pelo ícone do app.</p></div></div></section>;
  if (permission === 'unsupported') return <section id="notificacoes" className="glass-card rounded-3xl p-5 text-sm text-muted-foreground">Este navegador não oferece notificações web. Abra pelo navegador principal ou pelo app instalado.</section>;
  const active = permission === 'granted' && subscribed;
  return <section id="notificacoes" className="glass-card rounded-3xl p-5"><div className="flex items-start gap-3"><div className="grid h-10 w-10 place-items-center rounded-2xl border border-primary/30 bg-primary/10 text-primary">{active ? <Bell className="h-5 w-5" /> : <BellOff className="h-5 w-5" />}</div><div className="min-w-0 flex-1"><h2 className="font-display text-lg">Avisos do barco</h2><p className="mt-1 text-sm leading-5 text-muted-foreground">Receba apenas o que importa para você.</p>{active ? <><p className="mt-3 text-sm text-emerald-200">Notificações ativadas neste aparelho.</p><div className="mt-3 grid gap-2">{([['announcements','Avisos do capitão'],['mentions','Marcações no mural'],['replies','Respostas e conversas'],['photos','Fotos novas']] as const).map(([key,label])=><div key={key} className="flex min-h-11 items-center justify-between rounded-xl border border-white/10 bg-black/15 px-3"><span className="text-sm">{label}</span><Switch checked={preferences[key]} onCheckedChange={() => void togglePreference(key)} aria-label={label} className="data-[state=checked]:bg-emerald-500 data-[state=unchecked]:bg-white/15" /></div>)}</div></> : <button type="button" disabled={checking} onClick={() => void enable()} className="premium-cta shimmer mt-3 inline-flex items-center gap-2 rounded-xl border border-[#fff0b4]/60 bg-gradient-to-r from-[#ffe399] via-[#efbd4f] to-[#c87520] px-4 py-2 text-sm font-semibold text-[#150d05] disabled:cursor-wait disabled:opacity-60">{permission === 'granted' ? <RotateCw className="h-3.5 w-3.5" /> : null}{checking ? 'Verificando…' : permission === 'granted' ? 'Concluir ativação' : 'Ativar notificações'}</button>}{message && <p className="mt-2 text-xs text-muted-foreground">{message}</p>}{diagnostic && <details className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3"><summary className="cursor-pointer text-xs font-medium text-[#ffe4a0]">Diagnóstico técnico</summary><pre className="mt-2 whitespace-pre-wrap break-words font-mono text-[10px] leading-4 text-white/55">{diagnostic}</pre><button type="button" onClick={() => void copyDiagnostic()} className="mt-2 text-xs font-medium text-primary hover:text-[#ffe4a0]">Copiar diagnóstico</button></details>}</div></div></section>;
}
