import { Link, useLocation } from "wouter";
import { useEffect, useState } from 'react';
import { useSession } from "@/hooks/use-session";
import { cn } from "@/lib/utils";
import { LogOut, ShipWheel, CalendarDays, UsersRound, MessagesSquare, Images, UserRound, Shield } from "lucide-react";
import { Button } from "./ui/button";
import { PresenceCard } from './presence-card';
import { PwaControls } from './pwa-controls';
import { NotificationBell } from './notification-bell';
import { PushControls } from './push-controls';
import { useGetGuest, GuestRsvpStatus, getGetGuestQueryKey } from '@workspace/api-client-react';

export function Layout({ children }: { children: React.ReactNode }) {
  const { session, clearSession } = useSession();
  const [location, setLocation] = useLocation();
  const { data: currentGuest } = useGetGuest(session?.id ?? 0, { query: { enabled: !!session?.id, queryKey: getGetGuestQueryKey(session?.id ?? 0) } });
  const [showPushNudge, setShowPushNudge] = useState(false);
  useEffect(() => {
    if (!session || !('Notification' in window)) return;
    const standalone = window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone;
    if (standalone && !sessionStorage.getItem('niver_push_nudge_seen')) setShowPushNudge(true);
  }, [session]);

  const handleLogout = () => {
    clearSession();
    setLocation("/");
  };

  const navLinks = [
    { href: "/evento", label: "Evento", icon: CalendarDays },
    { href: "/convidados", label: "Convidados", icon: UsersRound },
    { href: "/forum", label: "Mural", icon: MessagesSquare, featured: true },
    { href: "/fotos", label: "Fotos", icon: Images },
    { href: "/perfil", label: "Perfil", icon: UserRound },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      {session && <header className="captain-bar sticky top-3 z-50 mx-auto w-[calc(100%-1.25rem)] max-w-4xl rounded-[1.15rem] border border-white/12 bg-[#0a0c1d]/72 shadow-[inset_0_1px_0_rgba(255,255,255,.11),0_18px_42px_rgba(0,0,0,.32)] backdrop-blur-2xl">
        <div className="relative mx-auto flex h-[3.85rem] items-center justify-between px-3 sm:px-4">
          <Link href={session ? "/evento" : "/"} aria-label="Ir para o evento" className="captain-mark flex h-10 w-10 items-center justify-center rounded-xl border border-[#f9d98a]/25 bg-[#f6cc6b]/[.09] text-[#f9d98a] transition-colors hover:bg-[#f6cc6b]/[.17]">
            <ShipWheel className="h-[1.15rem] w-[1.15rem]" />
          </Link>
          <Link href={session ? "/evento" : "/"} className="absolute left-1/2 flex -translate-x-1/2 flex-col items-center whitespace-nowrap text-center leading-none transition-opacity hover:opacity-85">
            <span className="font-display text-[.7rem] font-semibold uppercase tracking-[.14em] text-[#fff0c8] sm:text-xs sm:tracking-[.18em]">Renker Niver Barco</span>
            <span className="mt-1 text-[8px] font-medium uppercase tracking-[.16em] text-[#d3c7ec]/70 sm:text-[9px]">Terça-feira · 21 · 19h</span>
          </Link>

          {session && (
            <div className="flex items-center gap-1"><NotificationBell />{session.isAdmin && <Button variant="ghost" size="icon" onClick={() => setLocation('/admin')} title="Administração" className="h-10 w-8 cursor-pointer text-primary hover:bg-transparent"><Shield className="h-4 w-4" /></Button>}<Button variant="ghost" size="icon" onClick={handleLogout} title="Sair" className="h-10 w-8 cursor-pointer rounded-xl border-0 bg-transparent hover:bg-transparent">
              <LogOut className="h-4 w-4 text-white/60 transition-colors hover:text-[#ffb0b0]" />
            </Button></div>
          )}
        </div>
      </header>}

      <main className={cn('relative flex-1 container mx-auto max-w-4xl px-4 py-8', session && 'pt-12')}>
        {children}
      </main>
      
      <footer className="border-t border-white/5 py-8 pb-28 text-center text-sm text-muted-foreground">
        <p>Renker de Bolso, porque nem todo aniversário precisa de uma operação logística de médio porte.</p>
      </footer>
      {session && <nav aria-label="Navegação principal" className="bottom-nav fixed inset-x-3 bottom-3 z-50 mx-auto max-w-lg">
        {navLinks.map(({ href, label, icon: Icon, featured }) => <Link key={href} href={href} aria-current={location === href ? 'page' : undefined} className={cn('bottom-nav-item', featured && 'bottom-nav-item-center')}><Icon className="bottom-nav-icon" /> <span className="bottom-nav-label">{label}</span></Link>)}
      </nav>}
      <PwaControls />
      {showPushNudge && <div className="fixed inset-0 z-[75] grid place-items-center bg-[#050617]/70 p-4 backdrop-blur-sm"><div className="w-full max-w-md space-y-3"><PushControls /><button type="button" onClick={() => { sessionStorage.setItem('niver_push_nudge_seen', '1'); setShowPushNudge(false); }} className="mx-auto block px-4 py-2 text-sm text-white/60">Agora não</button></div></div>}
      {session && currentGuest?.rsvpStatus === GuestRsvpStatus.pending && location !== '/convidados' && <div className="fixed inset-0 z-[70] grid place-items-center bg-[#050617]/70 p-4 backdrop-blur-sm"><div className="w-full max-w-md"><PresenceCard /></div></div>}
    </div>
  );
}
