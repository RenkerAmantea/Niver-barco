import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useSession } from "@/hooks/use-session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, Sparkles, X } from "lucide-react";
import { avatarAccents, avatarOptions, makeAvatar } from '@/lib/avatar-options';

export default function Landing() {
  const { session, deviceSessions, saveSession, forgetDeviceSession } = useSession();
  const [, setLocation] = useLocation();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [entryError, setEntryError] = useState<string | null>(null);

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
    setEntryError(null);
    try {
      const response = await fetch('/api/auth/access', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          password,
          avatarUrl: makeAvatar(avatarOptions[Math.floor(Math.random() * avatarOptions.length)].id, avatarAccents[Math.floor(Math.random() * avatarAccents.length)].id),
        }),
      });
      const guest = await response.json();
      if (!response.ok) throw new Error(guest?.error || 'Não foi possível entrar agora.');
      saveSession({ id: guest.id, name: guest.name, avatarUrl: guest.avatarUrl });
      setLocation('/convidados');
    } catch (error) {
      setEntryError(error instanceof Error ? error.message : 'Não foi possível entrar agora.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="landing-scene flex min-h-[82vh] w-full flex-col items-center justify-center px-1 pb-6 pt-6 animate-in fade-in duration-700">
      
      {/* Hero Section */}
      <div className="relative mx-auto mb-10 max-w-2xl space-y-5 text-center md:mb-14">
        <div className="hero-kicker shimmer inline-flex items-center gap-2 rounded-full border border-[#f3c45f]/40 bg-[#2a1a05]/55 px-4 py-2 text-[10px] font-semibold uppercase text-[#ffe39a] backdrop-blur-xl"><Sparkles className="h-3.5 w-3.5" /> convite vip</div>
        <h1 className="pb-1 text-5xl font-display font-bold leading-[.88] tracking-[-.06em] text-transparent bg-clip-text bg-gradient-to-br from-[#fff5dc] via-[#f3cf86] to-[#bd8038] md:text-7xl">
          Renker<br/><span className="bg-gradient-to-r from-[#ff53bc] to-[#a368ff] bg-clip-text text-transparent">Niver a bordo</span>
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
          <p className="mb-6 text-center text-sm text-muted-foreground">Entre para confirmar presença e ver a tripulação. A senha permite reencontrar seu perfil no app ou em outro aparelho.</p>
          <form onSubmit={handleEnter} className="w-full space-y-4 flex flex-col items-center">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Digite seu nome e sobrenome"
              className="premium-input h-14 border-white/15 bg-black/35 text-center text-lg placeholder:text-white/35 focus-visible:border-[#ffd782]/60 focus-visible:ring-[#ffd782]/30"
              disabled={isSubmitting}
            />
            <Input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Crie ou digite sua senha"
              type="password"
              autoComplete="current-password"
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
          <p className="mt-3 text-center text-xs leading-5 text-white/42">Primeira vez? Este nome e senha criam seu perfil. Já entrou? Use o mesmo par para voltar ao mesmo perfil. A senha precisa ter pelo menos 4 caracteres.</p>
          {entryError && <p role="alert" className="mt-4 rounded-xl border border-red-300/25 bg-red-500/10 px-3 py-2 text-center text-sm text-red-100">{entryError}</p>}
          {deviceSessions.length > 0 && <div className="mt-6 w-full border-t border-white/10 pt-5">
            <p className="mb-3 text-center text-[10px] font-semibold uppercase tracking-[.18em] text-white/45">Perfis neste aparelho</p>
            <div className="space-y-2">
              {deviceSessions.map((saved) => <div key={saved.id} className="flex min-h-12 items-center gap-2 rounded-xl border border-white/10 bg-black/20 p-1.5">
                <button type="button" onClick={() => { saveSession(saved); setLocation('/evento'); }} className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-2 py-1.5 text-left transition hover:bg-white/[.06]">
                  {saved.avatarUrl ? <img src={saved.avatarUrl} alt="" className="h-8 w-8 shrink-0 rounded-full border border-primary/25 object-cover" /> : <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-primary/25 bg-primary/10 text-sm font-semibold text-primary">{saved.name[0]?.toUpperCase()}</span>}
                  <span className="truncate text-sm font-medium text-foreground">Entrar como {saved.name}</span>
                </button>
                <button type="button" onClick={() => forgetDeviceSession(saved.id)} aria-label={`Esquecer ${saved.name} deste aparelho`} title="Esquecer deste aparelho" className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-white/35 transition hover:bg-white/[.06] hover:text-white/80"><X className="h-4 w-4" /></button>
              </div>)}
            </div>
            <p className="mt-3 text-center text-xs leading-5 text-white/38">Toque para entrar. O X só remove o atalho deste aparelho.</p>
          </div>}
        </CardContent>
      </Card>
      <button type="button" onClick={() => setLocation('/admin')} className="-mt-5 text-[10px] font-medium tracking-[.08em] text-white/25 transition hover:text-white/55" aria-label="Abrir acesso administrativo">acesso admin</button>
    </div>
  );
}
