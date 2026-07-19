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

export function PushControls() {
  const { session } = useSession();
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('unsupported');
  const [subscribed, setSubscribed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [message, setMessage] = useState('');
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
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (active) { setSubscribed(Boolean(subscription)); setChecking(false); }
    };
    void inspect().catch(() => { if (active) { setSubscribed(false); setChecking(false); } });
    return () => { active = false; };
  }, []);

  const enable = async (nextPreferences = preferences) => {
    if (!session) return;
    if (isIOS && !isStandalone) { setMessage('No iPhone, notificações só funcionam pelo app instalado. Toque em “Compartilhar” no Safari → “Adicionar à Tela de Início” e abra pelo novo ícone Renker Niver.'); return; }
    setChecking(true); setMessage('');
    try {
      const configResponse = await fetch('/api/push/config');
      const config = await configResponse.json();
      if (!configResponse.ok || !config.supported || !config.publicKey) throw new Error('Push está sendo preparado. Tente em alguns minutos.');
      const nextPermission = await Notification.requestPermission();
      setPermission(nextPermission);
      if (nextPermission !== 'granted') { setSubscribed(false); setMessage('Você pode ativar depois nas permissões do navegador.'); return; }
      const registration = await navigator.serviceWorker.ready;
      const previousSubscription = await registration.pushManager.getSubscription();
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
          subscription = await registration.pushManager.subscribe(options);
        } catch (firstError) {
        // Android/Chrome can retain a broken worker after an app/domain update.
        // Re-register once before reporting a browser push-service error.
        const message = firstError instanceof Error ? firstError.message : '';
        if (!/push service|registration failed|abort/i.test(message)) throw firstError;
        await registration.unregister();
        const freshRegistration = await navigator.serviceWorker.register('/sw.js');
        await freshRegistration.update();
        const activeRegistration = await navigator.serviceWorker.ready;
          subscription = await activeRegistration.pushManager.subscribe(options);
        }
      }
      const response = await fetch('/api/push/subscriptions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ guestId: session.id, subscription, preferences: nextPreferences }) });
      if (!response.ok) throw new Error('Não foi possível salvar a inscrição deste aparelho.');
      setSubscribed(true);
      setMessage('Pronto: este aparelho receberá avisos do barco.');
    } catch (error) {
      setSubscribed(false);
      const rawMessage = error instanceof Error ? error.message : '';
      const isApple = isIOS;
      const isPushServiceError = /push service|registration failed/i.test(rawMessage);
      setMessage(isApple && isPushServiceError ? 'No iPhone, abra o convite pelo ícone instalado na Tela de Início (não pelo Safari/Telegram) e tente de novo.' : (!isApple && isPushServiceError ? 'O Chrome não conseguiu falar com o serviço de push. Abra o convite pelo Google Chrome (não Telegram/Mi Browser), confira se o Chrome e o Google Play Services estão atualizados e tente de novo.' : (rawMessage || 'Não foi possível ativar agora.')));
    } finally { setChecking(false); }
  };

  const togglePreference = async (key: PreferenceKey) => {
    const next = { ...preferences, [key]: !preferences[key] }; setPreferences(next); localStorage.setItem('niver_push_preferences', JSON.stringify(next));
    if (permission === 'granted' && subscribed) await enable(next);
  };

  if (isIOS && !isStandalone) return <section id="notificacoes" className="glass-card rounded-3xl border border-primary/30 p-5"><div className="flex items-start gap-3"><div className="grid h-10 w-10 place-items-center rounded-2xl border border-primary/30 bg-primary/10 text-primary"><BellOff className="h-5 w-5" /></div><div><h2 className="font-display text-lg">Instale para receber avisos</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">No iPhone, o push não funciona pelo Safari nem pelo navegador do Telegram. Abra no Safari, toque em Compartilhar → <strong className="text-foreground">Adicionar à Tela de Início</strong> e entre pelo ícone do app.</p></div></div></section>;
  if (permission === 'unsupported') return <section id="notificacoes" className="glass-card rounded-3xl p-5 text-sm text-muted-foreground">Este navegador não oferece notificações web. Abra pelo navegador principal ou pelo app instalado.</section>;
  const active = permission === 'granted' && subscribed;
  return <section id="notificacoes" className="glass-card rounded-3xl p-5"><div className="flex items-start gap-3"><div className="grid h-10 w-10 place-items-center rounded-2xl border border-primary/30 bg-primary/10 text-primary">{active ? <Bell className="h-5 w-5" /> : <BellOff className="h-5 w-5" />}</div><div className="min-w-0 flex-1"><h2 className="font-display text-lg">Avisos do barco</h2><p className="mt-1 text-sm leading-5 text-muted-foreground">Receba apenas o que importa para você.</p>{active ? <><p className="mt-3 text-sm text-emerald-200">Notificações ativadas neste aparelho.</p><div className="mt-3 grid gap-2">{([['announcements','Avisos do capitão'],['mentions','Marcações no mural'],['replies','Respostas e conversas'],['photos','Fotos novas']] as const).map(([key,label])=><div key={key} className="flex min-h-11 items-center justify-between rounded-xl border border-white/10 bg-black/15 px-3"><span className="text-sm">{label}</span><Switch checked={preferences[key]} onCheckedChange={() => void togglePreference(key)} aria-label={label} className="data-[state=checked]:bg-emerald-500 data-[state=unchecked]:bg-white/15" /></div>)}</div></> : <button type="button" disabled={checking} onClick={() => void enable()} className="premium-cta shimmer mt-3 inline-flex items-center gap-2 rounded-xl border border-[#fff0b4]/60 bg-gradient-to-r from-[#ffe399] via-[#efbd4f] to-[#c87520] px-4 py-2 text-sm font-semibold text-[#150d05] disabled:cursor-wait disabled:opacity-60">{permission === 'granted' ? <RotateCw className="h-3.5 w-3.5" /> : null}{checking ? 'Verificando…' : permission === 'granted' ? 'Concluir ativação' : 'Ativar notificações'}</button>}{message && <p className="mt-2 text-xs text-muted-foreground">{message}</p>}</div></div></section>;
}
