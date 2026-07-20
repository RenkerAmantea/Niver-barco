import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'wouter';
import { Bell, CheckCheck, Inbox, Settings2 } from 'lucide-react';
import { useSession } from '@/hooks/use-session';

type AppNotification = { id: number; title: string; body: string; url: string; readAt: string | null; createdAt: string };

function relativeDate(value: string) {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return 'agora mesmo';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} h`;
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(new Date(value));
}

export function NotificationBell() {
  const { session } = useSession();
  const [, setLocation] = useLocation();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    if (!session?.id) return;
    const response = await fetch(`/api/notifications?guestId=${session.id}`);
    if (!response.ok) return;
    const data = await response.json();
    setNotifications(data.notifications ?? []);
    setUnreadCount(data.unreadCount ?? 0);
  }, [session?.id]);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 30_000);
    const onFocus = () => void refresh();
    window.addEventListener('focus', onFocus);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', onFocus); };
  }, [refresh]);

  useEffect(() => {
    const close = (event: MouseEvent) => { if (!panelRef.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const markRead = async (notification: AppNotification, goTo?: boolean) => {
    if (session?.id && !notification.readAt) {
      const response = await fetch(`/api/notifications/${notification.id}/read`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ guestId: session.id }) });
      if (response.ok) {
        const { readAt } = await response.json();
        setNotifications((items) => items.map((item) => item.id === notification.id ? { ...item, readAt } : item));
        setUnreadCount((count) => Math.max(0, count - 1));
      }
    }
    if (goTo) { setOpen(false); setLocation(notification.url); }
  };

  const markAllRead = async () => {
    await Promise.all(notifications.filter((item) => !item.readAt).map((item) => markRead(item)));
  };

  return <div ref={panelRef} className="relative">
    <button type="button" onClick={() => { setOpen((value) => !value); void refresh(); }} aria-label={unreadCount ? `${unreadCount} notificações não lidas` : 'Abrir notificações'} aria-expanded={open} className="relative grid h-10 w-10 cursor-pointer place-items-center text-white/70 transition-colors hover:text-[#f9d98a]">
      <Bell className="h-4 w-4" />
      {unreadCount > 0 && <span aria-hidden="true" className="absolute -right-1 -top-1 grid min-w-4 h-4 place-items-center rounded-full border border-[#0a0c1d] bg-[#ef5350] px-1 text-[9px] font-bold leading-none text-white">{unreadCount > 9 ? '9+' : unreadCount}</span>}
    </button>
    {open && <section aria-label="Notificações" className="absolute right-0 top-12 z-[80] flex w-[min(22rem,calc(100vw-2rem))] max-h-[min(34rem,calc(100dvh-6rem))] flex-col overflow-hidden rounded-2xl border border-white/12 bg-[#111326]/[.98] shadow-[0_22px_55px_rgba(0,0,0,.48)] backdrop-blur-2xl max-sm:fixed max-sm:inset-x-3 max-sm:top-[max(4.75rem,calc(env(safe-area-inset-top)+3.75rem))] max-sm:w-auto max-sm:max-h-[calc(100dvh-max(5.5rem,calc(env(safe-area-inset-top)+4.5rem)))]">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3.5">
        <div><h2 className="font-display text-base font-semibold text-[#fff0c8]">Avisos a bordo</h2><p className="mt-0.5 text-[11px] text-white/45">Seus recados ficam guardados aqui.</p></div>
        {unreadCount > 0 && <button type="button" onClick={() => void markAllRead()} className="inline-flex cursor-pointer items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-[#f9d98a] transition hover:bg-[#f6cc6b]/10"><CheckCheck className="h-3.5 w-3.5" />Ler todas</button>}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-1.5">
        {notifications.length === 0 ? <div className="grid place-items-center px-6 py-10 text-center"><span className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/[.03] text-white/40"><Inbox className="h-4 w-4" /></span><p className="mt-3 text-sm font-medium text-white/75">Nenhum aviso por enquanto</p><p className="mt-1 text-xs leading-5 text-white/45">Quando houver novidade, ela aparece aqui.</p></div> : notifications.map((notification) => <button key={notification.id} type="button" onClick={() => void markRead(notification, true)} className="group flex w-full cursor-pointer gap-3 rounded-xl p-3 text-left transition hover:bg-white/[.055]">
          <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${notification.readAt ? 'bg-white/15' : 'bg-[#ef5350] shadow-[0_0_0_3px_rgba(239,83,80,.12)]'}`} />
          <span className="min-w-0 flex-1"><span className="flex items-baseline justify-between gap-3"><strong className={`truncate text-sm ${notification.readAt ? 'font-medium text-white/65' : 'font-semibold text-white/95'}`}>{notification.title}</strong><time className="shrink-0 text-[10px] text-white/38">{relativeDate(notification.createdAt)}</time></span><span className="mt-1 block text-xs leading-5 text-white/55">{notification.body}</span></span>
        </button>)}
      </div>
      <button type="button" onClick={() => { setOpen(false); window.dispatchEvent(new Event('niver:open-push-settings')); }} className="m-2 flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#f9d98a]/25 bg-[#f6cc6b]/10 px-4 text-sm font-semibold text-[#ffe7a6] transition hover:bg-[#f6cc6b]/18"><Settings2 className="h-4 w-4" />Ajustar avisos</button>
    </section>}
  </div>;
}
