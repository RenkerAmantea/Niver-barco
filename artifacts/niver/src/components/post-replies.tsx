import { FormEvent, useState } from 'react';
import { Anchor, CornerDownRight, Flame, Heart, Send, ThumbsUp } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useSession } from '@/hooks/use-session';
import { getListPostsQueryKey, getListRepliesQueryKey, Post, Reply, useCreateReply, useListGuests, useListReplies } from '@workspace/api-client-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ReactionPeopleDialog } from '@/components/reaction-people-dialog';

const reactionOptions = [{ key: 'heart', label: 'Coração', icon: Heart, color: 'fill-pink-400 text-pink-200' }, { key: 'thumb', label: 'Joinha', icon: ThumbsUp, color: 'fill-sky-400 text-sky-200' }, { key: 'fire', label: 'Fogo', icon: Flame, color: 'fill-orange-400 text-orange-100' }, { key: 'boat', label: 'Âncora', icon: Anchor, color: 'fill-sky-400 text-sky-100' }];

function ReplyReactionBar({ replyId, initial }: { replyId: number; initial: Array<{ emoji: string; guest_id: number }> }) {
  const { session } = useSession(); const { data: guests } = useListGuests(); const [reactions, setReactions] = useState(initial); const [peopleFor, setPeopleFor] = useState<string | null>(null);
  const toggle = async (emoji: string) => { if (!session?.id) return; const active = reactions.some((reaction) => reaction.emoji === emoji && reaction.guest_id === session.id); const response = await fetch(`/api/replies/${replyId}/reactions`, { method: active ? 'DELETE' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ guestId: session.id, emoji }) }); if (!response.ok) return; setReactions((current) => active ? current.filter((reaction) => !(reaction.emoji === emoji && reaction.guest_id === session.id)) : [...current, { emoji, guest_id: session.id }]); };
  const selected = reactionOptions.find((reaction) => reaction.key === peopleFor);
  return <><div className="mt-2 flex items-center gap-1">{reactionOptions.map(({ key, label, icon: Icon, color }) => { const count = reactions.filter((reaction) => reaction.emoji === key).length; const active = reactions.some((reaction) => reaction.emoji === key && reaction.guest_id === session?.id); return <div key={key} className={`inline-flex h-7 items-center ${count > 0 ? color : 'text-white/35'}`}><button type="button" aria-label={`Reagir com ${label}`} aria-pressed={active} onClick={() => void toggle(key)} className="grid h-7 w-6 place-items-center rounded-md transition hover:bg-white/[.055] hover:text-white/75"><Icon className={`h-3.5 w-3.5 ${count > 0 ? 'fill-current' : ''}`} /></button>{count > 0 && <button type="button" onClick={() => setPeopleFor(key)} aria-label={`Ver quem reagiu com ${label}`} className="pr-1 text-[10px] font-semibold transition-opacity hover:opacity-75">{count}</button>}</div>; })}</div>{selected && <ReactionPeopleDialog open={Boolean(peopleFor)} onOpenChange={(open) => !open && setPeopleFor(null)} emoji={selected.key} label={selected.label} Icon={selected.icon} reactions={reactions} guests={guests} />}</>;
}

export function PostReplies({ postId, replyTo }: { postId: number; replyTo?: string }) {
  const { session } = useSession();
  const [content, setContent] = useState(replyTo ? `@${replyTo} ` : '');
  const { data: replies, isLoading } = useListReplies(postId, { query: { enabled: !!postId, queryKey: getListRepliesQueryKey(postId) } });
  const { data: guests } = useListGuests();
  const createReply = useCreateReply();
  const queryClient = useQueryClient();
  const mentionMatch = content.match(/@([^\s]*)$/);
  const mentionChoices = mentionMatch ? (guests ?? []).filter((guest) => guest.name.toLowerCase().includes(mentionMatch[1].toLowerCase())).slice(0, 4) : [];
  const selectMention = (name: string) => setContent((current) => current.replace(/@[^\s]*$/, `@${name} `));
  const send = (event: FormEvent) => {
    event.preventDefault();
    if (!content.trim() || !session?.id) return;
    createReply.mutate({ postId, data: { guestId: session.id, content: content.trim() } }, { onSuccess: (newReply) => {
      setContent('');
      queryClient.setQueryData(getListRepliesQueryKey(postId), (old: Reply[] | undefined) => old ? [...old, newReply] : [newReply]);
      queryClient.setQueryData(getListPostsQueryKey(), (old: Post[] | undefined) => old?.map((post) => post.id === postId ? { ...post, replyCount: post.replyCount + 1 } : post));
    }});
  };
  if (isLoading) return <p className="pl-12 py-2 text-sm text-muted-foreground">Carregando respostas...</p>;
  return <div className="ml-3 space-y-4 border-l border-white/10 pl-5 pt-4 md:ml-6 md:pl-12">
    {replies?.map((reply) => <div key={reply.id} className="relative flex min-w-0 gap-2.5 md:gap-3">
      <CornerDownRight className="absolute -left-6 top-3 hidden h-4 w-4 text-white/10 md:block" />
      <Avatar className="h-8 w-8 shrink-0 border-primary/20">{reply.guestAvatarUrl && <AvatarImage src={reply.guestAvatarUrl} alt={reply.guestName} />}<AvatarFallback className="bg-secondary text-xs text-primary">{reply.guestName[0]?.toUpperCase()}</AvatarFallback></Avatar>
      <div className="min-w-0 flex-1 rounded-2xl rounded-tl-none border border-white/5 bg-black/30 px-3.5 py-2"><div className="mb-1 flex min-w-0 items-baseline justify-between gap-2"><span className="truncate text-sm font-medium text-foreground">{reply.guestName}</span><span className="shrink-0 whitespace-nowrap text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(reply.createdAt), { addSuffix: true, locale: ptBR })}</span></div><p className="whitespace-pre-wrap break-words text-sm text-foreground/90">{reply.content}</p><div className="mt-2 flex items-center justify-between gap-3"><button type="button" onClick={() => setContent(`@${reply.guestName} `)} className="text-xs font-medium text-primary/90 hover:text-primary">Responder</button><ReplyReactionBar replyId={reply.id} initial={(reply as Reply & { reactions?: Array<{ emoji: string; guest_id: number }> }).reactions ?? []} /></div></div>
    </div>)}
    <form onSubmit={send} className="relative mt-4 flex min-w-0 gap-2.5 md:gap-3"><CornerDownRight className="absolute -left-6 top-3 hidden h-4 w-4 text-white/10 md:block" /><Avatar className="h-8 w-8 shrink-0 border-primary/20">{session?.avatarUrl && <AvatarImage src={session.avatarUrl} alt={session.name} />}<AvatarFallback className="bg-secondary text-xs text-primary">{session?.name[0]?.toUpperCase()}</AvatarFallback></Avatar><div className="flex min-w-0 flex-1 gap-2"><Textarea value={content} onChange={(event) => setContent(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); send(event); } }} placeholder="Escreva uma resposta..." className="h-10 min-h-10 resize-none rounded-xl border-white/10 bg-black/40 py-2 text-sm focus-visible:ring-primary/50" />{mentionChoices.length > 0 && <div className="absolute bottom-12 left-10 z-20 w-56 overflow-hidden rounded-xl border border-white/12 bg-[#101126] shadow-2xl">{mentionChoices.map((guest) => <button key={guest.id} type="button" onClick={() => selectMention(guest.name)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-foreground hover:bg-white/5"><span className="grid h-6 w-6 place-items-center rounded-full bg-secondary text-xs text-primary">{guest.name[0]}</span>{guest.name}</button>)}</div>}<Button type="submit" size="icon" disabled={!content.trim() || createReply.isPending} className="h-10 w-10 shrink-0 rounded-xl border border-primary/30 bg-primary/20 text-primary hover:bg-primary/30 hover:text-primary-foreground"><Send className="h-4 w-4" /></Button></div></form>
  </div>;
}
