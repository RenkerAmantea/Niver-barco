import { Link, useLocation } from "wouter";
import { useSession } from "@/hooks/use-session";
import { cn } from "@/lib/utils";
import { LogOut, PartyPopper } from "lucide-react";
import { Button } from "./ui/button";

export function Layout({ children }: { children: React.ReactNode }) {
  const { session, clearSession } = useSession();
  const [location, setLocation] = useLocation();

  const handleLogout = () => {
    clearSession();
    setLocation("/");
  };

  const navLinks = session
    ? [
        { href: "/convidados", label: "Convidados" },
        { href: "/forum", label: "Mural" },
      ]
    : [];

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-50 w-full border-b border-white/10 bg-background/60 backdrop-blur-xl">
        <div className="container mx-auto max-w-4xl flex h-16 items-center justify-between px-4">
          <Link href={session ? "/convidados" : "/"} className="flex items-center gap-2 transition-opacity hover:opacity-80">
            <PartyPopper className="h-5 w-5 text-primary" />
            <span className="font-display font-semibold text-lg tracking-tight hidden sm:inline-block text-primary">
              Renker Niver de Bolso
            </span>
          </Link>

          {session && (
            <nav className="flex items-center gap-6">
              <div className="flex items-center gap-4">
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={cn(
                      "text-sm font-medium transition-colors hover:text-primary",
                      location === link.href ? "text-primary" : "text-muted-foreground"
                    )}
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
              
              <div className="flex items-center gap-3 border-l border-white/10 pl-6">
                <span className="text-sm text-foreground/80 hidden sm:inline-block">
                  Olá, <strong className="text-foreground">{session.name}</strong>
                </span>
                <Button variant="ghost" size="icon" onClick={handleLogout} title="Sair">
                  <LogOut className="h-4 w-4 text-muted-foreground hover:text-destructive transition-colors" />
                </Button>
              </div>
            </nav>
          )}
        </div>
      </header>

      <main className="flex-1 container mx-auto max-w-4xl px-4 py-8 relative">
        {children}
      </main>
      
      <footer className="border-t border-white/5 py-8 text-center text-sm text-muted-foreground">
        <p>Um evento exclusivo. Prepare-se.</p>
      </footer>
    </div>
  );
}
