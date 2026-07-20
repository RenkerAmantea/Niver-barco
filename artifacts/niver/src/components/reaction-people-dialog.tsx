import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Guest } from '@workspace/api-client-react';
import { LucideIcon } from 'lucide-react';

type Reaction = { emoji: string; guest_id: number };

export function ReactionPeopleDialog({
  open,
  onOpenChange,
  emoji,
  label,
  Icon,
  reactions,
  guests,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  emoji: string;
  label: string;
  Icon: LucideIcon;
  reactions: Reaction[];
  guests?: Guest[];
}) {
  const guestIds = [...new Set(reactions.filter((reaction) => reaction.emoji === emoji).map((reaction) => reaction.guest_id))];
  const people = guestIds.map((id) => guests?.find((guest) => guest.id === id)).filter((guest): guest is Guest => Boolean(guest));

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="glass-card w-[calc(100%-2rem)] max-w-sm gap-0 rounded-[28px] border-white/12 bg-[#101126]/95 p-5 text-foreground shadow-[0_24px_90px_rgba(0,0,0,.58)] backdrop-blur-2xl sm:rounded-[28px]">
      <DialogHeader className="items-center pr-7 text-center">
        <div className="mb-2 grid h-11 w-11 place-items-center rounded-full border border-primary/25 bg-primary/10 text-primary"><Icon className="h-5 w-5 fill-current" /></div>
        <DialogTitle className="font-display text-lg text-[#fff0c8]">Reações · {label}</DialogTitle>
        <DialogDescription className="text-xs text-white/55">{people.length === 1 ? '1 pessoa reagiu' : `${people.length} pessoas reagiram`}</DialogDescription>
      </DialogHeader>
      <div className="mt-5 max-h-[48vh] space-y-2 overflow-y-auto pr-1">
        {people.map((guest) => <div key={guest.id} className="flex items-center gap-3 rounded-2xl border border-white/[.06] bg-white/[.035] px-3 py-2.5">
          <Avatar className="h-9 w-9 border-primary/20"><AvatarImage src={guest.avatarUrl ?? undefined} alt={guest.name} /><AvatarFallback className="bg-secondary text-sm text-primary">{guest.name[0]?.toUpperCase()}</AvatarFallback></Avatar>
          <span className="min-w-0 truncate font-medium text-foreground">{guest.name}</span>
        </div>)}
        {guestIds.length > 0 && people.length === 0 && <p className="py-4 text-center text-sm text-white/55">Carregando quem reagiu…</p>}
      </div>
    </DialogContent>
  </Dialog>;
}
