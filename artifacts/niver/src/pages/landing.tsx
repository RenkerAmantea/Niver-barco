import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useSession } from "@/hooks/use-session";
import { useGetRsvpSummary, useCreateGuest } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, HelpCircle, XCircle, ArrowRight, Sparkles } from "lucide-react";
import { avatarColors, avatarOptions, makeAvatar } from '@/lib/avatar-options';

export default function Landing() {
  const { session, lastSession, saveSession, resumeLastSession } = useSession();
  const [, setLocation] = useLocation();
  const [name, setName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: summary, isLoading: isLoadingSummary } = useGetRsvpSummary();
  const createGuest = useCreateGuest();

  useEffect(() => {
    if (session) {
      setLocation("/convidados");
    }
  }, [session, setLocation]);

  if (session) return null;

  const handleEnter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      createGuest.mutate(
      { data: { name: name.trim(), avatarUrl: makeAvatar(avatarOptions[Math.floor(Math.random() * avatarOptions.length)].id, avatarColors[Math.floor(Math.random() * avatarColors.length)]) } },
        {
          onSuccess: (guest) => {
            saveSession({ id: guest.id, name: guest.name, avatarUrl: guest.avatarUrl });
            setLocation("/convidados");
          },
          onSettled: () => {
            setIsSubmitting(false);
          }
        }
      );
    } catch (error) {
      console.error(error);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="landing-scene flex min-h-[82vh] w-full flex-col items-center justify-center px-1 pb-6 pt-6 animate-in fade-in duration-700">
      
      {/* Hero Section */}
      <div className="relative mx-auto mb-10 max-w-2xl space-y-5 text-center md:mb-14">
        <div className="hero-kicker shimmer inline-flex items-center gap-2 rounded-full border border-[#f3c45f]/40 bg-[#2a1a05]/55 px-4 py-2 text-[10px] font-semibold uppercase text-[#ffe39a] backdrop-blur-xl"><Sparkles className="h-3.5 w-3.5" /> convite vip</div>
        <h1 className="pb-1 text-5xl font-display font-bold leading-[.88] tracking-[-.06em] text-transparent bg-clip-text bg-gradient-to-br from-[#fff5dc] via-[#f3cf86] to-[#bd8038] md:text-7xl">
          Renker<br/><span className="bg-gradient-to-r from-[#ff53bc] to-[#a368ff] bg-clip-text text-transparent">Niver Barco</span>
        </h1>
        <p className="event-signature">terça-feira · 21 de julho · 19h</p>
        <p className="mx-auto max-w-md text-base leading-7 text-white/78 md:text-lg">Uma resenha pequena, um barco e uma comemoração simples. A grande Renker Party fica para mais pra frente.</p>
      </div>

      {/* Login / Registration Card */}
      <Card className="glass-card group relative mx-auto mb-10 w-full max-w-md overflow-hidden border-[#f3c45f]/20 bg-[#0b1026]/62">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#ffd782]/[.09] via-transparent to-[#e8329d]/[.08] opacity-80" />
        <CardContent className="relative z-10 p-8 pt-8 flex flex-col items-center">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[.22em] text-[#ffd782]">embarque confirmado</p>
          <h2 className="mb-2 text-center text-2xl font-display font-semibold text-foreground">Como te chamamos?</h2>
          <p className="mb-6 text-center text-sm text-muted-foreground">Entre para confirmar presença e ver a tripulação.</p>
          <form onSubmit={handleEnter} className="w-full space-y-4 flex flex-col items-center">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Digite seu nome e sobrenome"
              className="premium-input h-14 border-white/15 bg-black/35 text-center text-lg placeholder:text-white/35 focus-visible:border-[#ffd782]/60 focus-visible:ring-[#ffd782]/30"
              disabled={isSubmitting}
            />
            <Button 
              type="submit" 
              size="lg" 
              disabled={!name.trim() || isSubmitting}
              className="premium-cta shimmer h-14 w-full border border-[#fff0b4]/70 bg-gradient-to-r from-[#ffe399] via-[#efbd4f] to-[#c87520] text-lg font-bold text-[#150d05] opacity-100 transition-all hover:from-[#fff1bc] hover:via-[#f7cc69] hover:to-[#df9132]"
            >
              {isSubmitting ? "Entrando..." : "Entrar no Evento"} <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </form>
          {lastSession && <button type="button" onClick={() => { resumeLastSession(); setLocation('/evento'); }} className="mt-5 text-sm text-primary transition hover:text-[#ffe29b]">Já entrou aqui? Retomar perfil de {lastSession.name}</button>}
        </CardContent>
      </Card>

      {/* RSVP Stats */}
      <div className="grid w-full max-w-2xl grid-cols-3 gap-3 opacity-95 md:gap-5">
        <div className="stat-glass flex flex-col items-center justify-center space-y-2 rounded-2xl border border-white/10 bg-[#0b1026]/50 p-4 backdrop-blur-xl">
          <CheckCircle2 className="h-8 w-8 text-primary" />
          <span className="text-3xl font-display font-bold text-foreground">
            {isLoadingSummary ? "-" : summary?.going ?? 0}
          </span>
          <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Confirmados</span>
        </div>
        <div className="stat-glass flex flex-col items-center justify-center space-y-2 rounded-2xl border border-white/10 bg-[#0b1026]/50 p-4 backdrop-blur-xl">
          <HelpCircle className="h-8 w-8 text-foreground/50" />
          <span className="text-3xl font-display font-bold text-foreground">
            {isLoadingSummary ? "-" : summary?.maybe ?? 0}
          </span>
          <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Talvez</span>
        </div>
        <div className="stat-glass flex flex-col items-center justify-center space-y-2 rounded-2xl border border-white/10 bg-[#0b1026]/50 p-4 backdrop-blur-xl">
          <XCircle className="h-8 w-8 text-destructive/70" />
          <span className="text-3xl font-display font-bold text-foreground">
            {isLoadingSummary ? "-" : summary?.notGoing ?? 0}
          </span>
          <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Não Vão</span>
        </div>
      </div>

    </div>
  );
}
