import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Check, CheckCircle2, HelpCircle, XCircle } from 'lucide-react';
import { useGetGuest, useUpdateRsvp, Guest, GuestRsvpStatus, getGetGuestQueryKey, getGetRsvpSummaryQueryKey, getListGuestsQueryKey } from '@workspace/api-client-react';
import { useSession } from '@/hooks/use-session';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export function PresenceCard({ onDone }: { onDone?: () => void }) {
  const { session } = useSession();
  const queryClient = useQueryClient();
  const { data: guest } = useGetGuest(session?.id ?? 0, { query: { enabled: !!session?.id, queryKey: getGetGuestQueryKey(session?.id ?? 0) } });
  const update = useUpdateRsvp();
  const [notice, setNotice] = useState<string | null>(null);
  if (!session) return null;
  const current = guest?.rsvpStatus ?? GuestRsvpStatus.pending;
  const choose = (status: GuestRsvpStatus) => update.mutate({ guestId: session.id, data: { rsvpStatus: status as any } }, { onSuccess: (updated) => {
    queryClient.setQueryData(getGetGuestQueryKey(session.id), updated);
    queryClient.setQueryData(getListGuestsQueryKey(), (old: Guest[] | undefined) => old?.map(item => item.id === updated.id ? updated : item));
    queryClient.invalidateQueries({ queryKey: getGetRsvpSummaryQueryKey() });
    setNotice(status === 'going' ? 'Você marcou: eu vou.' : status === 'maybe' ? 'Você marcou: talvez.' : 'Você marcou: não vou.');
    onDone?.();
  }});
  const options = [
    { status: GuestRsvpStatus.going, label: 'Vou', Icon: CheckCircle2, active: 'border-emerald-300/65 bg-emerald-500/25 text-emerald-100 shadow-[0_0_20px_rgba(52,211,153,.25)]', idle: 'hover:border-emerald-300/50 hover:bg-emerald-500/10', icon: 'text-emerald-300' },
    { status: GuestRsvpStatus.maybe, label: 'Talvez', Icon: HelpCircle, active: 'border-amber-300/65 bg-amber-500/25 text-amber-100 shadow-[0_0_20px_rgba(251,191,36,.22)]', idle: 'hover:border-amber-300/50 hover:bg-amber-500/10', icon: 'text-amber-300' },
    { status: GuestRsvpStatus.not_going, label: 'Não vou', Icon: XCircle, active: 'border-red-300/65 bg-red-500/20 text-red-100', idle: 'hover:border-red-300/50 hover:bg-red-500/10', icon: 'text-red-300' },
  ];
  return <Card className="border-primary/20 bg-gradient-to-b from-card/80 to-background shadow-[0_0_30px_rgba(201,168,76,.05)]"><CardContent className="flex flex-col items-center space-y-6 p-6 text-center md:p-8"><div><h2 className="mb-2 text-2xl font-display font-semibold">Sua presença</h2><p className="mx-auto max-w-md text-muted-foreground">Confirma do seu jeito, sem pressão. A tripulação vai aparecendo aos poucos.</p></div><div className="grid w-full grid-cols-3 gap-2 sm:gap-4">{options.map(({ status, label, Icon, active, idle, icon }) => <Button key={status} size="lg" onClick={() => choose(status)} disabled={update.isPending} aria-pressed={current === status} className={cn('h-16 w-full px-1.5 text-xs font-semibold transition-all sm:px-2 sm:text-base', current === status ? `rsvp-selected ${active}` : `border border-white/10 bg-black/40 text-foreground ${idle}`)}><Icon className={cn('mr-1.5 h-5 w-5', icon, current === status && 'text-current')} />{label}</Button>)}</div>{notice && <div className="rsvp-notice flex w-full items-center justify-center gap-2 rounded-xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm text-primary"><Check className="h-4 w-4" />{notice}</div>}</CardContent></Card>;
}
