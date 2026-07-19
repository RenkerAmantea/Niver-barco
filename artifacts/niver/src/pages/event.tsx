import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { useGetRsvpSummary } from '@workspace/api-client-react';
import { useSession } from '@/hooks/use-session';
import { Button } from '@/components/ui/button';
import { CalendarDays, MapPin, ShipWheel, UsersRound } from 'lucide-react';

export default function Event() {
  const { session } = useSession();
  const [, setLocation] = useLocation();
  const { data: summary } = useGetRsvpSummary();
  useEffect(() => { if (!session) setLocation('/'); }, [session, setLocation]);
  if (!session) return null;
  return <div className="panel-enter space-y-7 pb-24">
    <section className="relative overflow-hidden rounded-[2rem] border border-primary/25 bg-gradient-to-br from-[#20143f] via-[#11152e] to-[#071622] p-7 shadow-[0_0_50px_rgba(124,58,237,.18)]">
      <div className="absolute -right-10 -top-10 h-44 w-44 rounded-full bg-primary/20 blur-3xl" />
      <p className="text-xs uppercase tracking-[.2em] text-primary">21 JUL · BRASÍLIA</p>
      <h1 className="mt-3 max-w-sm text-4xl font-display font-bold leading-none text-white">Renker<br/><span className="text-primary">Niver Barco</span></h1>
      <p className="mt-5 max-w-md text-sm leading-6 text-white/70">Uma resenha pequena, um barco grande e a Renker Party oficialmente adiada para preservar a sanidade coletiva.</p>
      <div className="mt-7 grid grid-cols-3 gap-2 text-center text-xs text-white/75">
        <div className="rounded-2xl bg-black/20 p-3"><CalendarDays className="mx-auto mb-2 h-4 w-4 text-primary"/>Terça<br/>19h</div>
        <div className="rounded-2xl bg-black/20 p-3"><ShipWheel className="mx-auto mb-2 h-4 w-4 text-primary"/>Barco<br/>atracado</div>
        <div className="rounded-2xl bg-black/20 p-3"><MapPin className="mx-auto mb-2 h-4 w-4 text-primary"/>Brasília<br/>DF</div>
      </div>
    </section>
    <section className="glass-card rounded-3xl p-5">
      <div className="flex items-center justify-between"><div><p className="text-xs uppercase tracking-widest text-muted-foreground">Tripulação confirmada</p><p className="mt-1 text-3xl font-display text-primary">{summary?.going ?? 0}</p></div><UsersRound className="h-9 w-9 text-primary/70"/></div>
      <Button className="mt-5 w-full bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => setLocation('/convidados')}>Ver lista e confirmar presença</Button>
    </section>
  </div>;
}
