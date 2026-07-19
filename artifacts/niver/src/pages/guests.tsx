import { useEffect } from "react";
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
import { Button } from "@/components/ui/button";
import { PresenceCard } from '@/components/presence-card';
import { MessageSquare } from "lucide-react";

export default function Guests() {
  const { session } = useSession();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!session) {
      setLocation("/");
    }
  }, [session, setLocation]);

  const { data: guests, isLoading: isLoadingGuests } = useListGuests();

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

      <section className="flex justify-center -mt-4">
        <Button variant="outline" className="border-primary/30 text-primary hover:bg-primary/10" onClick={() => setLocation("/forum")}>
          <MessageSquare className="mr-2 h-4 w-4" /> Abrir mural e bate-papo
        </Button>
      </section>

      {/* Guest List Tabs */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <div><h2 className="text-2xl font-display font-semibold">Quem já respondeu</h2><p className="mt-1 text-sm text-muted-foreground">A tripulação vai aparecendo aos poucos.</p></div>
        </div>
        
        <Tabs defaultValue="going" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-8 h-14 p-1.5 bg-black/40 border-white/5">
            <TabsTrigger value="going" className="text-base h-full rounded-lg data-[state=active]:bg-primary/20 data-[state=active]:text-primary data-[state=active]:border data-[state=active]:border-primary/30">
              Vou ✓ ({going.length})
            </TabsTrigger>
            <TabsTrigger value="maybe" className="text-base h-full rounded-lg data-[state=active]:bg-secondary data-[state=active]:text-white">
              Talvez ? ({maybe.length})
            </TabsTrigger>
            <TabsTrigger value="not_going" className="text-base h-full rounded-lg data-[state=active]:bg-destructive/20 data-[state=active]:text-destructive-foreground data-[state=active]:border data-[state=active]:border-destructive/30">
              Não vou ✗ ({notGoing.length})
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
        </Tabs>
      </section>

    </div>
  );
}
