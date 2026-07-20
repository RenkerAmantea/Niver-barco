import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useSession } from "@/hooks/use-session";
import { 
  useListGuests, 
  getListGuestsQueryKey, 
  GuestRsvpStatus,
  Guest
} from "@workspace/api-client-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PresenceCard } from '@/components/presence-card';

export default function Guests() {
  const { session } = useSession();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!session) {
      setLocation("/");
    }
  }, [session, setLocation]);

  const { data: guests, isLoading: isLoadingGuests } = useListGuests();
  const [invited, setInvited] = useState<Guest[]>([]);

  useEffect(() => {
    let active = true;
    void fetch('/api/invited-guests')
      .then((response) => response.ok ? response.json() : [])
      .then((items) => { if (active) setInvited(Array.isArray(items) ? items : []); })
      .catch(() => { if (active) setInvited([]); });
    return () => { active = false; };
  }, [guests]);

  if (!session) return null;

  const going = guests?.filter(g => g.rsvpStatus === GuestRsvpStatus.going) || [];
  const maybe = guests?.filter(g => g.rsvpStatus === GuestRsvpStatus.maybe) || [];
  const notGoing = guests?.filter(g => g.rsvpStatus === GuestRsvpStatus.not_going) || [];

  const renderGuestList = (list: Guest[], emptyMessage: string) => {
    if (isLoadingGuests) {
      return (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex items-center gap-4 animate-pulse">
              <div className="h-12 w-12 rounded-full bg-white/5" />
              <div className="h-4 w-32 bg-white/5 rounded" />
            </div>
          ))}
        </div>
      );
    }

    if (list.length === 0) {
      return (
        <div className="text-center py-12 text-muted-foreground">
          <p>{emptyMessage}</p>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {list.map(guest => (
          <div key={guest.id} className="flex items-center gap-4 p-3 rounded-xl bg-black/20 border border-white/5 hover:bg-black/30 transition-colors">
            <Avatar className="h-12 w-12 border-primary/20">
              {guest.avatarUrl ? <AvatarImage src={guest.avatarUrl} alt={guest.name} /> : null}
              <AvatarFallback className="bg-secondary text-primary">{guest.name.charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium text-foreground">{guest.name}</p>
              {guest.rsvpStatus === GuestRsvpStatus.not_going && (guest as Guest & { rsvpNote?: string | null }).rsvpNote && <p className="mt-1 max-w-md text-sm leading-5 text-muted-foreground">“{(guest as Guest & { rsvpNote?: string }).rsvpNote}”</p>}
              {guest.id === session.id && (
                <span className="text-xs text-primary font-medium tracking-wide uppercase">Você</span>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="panel-enter space-y-12 pb-12">
      
      {/* User RSVP Action Area */}
      <section><PresenceCard /></section>

      {/* Guest List Tabs */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <div><h2 className="text-2xl font-display font-semibold">Presença da tripulação</h2><p className="mt-1 text-sm text-muted-foreground">Quem já respondeu e quem ainda está aguardando.</p></div>
        </div>
        
        <Tabs defaultValue="going" className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-8 h-14 p-1.5 bg-black/40 border-white/5">
            <TabsTrigger value="going" className="h-full rounded-lg text-xs sm:text-sm data-[state=active]:border data-[state=active]:border-emerald-300/65 data-[state=active]:bg-emerald-500/25 data-[state=active]:text-emerald-100 data-[state=active]:shadow-[0_0_20px_rgba(52,211,153,.25)]">
              Vou ✓ ({going.length})
            </TabsTrigger>
            <TabsTrigger value="maybe" className="h-full rounded-lg text-xs sm:text-sm data-[state=active]:border data-[state=active]:border-amber-300/65 data-[state=active]:bg-amber-500/25 data-[state=active]:text-amber-100 data-[state=active]:shadow-[0_0_20px_rgba(251,191,36,.22)]">
              Talvez ? ({maybe.length})
            </TabsTrigger>
            <TabsTrigger value="not_going" className="h-full rounded-lg text-xs sm:text-sm data-[state=active]:bg-destructive/20 data-[state=active]:text-destructive-foreground data-[state=active]:border data-[state=active]:border-destructive/30">
              Não vou ✗ ({notGoing.length})
            </TabsTrigger>
            <TabsTrigger value="invited" className="h-full rounded-lg text-[11px] sm:text-xs data-[state=active]:border data-[state=active]:border-amber-300/45 data-[state=active]:bg-amber-500/15 data-[state=active]:text-amber-100">
              Aguardando ({invited.length})
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="going" className="animate-in fade-in duration-500">
            {renderGuestList(going, "Ninguém confirmou presença ainda.")}
          </TabsContent>
          <TabsContent value="maybe" className="animate-in fade-in duration-500">
            {renderGuestList(maybe, "Nenhum indeciso no momento.")}
          </TabsContent>
          <TabsContent value="not_going" className="animate-in fade-in duration-500">
            {renderGuestList(notGoing, "Todos parecem dispostos a ir!")}
          </TabsContent>
          <TabsContent value="invited" className="animate-in fade-in duration-500">
            {renderGuestList(invited, "Ninguém está aguardando resposta agora.")}
          </TabsContent>
        </Tabs>
      </section>

    </div>
  );
}
