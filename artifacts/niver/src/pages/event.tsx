import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { useGetRsvpSummary } from '@workspace/api-client-react';
import { useSession } from '@/hooks/use-session';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { CalendarDays, Check, Copy, MapPin, PackageOpen, ShipWheel, UsersRound } from 'lucide-react';

const faq = [
  { question: 'Posso levar alguém?', answer: 'Pode, sim. Só pede para a pessoa também entrar no app e marcar a presença, para a gente ter uma noção de quem vem.' },
  { question: 'Até que horas vai a resenha?', answer: 'Não tem horário cravado: depende da empolgação do dono do barco. Pode acabar à meia-noite ou sobreviver até 6h.' },
  { question: 'Vai ter comida?', answer: 'Vai ter uma base bem simbólica: pãezinhos, amendoim e alguns refris. Como tudo foi decidido em cima da hora, se estiver com fome é melhor levar algo ou combinar de pedir por lá.' },
  { question: 'Chega iFood?', answer: 'Chega, sim. Também há barraquinhas de comida por perto até mais ou menos 20h.' },
  { question: 'Posso levar criança?', answer: 'Pode.' },
  { question: 'O barco vai navegar? Preciso chegar às 19h em ponto?', answer: 'Ele vai ficar atracado. Pode chegar no horário que conseguir, a partir das 19h.' },
];

export default function Event() {
  const { session } = useSession();
  const [, setLocation] = useLocation();
  const { data: summary } = useGetRsvpSummary();
  const [copied, setCopied] = useState(false);
  const copyPix = async () => { await navigator.clipboard?.writeText('61999898198'); setCopied(true); window.setTimeout(() => setCopied(false), 1800); };
  useEffect(() => { if (!session) setLocation('/'); }, [session, setLocation]);
  if (!session) return null;
  return <div className="panel-enter space-y-7 pb-24">
    <section className="relative overflow-hidden rounded-[2rem] border border-primary/25 bg-gradient-to-br from-[#20143f] via-[#11152e] to-[#071622] p-7 shadow-[0_0_50px_rgba(124,58,237,.18)]">
      <div className="absolute -right-10 -top-10 h-44 w-44 rounded-full bg-primary/20 blur-3xl" />
      <p className="text-xs uppercase tracking-[.2em] text-primary">21 JUL · BRASÍLIA</p>
      <h1 className="mt-3 max-w-sm text-4xl font-display font-bold leading-none text-white">Renker<br/><span className="text-primary">Niver Barco</span></h1>
      <p className="mt-5 max-w-md text-sm leading-6 text-white/70">Uma resenha pequena, um barco e uma comemoração simples. A grande Renker Party fica para mais pra frente. Esta é só a nossa resenha no convés.</p>
      <div className="mt-7 grid grid-cols-3 gap-2 text-center text-xs text-white/75"><div className="rounded-2xl bg-black/20 p-3"><CalendarDays className="mx-auto mb-2 h-4 w-4 text-primary"/>Terça<br/>19h</div><div className="rounded-2xl bg-black/20 p-3"><ShipWheel className="mx-auto mb-2 h-4 w-4 text-primary"/>Barco<br/>atracado</div><div className="rounded-2xl bg-black/20 p-3"><MapPin className="mx-auto mb-2 h-4 w-4 text-primary"/>Brasília<br/>DF</div></div>
    </section>

    <section className="glass-card relative overflow-hidden rounded-3xl p-5">
      <div className="pointer-events-none absolute -right-10 -top-12 h-32 w-32 rounded-full bg-primary/15 blur-3xl" />
      <div className="relative flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-primary/20 bg-primary/10 text-primary"><ShipWheel className="h-5 w-5" /></span>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[.18em] text-primary">Contribuição de bordo</p>
          <h2 className="mt-1 font-display text-xl text-foreground"><strong className="text-primary">R$20</strong> para limpeza e manutenção</h2>
        </div>
      </div>
      <p className="relative mt-4 max-w-md text-sm leading-6 text-muted-foreground">Se não tiver condições de verdade, fala comigo — mas não deixe de ir.</p>
      <button onClick={copyPix} className="relative mt-4 flex w-full items-center justify-between rounded-2xl border border-white/10 bg-black/20 px-4 py-3.5 text-left transition hover:border-primary/35 hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70">
        <span><span className="block text-[10px] font-medium uppercase tracking-widest text-muted-foreground">PIX · toque para copiar</span><strong className="mt-1 block font-display text-lg tracking-[.08em] text-foreground">61999898198</strong></span>
        {copied ? <span className="flex items-center gap-2 text-sm font-medium text-emerald-300"><Check className="h-5 w-5" />Copiado</span> : <Copy className="h-5 w-5 text-primary" />}
      </button>
    </section>

    <section className="glass-card rounded-3xl p-5"><div className="flex gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-primary/20 bg-primary/10 text-primary"><PackageOpen className="h-5 w-5" /></span><div><p className="font-display text-lg text-foreground">Leva o que tiver vontade</p><p className="mt-1 text-sm leading-6 text-muted-foreground">Pode levar sua bebida, petisco ou comida sem problema. É tudo liberado para entrar no barco.</p></div></div></section>

    <section className="glass-card rounded-3xl p-5"><div className="flex items-center justify-between"><div><p className="text-xs uppercase tracking-widest text-muted-foreground">Tripulação confirmada</p><p className="mt-1 text-3xl font-display text-primary">{summary?.going ?? 0}</p></div><UsersRound className="h-9 w-9 text-primary/70"/></div><Button className="mt-5 w-full bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => setLocation('/convidados')}>Ver lista e confirmar presença</Button></section>

    <section className="glass-card rounded-3xl p-5 sm:p-6"><div className="mb-4"><p className="text-[10px] font-bold uppercase tracking-[.18em] text-primary">Dúvidas de bordo</p><h2 className="mt-2 font-display text-2xl text-foreground">FAQ da resenha</h2></div><Accordion type="single" collapsible className="w-full">{faq.map((item, index) => <AccordionItem key={item.question} value={`faq-${index}`} className="border-white/8"><AccordionTrigger className="gap-3 py-4 text-left font-medium text-foreground hover:no-underline">{item.question}</AccordionTrigger><AccordionContent className="pb-4 pr-8 text-sm leading-6 text-muted-foreground">{item.answer}</AccordionContent></AccordionItem>)}</Accordion></section>
  </div>;
}
