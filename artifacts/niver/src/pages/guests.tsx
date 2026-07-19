import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useSession } from "@/hooks/use-session";
import { 
  useListGuests, 
  useUpdateRsvp, 
  getListGuestsQueryKey, 
  getGetRsvpSummaryQueryKey,
  getGetGuestQueryKey,
  useGetGuest,
  GuestRsvpStatus,
  Guest
} from "@workspace/api-client-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, HelpCircle, XCircle, Check } from "lucide-react";
import { MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Guests() {
  const { session } = useSession();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!session) {
      setLocation("/");
    }
  }, [session, setLocation]);

  const { data: guests, isLoading: isLoadingGuests } = useListGuests();
  const { data: currentUser } = useGetGuest(session?.id ?? 0, { 
    query: { enabled: !!session?.id, queryKey: getGetGuestQueryKey(session?.id ?? 0) }
  });
  
  const updateRsvp = useUpdateRsvp();
  const [rsvpNotice, setRsvpNotice] = useState<string | null>(null);

  if (!session) return null;

  const handleRsvp = (status: GuestRsvpStatus) => {
    if (!session.id || updateRsvp.isPending) return;

    // Type assertion to bypass the specific literal types and map to the exact API expected literal
    const rsvpStatusValue = status as any;
    
    updateRsvp.mutate(
      { guestId: session.id, data: { rsvpStatus: rsvpStatusValue } },
      {
        onSuccess: (updatedGuest) => {
          // Update the exact query that drives the three RSVP buttons.  Updating
          // only the list/summary left this screen visually stuck on the previous
          // choice until a reload.
          queryClient.setQueryData(getGetGuestQueryKey(session.id), updatedGuest);
          queryClient.setQueryData(getListGuestsQueryKey(), (old: Guest[] | undefined) => {
            if (!old) return old;
            return old.map(g => g.id === updatedGuest.id ? updatedGuest : g);
          });
          queryClient.invalidateQueries({ queryKey: getGetRsvpSummaryQueryKey() });
          const copy: Record<string, string> = {
            going: 'Você marcou: eu vou. O barco agradece sua coragem.',
            maybe: 'Você marcou: talvez. A indecisão foi oficialmente registrada.',
            not_going: 'Você marcou: não vou. Vamos sentir sua ausência no convés.',
          };
          setRsvpNotice(copy[updatedGuest.rsvpStatus] ?? 'Presença atualizada.');
        }
      }
    );
  };

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
              {guest.id === session.id && (
                <span className="text-xs text-primary font-medium tracking-wide uppercase">Você</span>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const currentStatus = currentUser?.rsvpStatus || GuestRsvpStatus.pending;

  return (
    <div className="panel-enter space-y-12 pb-12">
      
      {/* User RSVP Action Area */}
      <section>
        <Card className="border-primary/20 shadow-[0_0_30px_rgba(201,168,76,0.05)] bg-gradient-to-b from-card/80 to-background">
          <CardContent className="p-6 md:p-8 flex flex-col items-center text-center space-y-6">
            <div>
              <h2 className="text-2xl font-display font-semibold mb-2">Sua Presença</h2>
              <p className="text-muted-foreground max-w-md mx-auto">
                Confirma do seu jeito, sem pressão. A lista mostra quem já passou por aqui — os convites continuam chegando.
              </p>
            </div>

            <div className="grid w-full grid-cols-3 gap-2 sm:gap-4">
              <Button
                size="lg"
                onClick={() => handleRsvp(GuestRsvpStatus.going)}
                disabled={updateRsvp.isPending}
                className={cn(
                  "h-16 w-full px-1.5 text-xs font-semibold sm:px-2 sm:text-base transition-all",
                  currentStatus === GuestRsvpStatus.going 
                    ? "rsvp-selected bg-primary text-black hover:bg-primary/90 shadow-[0_0_15px_rgba(201,168,76,0.3)]"
                    : "bg-black/40 text-foreground border border-white/10 hover:border-primary/50 hover:bg-primary/10"
                )}
                aria-pressed={currentStatus === GuestRsvpStatus.going}
              >
                <CheckCircle2 className={cn("mr-2 h-5 w-5", currentStatus === GuestRsvpStatus.going ? "text-black" : "text-primary")} />
                Vou
              </Button>

              <Button
                size="lg"
                onClick={() => handleRsvp(GuestRsvpStatus.maybe)}
                disabled={updateRsvp.isPending}
                className={cn(
                  "h-16 w-full px-1.5 text-xs font-semibold sm:px-2 sm:text-base transition-all",
                  currentStatus === GuestRsvpStatus.maybe 
                    ? "rsvp-selected border border-[#b88cff]/65 bg-[#62358c] text-white shadow-[0_0_18px_rgba(157,116,255,.28)] hover:bg-[#70409f]"
                    : "bg-black/40 text-foreground border border-white/10 hover:border-[#b88cff]/50 hover:bg-[#62358c]/20"
                )}
                aria-pressed={currentStatus === GuestRsvpStatus.maybe}
              >
                <HelpCircle className="mr-2 h-5 w-5 text-muted-foreground" />
                Talvez
              </Button>

              <Button
                size="lg"
                onClick={() => handleRsvp(GuestRsvpStatus.not_going)}
                disabled={updateRsvp.isPending}
                className={cn(
                  "h-16 w-full px-1.5 text-xs font-semibold sm:px-2 sm:text-base transition-all",
                  currentStatus === GuestRsvpStatus.not_going 
                    ? "rsvp-selected bg-destructive/20 text-destructive-foreground hover:bg-destructive/30 border border-destructive/50"
                    : "bg-black/40 text-foreground border border-white/10 hover:border-destructive/50 hover:bg-destructive/10 hover:text-destructive-foreground"
                )}
                aria-pressed={currentStatus === GuestRsvpStatus.not_going}
              >
                <XCircle className="mr-2 h-5 w-5 text-destructive/70" />
                Não vou
              </Button>
            </div>
            {rsvpNotice && <div className="rsvp-notice flex w-full items-center justify-center gap-2 rounded-xl border border-primary/20 bg-primary/10 px-4 py-3 text-center text-sm text-primary"><Check className="h-4 w-4 shrink-0" />{rsvpNotice}</div>}
          </CardContent>
        </Card>
      </section>

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
