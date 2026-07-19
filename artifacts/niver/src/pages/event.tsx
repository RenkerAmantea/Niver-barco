import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { useGetRsvpSummary } from '@workspace/api-client-react';
import { useSession } from '@/hooks/use-session';
import { Button } from '@/components/ui/button';
import { CalendarDays, Copy, MapPin, ShipWheel, UsersRound } from 'lucide-react';

export default function Event() {
  const { session } = useSession();
  const [, setLocation] = useLocation();
  const { data: summary } = useGetRsvpSummary();
  const copyPix = async () => { await navigator.clipboard?.writeText('61999898198'); };
  useEffect(() => { if (!session) setLocation('/'); }, [session, setLocation]);
  if (!session) return null;
  return <div className="panel-enter space-y-7 pb-24">
    <section className="relative overflow-hidden rounded-[2rem] border border-primary/25 bg-gradient-to-br from-[#20143f] via-[#11152e] to-[#071622] p-7 shadow-[0_0_50px_rgba(124,58,237,.18)]">
      <div className="absolute -right-10 -top-10 h-44 w-44 rounded-full bg-primary/20 blur-3xl" />
      <p className="text-xs uppercase tracking-[.2em] text-primary">21 JUL · BRASÍLIA</p>
      <h1 className="mt-3 max-w-sm text-4xl font-display font-bold leading-none text-white">Renker<br/><span className="text-primary">Niver Barco</span></h1>
      <p className="mt-5 max-w-md text-sm leading-6 text-white/70">Uma resenha pequena, um barco e uma comemoração simples. A grande Renker Party fica para mais pra frente. Esta é só a nossa resenha no convés.</p>
      <div className="mt-7 grid grid-cols-3 gap-2 text-center text-xs text-white/75">
        <div className="rounded-2xl bg-black/20 p-3"><CalendarDays className="mx-auto mb-2 h-4 w-4 text-primary"/>Terça<br/>19h</div>
        <div className="rounded-2xl bg-black/20 p-3"><ShipWheel className="mx-auto mb-2 h-4 w-4 text-primary"/>Barco<br/>atracado</div>
        <div className="rounded-2xl bg-black/20 p-3"><MapPin className="mx-auto mb-2 h-4 w-4 text-primary"/>Brasília<br/>DF</div>
      </div>
    </section>
    <section className="rounded-3xl border border-[#f7ca68]/35 bg-[#2a1c08]/55 p-5 shadow-[inset_0_1px_0_rgba(255,241,190,.12),0_16px_36px_rgba(0,0,0,.16)]"><p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#ffe29a]">Contribuição de bordo</p><h2 className="mt-2 font-display text-xl text-[#fff1cf]">R$20 para limpeza e manutenção</h2><p className="mt-2 text-sm leading-6 text-white/65">Se puder contribuir, ajuda a manter a resenha simples e bem cuidada.</p><button onClick={copyPix} className="mt-4 flex w-full items-center justify-between rounded-2xl border border-[#f8d681]/35 bg-black/25 px-4 py-3 text-left text-[#ffe5a1] transition hover:bg-black/40"><span><span className="block text-[10px] uppercase tracking-widest text-white/45">PIX</span><strong className="font-display text-base tracking-wide">61999898198</strong></span><Copy className="h-5 w-5" /></button></section>
    <section className="glass-card rounded-3xl p-5">
      <div className="flex items-center justify-between"><div><p className="text-xs uppercase tracking-widest text-muted-foreground">Tripulação confirmada</p><p className="mt-1 text-3xl font-display text-primary">{summary?.going ?? 0}</p></div><UsersRound className="h-9 w-9 text-primary/70"/></div>
      <Button className="mt-5 w-full bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => setLocation('/convidados')}>Ver lista e confirmar presença</Button>
    </section>
  </div>;
}
