import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useSession } from "@/hooks/use-session";
import { useGetRsvpSummary, useCreateGuest } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, HelpCircle, XCircle, ArrowRight } from "lucide-react";

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
    <div className="flex flex-col items-center justify-center min-h-[80vh] w-full px-4 animate-in fade-in zoom-in duration-1000">
      
      {/* Hero Section */}
      <div className="text-center mb-16 space-y-6 relative max-w-2xl mx-auto">
        <div className="inline-block px-4 py-1.5 rounded-full border border-primary/30 bg-primary/10 text-primary text-sm font-medium tracking-wide uppercase mb-4 shimmer">
          Convite VIP
        </div>
        <h1 className="text-5xl md:text-7xl font-display font-bold text-transparent bg-clip-text bg-gradient-to-br from-[#FFE082] via-[#C9A84C] to-[#8C6D23] leading-tight drop-shadow-sm pb-2">
          Renker Niver de Bolso
        </h1>
        <p className="text-lg md:text-xl text-muted-foreground font-light max-w-lg mx-auto">
          Uma noite inesquecível em um barco de dois andares. Confirme sua presença e prepare-se para a celebração.
        </p>
      </div>

      {/* Login / Registration Card */}
      <Card className="w-full max-w-md mx-auto mb-16 border-primary/20 bg-background/40 backdrop-blur-xl shadow-[0_0_40px_rgba(201,168,76,0.1)] relative overflow-hidden group">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
        <CardContent className="p-8 pt-8 flex flex-col items-center">
          <h2 className="text-2xl font-display font-semibold mb-6 text-foreground text-center">Identifique-se</h2>
          <form onSubmit={handleEnter} className="w-full space-y-4 flex flex-col items-center">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Digite seu nome e sobrenome"
              className="text-center text-lg h-14 bg-black/40 border-white/10 focus-visible:border-primary/50 focus-visible:ring-primary/50"
              disabled={isSubmitting}
            />
            <Button 
              type="submit" 
              size="lg" 
              disabled={!name.trim() || isSubmitting}
              className="w-full h-14 text-lg bg-gradient-to-r from-[#C9A84C] to-[#A68631] hover:from-[#FFE082] hover:to-[#C9A84C] text-black font-semibold shimmer border-0 shadow-[0_0_20px_rgba(201,168,76,0.3)] transition-all"
            >
              {isSubmitting ? "Entrando..." : "Entrar no Evento"} <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* RSVP Stats */}
      <div className="grid grid-cols-3 gap-4 md:gap-8 w-full max-w-2xl mx-auto opacity-80">
        <div className="flex flex-col items-center justify-center space-y-2 p-4 rounded-2xl bg-black/20 border border-white/5">
          <CheckCircle2 className="h-8 w-8 text-primary" />
          <span className="text-3xl font-display font-bold text-foreground">
            {isLoadingSummary ? "-" : summary?.going ?? 0}
          </span>
          <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Confirmados</span>
        </div>
        <div className="flex flex-col items-center justify-center space-y-2 p-4 rounded-2xl bg-black/20 border border-white/5">
          <HelpCircle className="h-8 w-8 text-foreground/50" />
          <span className="text-3xl font-display font-bold text-foreground">
            {isLoadingSummary ? "-" : summary?.maybe ?? 0}
          </span>
          <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Talvez</span>
        </div>
        <div className="flex flex-col items-center justify-center space-y-2 p-4 rounded-2xl bg-black/20 border border-white/5">
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
