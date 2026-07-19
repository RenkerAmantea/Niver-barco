import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useSession } from "@/hooks/use-session";
import { useGetRsvpSummary, useCreateGuest } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, HelpCircle, XCircle, ArrowRight, ShipWheel } from "lucide-react";

export default function Landing() {
  const { session, saveSession } = useSession();
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
        { data: { name: name.trim() } },
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
        <div className="hero-kicker inline-flex items-center gap-2 rounded-full border border-[#f3c45f]/30 bg-[#10142b]/55 px-4 py-2 text-[10px] font-semibold uppercase text-[#ffd782] backdrop-blur-xl">
          <ShipWheel className="h-3.5 w-3.5" /> terça · 21 julho · 19h
        </div>
        <h1 className="pb-1 text-5xl font-display font-bold leading-[.88] tracking-[-.06em] text-transparent bg-clip-text bg-gradient-to-br from-[#fff5dc] via-[#f3cf86] to-[#bd8038] md:text-7xl">
          Renker<br/><span className="bg-gradient-to-r from-[#ff53bc] to-[#a368ff] bg-clip-text text-transparent">Niver Barco</span>
        </h1>
        <p className="mx-auto max-w-md text-base leading-7 text-white/78 md:text-lg">
          Uma resenha pequena, num barco grande. A Renker Party oficial segue viva, só ficou para depois.
        </p>
      </div>

      {/* Login / Registration Card */}
      <Card className="glass-card group relative mx-auto mb-10 w-full max-w-md overflow-hidden border-[#f3c45f]/20 bg-[#0b1026]/62">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#ffd782]/[.09] via-transparent to-[#e8329d]/[.08] opacity-80" />
        <CardContent className="p-8 pt-8 flex flex-col items-center">
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
              className="premium-cta shimmer h-14 w-full border-0 bg-gradient-to-r from-[#f7c968] via-[#e6ad46] to-[#c7842d] text-lg font-semibold text-[#150d05] transition-all hover:from-[#ffe29b] hover:to-[#e7ae4c]"
            >
              {isSubmitting ? "Entrando..." : "Entrar no Evento"} <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </form>
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
