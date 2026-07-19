import { useEffect, useState } from 'react';
import { Bell, BellOff, RotateCw } from 'lucide-react';
import { useSession } from '@/hooks/use-session';

function keyToUint8Array(base64: string) {
  const raw = atob(base64.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, char => char.charCodeAt(0));
}

export function PushControls() {
  const { session } = useSession();
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('unsupported');
  const [subscribed, setSubscribed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [message, setMessage] = useState('');
  const [preferences, setPreferences] = useState(() => { try { return JSON.parse(localStorage.getItem('niver_push_preferences') ?? '{"mentions":true,"replies":true,"photos":true}'); } catch { return { mentions: true, replies: true, photos: true }; } });

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
    setChecking(true); setMessage('');
    try {
      const configResponse = await fetch('/api/push/config');
      const config = await configResponse.json();
      if (!configResponse.ok || !config.supported || !config.publicKey) throw new Error('Push está sendo preparado. Tente em alguns minutos.');
      const nextPermission = await Notification.requestPermission();
      setPermission(nextPermission);
      if (nextPermission !== 'granted') { setSubscribed(false); setMessage('Você pode ativar depois nas permissões do navegador.'); return; }
      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();
      try {
        subscription = subscription ?? await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToUint8Array(config.publicKey) });
      } catch (error) {
        // An older deployed version may have registered a subscription with another VAPID key.
        if (!subscription) throw error;
        await subscription.unsubscribe();
        subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToUint8Array(config.publicKey) });
      }
      const response = await fetch('/api/push/subscriptions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ guestId: session.id, subscription, preferences: nextPreferences }) });
      if (!response.ok) throw new Error('Não foi possível salvar a inscrição deste aparelho.');
      setSubscribed(true);
      setMessage('Pronto: este aparelho receberá avisos do barco.');
    } catch (error) {
      setSubscribed(false);
      setMessage(error instanceof Error ? error.message : 'Não foi possível ativar agora.');
    } finally { setChecking(false); }
  };

  const togglePreference = async (key: 'mentions' | 'replies' | 'photos') => {
    const next = { ...preferences, [key]: !preferences[key] }; setPreferences(next); localStorage.setItem('niver_push_preferences', JSON.stringify(next));
    if (permission === 'granted' && subscribed) await enable(next);
  };

  if (permission === 'unsupported') return null;
  const active = permission === 'granted' && subscribed;
  return <section id="notificacoes" className="glass-card rounded-3xl p-5"><div className="flex items-start gap-3"><div className="grid h-10 w-10 place-items-center rounded-2xl border border-primary/30 bg-primary/10 text-primary">{active ? <Bell className="h-5 w-5" /> : <BellOff className="h-5 w-5" />}</div><div className="min-w-0 flex-1"><h2 className="font-display text-lg">Avisos do barco</h2><p className="mt-1 text-sm leading-5 text-muted-foreground">Receba apenas o que importa para você.</p>{active ? <><p className="mt-3 text-sm text-emerald-200">Notificações ativadas neste aparelho.</p><div className="mt-3 grid gap-2">{([['mentions','Marcações no mural'],['replies','Respostas e conversas'],['photos','Fotos novas']] as const).map(([key,label])=><label key={key} className="flex min-h-10 items-center justify-between rounded-xl border border-white/10 bg-black/15 px-3 text-sm"><span>{label}</span><input type="checkbox" checked={preferences[key]} onChange={() => void togglePreference(key)} className="h-4 w-4 accent-[#f3c45f]"/></label>)}</div></> : <button type="button" disabled={checking} onClick={() => void enable()} className="premium-cta shimmer mt-3 inline-flex items-center gap-2 rounded-xl border border-[#fff0b4]/60 bg-gradient-to-r from-[#ffe399] via-[#efbd4f] to-[#c87520] px-4 py-2 text-sm font-semibold text-[#150d05] disabled:cursor-wait disabled:opacity-60">{permission === 'granted' ? <RotateCw className="h-3.5 w-3.5" /> : null}{checking ? 'Verificando…' : permission === 'granted' ? 'Concluir ativação' : 'Ativar notificações'}</button>}{message && <p className="mt-2 text-xs text-muted-foreground">{message}</p>}</div></div></section>;
}
