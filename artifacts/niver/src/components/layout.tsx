import { Link, useLocation } from "wouter";
import { useSession } from "@/hooks/use-session";
import { cn } from "@/lib/utils";
import { LogOut, ShipWheel, CalendarDays, UsersRound, MessageCircle, Images, UserRound, Waves } from "lucide-react";
import { Button } from "./ui/button";

export function Layout({ children }: { children: React.ReactNode }) {
  const { session, clearSession } = useSession();
  const [location, setLocation] = useLocation();

  const handleLogout = () => {
    clearSession();
    setLocation("/");
  };

  const navLinks = [
    { href: "/evento", label: "Evento", icon: CalendarDays },
    { href: "/convidados", label: "Convidados", icon: UsersRound },
    { href: "/forum", label: "Mural", icon: MessageCircle },
    { href: "/fotos", label: "Fotos", icon: Images },
    { href: "/perfil", label: "Perfil", icon: UserRound },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <header className="captain-bar sticky top-3 z-50 mx-auto w-[calc(100%-1.25rem)] max-w-4xl rounded-[1.15rem] border border-white/12 bg-[#0a0c1d]/72 shadow-[inset_0_1px_0_rgba(255,255,255,.11),0_18px_42px_rgba(0,0,0,.32)] backdrop-blur-2xl">
        <div className="relative mx-auto flex h-[3.85rem] items-center justify-between px-3 sm:px-4">
          <Link href={session ? "/evento" : "/"} aria-label="Ir para o evento" className="captain-mark flex h-10 w-10 items-center justify-center rounded-xl border border-[#f9d98a]/25 bg-[#f6cc6b]/[.09] text-[#f9d98a] transition-colors hover:bg-[#f6cc6b]/[.17]">
            <ShipWheel className="h-[1.15rem] w-[1.15rem]" />
          </Link>
          <Link href={session ? "/evento" : "/"} className="absolute left-1/2 flex -translate-x-1/2 flex-col items-center whitespace-nowrap text-center leading-none transition-opacity hover:opacity-85">
            <Waves className="hidden h-3.5 w-3.5 text-[#9d74ff] sm:block" />
            <span className="font-display text-[.7rem] font-semibold uppercase tracking-[.14em] text-[#fff0c8] sm:text-xs sm:tracking-[.18em]">Renker Niver Barco</span>
            <span className="mt-1 text-[8px] font-medium uppercase tracking-[.16em] text-[#d3c7ec]/70 sm:text-[9px]">Terça-feira · 21 · 19h</span>
          </Link>

          {session && (
            <Button variant="ghost" size="icon" onClick={handleLogout} title="Sair" className="h-10 w-10 cursor-pointer rounded-xl border border-white/[.07] bg-white/[.035] hover:bg-white/[.08]">
              <LogOut className="h-4 w-4 text-white/60 transition-colors hover:text-[#ffb0b0]" />
            </Button>
          )}
        </div>
      </header>

      <main className="flex-1 container mx-auto max-w-4xl px-4 py-8 pt-12 relative">
        {children}
      </main>
      
      <footer className="border-t border-white/5 py-8 pb-24 text-center text-sm text-muted-foreground">
        <p>Renker de Bolso, porque nem todo aniversário precisa de uma operação logística de médio porte.</p>
      </footer>
      {session && <nav aria-label="Navegação principal" className="fixed inset-x-3 bottom-3 z-50 mx-auto flex max-w-lg items-center justify-around rounded-2xl border border-white/12 bg-[#090b1c]/84 px-1 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,.07),0_14px_32px_rgba(0,0,0,.36)] backdrop-blur-xl">
        {navLinks.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={cn("flex min-w-0 cursor-pointer flex-col items-center gap-1 rounded-xl px-2 py-2 text-[9px] transition-all sm:min-w-15 sm:px-3 sm:text-[10px]", location === href ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-white/5 hover:text-foreground")}><Icon className="h-4 w-4" />{label}</Link>)}
      </nav>}
    </div>
  );
}
