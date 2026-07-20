import { ChangeEvent, useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { useSession } from "@/hooks/use-session";
import { 
  useListPosts, 
  useCreatePost, 
  useListGuests,
  getListPostsQueryKey, 
  Post
} from "@workspace/api-client-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Anchor, Flame, Heart, ImagePlus, LoaderCircle, MessageSquare, Mic, Pause, Play, Square, ThumbsUp, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { PostReplies } from "@/components/post-replies";
import { ReactionPeopleDialog } from "@/components/reaction-people-dialog";

const photoMarker = '[[niver-photo:';
const audioMarker = '[[niver-audio:';

function splitPhotoPost(content: string) {
  if (!content.startsWith(photoMarker)) return null;
  const end = content.indexOf(']]');
  if (end < 0) return null;
  const [url, source = 'mural'] = content.slice(photoMarker.length, end).split('|');
  return { url, source, caption: content.slice(end + 2).trim() };
}
function splitAudioPost(content: string) { if (!content.startsWith(audioMarker)) return null; const end = content.indexOf(']]'); if (end < 0) return null; const [url, rawDuration] = content.slice(audioMarker.length, end).split('|'); return { url, durationMs: Number(rawDuration) || undefined, caption: content.slice(end + 2).trim() }; }

function formatAudioTime(milliseconds = 0) {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function useAudioWaveform(src: string) {
  const [bars, setBars] = useState<number[]>([]);
  useEffect(() => {
    let active = true;
    const context = new AudioContext();
    void fetch(src).then((response) => response.arrayBuffer()).then((buffer) => context.decodeAudioData(buffer)).then((audio) => {
      if (!active) return;
      const channel = audio.getChannelData(0); const count = 32; const step = Math.max(1, Math.floor(channel.length / count));
      setBars(Array.from({ length: count }, (_, index) => {
        let peak = 0; const start = index * step; const end = Math.min(channel.length, start + step);
        for (let cursor = start; cursor < end; cursor += 8) peak = Math.max(peak, Math.abs(channel[cursor]));
        return Math.max(16, Math.min(100, Math.round(peak * 180)));
      }));
    }).catch(() => { if (active) setBars([]); }).finally(() => void context.close());
    return () => { active = false; };
  }, [src]);
  return bars;
}

function AudioPlayer({ src, durationMs }: { src: string; durationMs?: number }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const waveform = useAudioWaveform(src);
  const fallbackDuration = durationMs ?? 0;
  const total = Math.max(fallbackDuration, elapsed, 1);
  const progress = Math.min(100, (elapsed / total) * 100);
  const bars = waveform.length ? waveform : Array.from({ length: 32 }, () => 30);
  const toggle = async () => {
    const audio = audioRef.current; if (!audio) return;
    if (playing) { audio.pause(); return; }
    if (durationMs && audio.currentTime * 1000 >= durationMs) audio.currentTime = 0;
    await audio.play();
  };
  return <div className="rounded-2xl border border-[#f9d98a]/20 bg-[#0d1024]/70 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,.06)]">
    <audio ref={audioRef} src={src} preload="metadata" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => { setPlaying(false); setElapsed(0); }} onTimeUpdate={(event) => { const next = event.currentTarget.currentTime * 1000; setElapsed(next); if (durationMs && next >= durationMs) { event.currentTarget.pause(); event.currentTarget.currentTime = 0; setElapsed(0); } }} />
    <div className="flex items-center gap-3">
      <button type="button" onClick={() => void toggle()} aria-label={playing ? 'Pausar áudio' : 'Reproduzir áudio'} className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[#ffe5a0]/55 bg-gradient-to-br from-[#ffe399] to-[#c87520] text-[#160e05] shadow-[0_0_18px_rgba(248,204,109,.18)] transition hover:brightness-110">{playing ? <Pause className="h-4 w-4 fill-current" /> : <Play className="ml-0.5 h-4 w-4 fill-current" />}</button>
      <div className="min-w-0 flex-1"><div className="flex h-8 items-center gap-[3px]" aria-hidden="true">{bars.map((height, index) => <span key={index} className="w-1 flex-1 rounded-full bg-[#f9d98a] transition-opacity" style={{ height: `${height}%`, opacity: index / bars.length * 100 < progress ? 1 : .28 }} />)}</div><div className="mt-1 flex justify-between text-[10px] font-medium tracking-wide text-white/45"><span>{formatAudioTime(elapsed)}</span><span>{durationMs ? formatAudioTime(durationMs) : 'áudio'}</span></div></div>
    </div>
  </div>;
}

export const reactionOptions = [
  { key: 'heart', label: 'Coração', icon: Heart, activeClass: 'text-[#ff66ad]', fillClass: 'fill-[#ff66ad]' },
  { key: 'thumb', label: 'Joinha', icon: ThumbsUp, activeClass: 'text-[#5bbcff]', fillClass: 'fill-[#5bbcff]' },
  { key: 'fire', label: 'Fogo', icon: Flame, activeClass: 'text-[#ff9b4a]', fillClass: 'fill-[#ff9b4a]' },
  { key: 'boat', label: 'Âncora', icon: Anchor, activeClass: 'text-[#63dce8]', fillClass: 'fill-[#63dce8]' },
];

function ReactionBar({ postId, compact = false }: { postId: number; compact?: boolean }) {
  const { session } = useSession();
  const { data: guests } = useListGuests();
  const [reactions, setReactions] = useState<Record<string, { count: number; reacted: boolean }>>({});
  const [reactionList, setReactionList] = useState<Array<{ emoji: string; guest_id: number }>>([]);
  const [peopleFor, setPeopleFor] = useState<string | null>(null);
  const load = async () => {
    const response = await fetch(`/api/posts/${postId}/reactions`);
    if (!response.ok) return;
    const data = await response.json();
    const mine = new Set((data.reactions ?? []).filter((item: { guest_id: number }) => item.guest_id === session?.id).map((item: { emoji: string }) => item.emoji));
    const next = Object.fromEntries(Object.entries(data.summary).map(([emoji, value]: [string, any]) => [emoji, { ...value, reacted: mine.has(emoji) }]));
    setReactions(next);
    setReactionList(data.reactions ?? []);
  };
  useEffect(() => { void load(); }, [postId, session?.id]);
  const toggle = async (emoji: string) => {
    if (!session?.id) return;
    const active = reactions[emoji]?.reacted;
    const response = await fetch(`/api/posts/${postId}/reactions`, { method: active ? 'DELETE' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ guestId: session.id, emoji }) });
    if (!response.ok) return;
    void load();
  };
  const selected = reactionOptions.find((reaction) => reaction.key === peopleFor);
  return <><div className={cn("flex items-center gap-1", !compact && "flex-wrap pt-3")}>{reactionOptions.map(({ key, label, icon: Icon, activeClass, fillClass }) => {
    const active = reactions[key]?.reacted;
    const count = reactions[key]?.count ?? 0;
    return <div key={key} className={cn("inline-flex h-8 items-center", count > 0 ? activeClass : "text-white/35")}><button type="button" onClick={() => void toggle(key)} aria-label={`Reagir com ${label}`} aria-pressed={active} className="grid h-8 w-7 cursor-pointer place-items-center rounded-lg transition-opacity hover:opacity-75"><Icon className={cn("h-4 w-4", count > 0 && fillClass)} /></button>{count > 0 && <button type="button" onClick={() => setPeopleFor(key)} aria-label={`Ver quem reagiu com ${label}`} className="min-w-4 pr-1 text-left text-[11px] font-semibold transition-opacity hover:opacity-75">{count}</button>}</div>;
  })}</div>{selected && <ReactionPeopleDialog open={Boolean(peopleFor)} onOpenChange={(open) => !open && setPeopleFor(null)} emoji={selected.key} label={selected.label} Icon={selected.icon} reactions={reactionList} guests={guests} />}</>;
}

export default function Forum() {
  const { session } = useSession();
  const [, setLocation] = useLocation();
  const [content, setContent] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [expandedPostId, setExpandedPostId] = useState<number | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioPreview, setAudioPreview] = useState<string | null>(null);
  const [audioDurationMs, setAudioDurationMs] = useState<number | null>(null);
  const [recording, setRecording] = useState(false);
  const [liveWaveform, setLiveWaveform] = useState<number[]>([]);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordingStartedAtRef = useRef<number>(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const waveformFrameRef = useRef<number | null>(null);

  const { data: posts, isLoading: isLoadingPosts } = useListPosts();
  const { data: guests } = useListGuests();
  const createPost = useCreatePost();
  const queryClient = useQueryClient();
  const mentionMatch = content.match(/@([^\s]*)$/);
  const mentionChoices = mentionMatch ? (guests ?? []).filter((guest) => guest.name.toLowerCase().includes(mentionMatch[1].toLowerCase())).slice(0, 4) : [];
  const selectMention = (name: string) => setContent((current) => current.replace(/@[^\s]*$/, `@${name} `));

  useEffect(() => {
    if (!session) {
      setLocation("/");
    }
  }, [session, setLocation]);

  if (!session) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!content.trim() && !photoUrl && !audioBlob) || !session?.id) return;
    let audioUrl: string | null = null;
    if (audioBlob) {
      const audioType = (audioBlob.type || 'audio/webm').split(';', 1)[0];
      const signedResponse = await fetch('/api/photos/upload-url', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ guestId: session.id, contentType: audioType, purpose: 'audio' }) });
      const signed = await signedResponse.json(); if (!signedResponse.ok) { setPhotoError(signed.error ?? 'Não foi possível preparar o áudio.'); return; }
      const upload = await fetch(signed.uploadUrl, { method: 'PUT', headers: { 'Content-Type': audioType, 'x-upsert': 'false' }, body: audioBlob }); if (!upload.ok) { setPhotoError('O envio do áudio falhou.'); return; } audioUrl = signed.publicUrl;
    }

    createPost.mutate(
      { data: { guestId: session.id, content: photoUrl ? `${photoMarker}${photoUrl}|mural]]${content.trim()}` : audioUrl ? `${audioMarker}${audioUrl}|${audioDurationMs ?? 0}]]${content.trim()}` : content.trim() } },
      {
        onSuccess: (newPost) => {
          setContent("");
          setPhotoUrl(null);
          if (audioPreview) URL.revokeObjectURL(audioPreview); setAudioBlob(null); setAudioPreview(null); setAudioDurationMs(null);
          queryClient.setQueryData(getListPostsQueryKey(), (old: Post[] | undefined) => {
            return old ? [newPost, ...old] : [newPost];
          });
        }
      }
    );
  };

  const toggleRecording = async () => {
    if (recording && recorderRef.current) { recorderRef.current.stop(); return; }
    try { const stream = await navigator.mediaDevices.getUserMedia({ audio: true }); const recorder = new MediaRecorder(stream); const context = new AudioContext(); const analyser = context.createAnalyser(); analyser.fftSize = 128; context.createMediaStreamSource(stream).connect(analyser); const frequencies = new Uint8Array(analyser.frequencyBinCount); const drawWaveform = () => { analyser.getByteFrequencyData(frequencies); const pieces = 24; const step = Math.max(1, Math.floor(frequencies.length / pieces)); setLiveWaveform(Array.from({ length: pieces }, (_, index) => { let total = 0; for (let cursor = index * step; cursor < Math.min(frequencies.length, (index + 1) * step); cursor++) total += frequencies[cursor]; return Math.max(14, Math.min(100, Math.round(total / step / 2.55))); })); waveformFrameRef.current = requestAnimationFrame(drawWaveform); }; drawWaveform(); audioContextRef.current = context; const chunks: BlobPart[] = []; recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); }; recorder.onstop = () => { if (waveformFrameRef.current) cancelAnimationFrame(waveformFrameRef.current); waveformFrameRef.current = null; void context.close(); audioContextRef.current = null; stream.getTracks().forEach(track => track.stop()); const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' }); const duration = Math.max(500, Date.now() - recordingStartedAtRef.current); if (blob.size > 8 * 1024 * 1024) { setPhotoError('O áudio ficou maior que 8 MB. Grave algo mais curto.'); } else { setAudioBlob(blob); setAudioDurationMs(duration); setAudioPreview(URL.createObjectURL(blob)); } setLiveWaveform([]); setRecording(false); }; recordingStartedAtRef.current = Date.now(); recorder.start(); recorderRef.current = recorder; setRecording(true); setPhotoError(null); } catch { setPhotoError('Não foi possível acessar o microfone. Libere a permissão e tente de novo.'); }
  };

  const handlePhotoSelect = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !session?.id) return;
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/heic'].includes(file.type) || file.size > 8 * 1024 * 1024) {
      setPhotoError('Use JPG, PNG, WebP ou HEIC de até 8 MB.');
      return;
    }
    setIsUploadingPhoto(true); setPhotoError(null);
    try {
      const signedResponse = await fetch('/api/photos/upload-url', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ guestId: session.id, contentType: file.type }) });
      const signed = await signedResponse.json();
      if (!signedResponse.ok) throw new Error(signed.error ?? 'Não foi possível preparar a foto.');
      const uploadResponse = await fetch(signed.uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type, 'x-upsert': 'false' }, body: file });
      if (!uploadResponse.ok) throw new Error('O envio falhou. Tente novamente.');
      setPhotoUrl(signed.publicUrl);
    } catch (error) {
      setPhotoError(error instanceof Error ? error.message : 'Não foi possível enviar a foto.');
    } finally { setIsUploadingPhoto(false); }
  };

  const toggleReplies = (postId: number) => {
    setExpandedPostId(prev => prev === postId ? null : postId);
  };

  return (
    <div className="panel-enter forum-page mx-auto w-full max-w-3xl space-y-7 pb-12">
      
      <div className="mb-6">
        <h2 className="text-2xl font-display font-semibold">Mural do Evento</h2>
        <p className="text-muted-foreground text-sm mt-1">Deixe sua mensagem, combine caronas ou apenas comemore antecipadamente.</p>
      </div>

      {/* New Post Form */}
      <Card className="border-primary/20 bg-card/80 shadow-[0_0_20px_rgba(201,168,76,0.05)]">
        <CardContent className="p-4 sm:p-6">
          <form onSubmit={handleSubmit} className="flex min-w-0 gap-3 sm:gap-4">
            <Avatar className="h-10 w-10 border-primary/20 hidden sm:flex shrink-0">
              {session.avatarUrl ? <AvatarImage src={session.avatarUrl} alt={session.name} /> : null}
              <AvatarFallback className="bg-secondary text-primary">
                {session.name.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-3">
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={`No que você está pensando, ${session.name.split(' ')[0]}?`}
                className="forum-composer bg-black/25 border-white/10 text-base leading-relaxed focus-visible:ring-primary/50 resize-y min-h-[108px]"
              />
              {mentionChoices.length > 0 && <div className="relative z-20 -mt-2 w-full max-w-xs overflow-hidden rounded-xl border border-white/12 bg-[#101126] shadow-2xl">{mentionChoices.map((guest) => <button key={guest.id} type="button" onClick={() => selectMention(guest.name)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-foreground hover:bg-white/5"><span className="grid h-6 w-6 place-items-center rounded-full bg-secondary text-xs text-primary">{guest.name[0]}</span>{guest.name}</button>)}</div>}
              <input ref={photoInputRef} className="sr-only" type="file" accept="image/jpeg,image/png,image/webp,image/heic" onChange={handlePhotoSelect} />
              {photoUrl && <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/30"><img src={photoUrl} alt="Prévia da foto a publicar" className="max-h-64 w-full object-cover" /><button type="button" onClick={() => setPhotoUrl(null)} className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-black/65 text-white hover:bg-black"><X className="h-4 w-4" /></button></div>}
              {recording && <div className="flex items-center gap-3 rounded-2xl border border-red-300/25 bg-red-500/[.08] p-3"><span className="relative grid h-9 w-9 shrink-0 place-items-center rounded-full bg-red-500/20 text-red-200"><span className="absolute inset-0 animate-ping rounded-full bg-red-400/25" /><Mic className="relative h-4 w-4" /></span><div className="flex h-7 flex-1 items-center gap-1" aria-label="Gravando áudio">{(liveWaveform.length ? liveWaveform : Array.from({ length: 24 }, () => 14)).map((height, index) => <span key={index} className="w-1 flex-1 rounded-full bg-red-300/85 transition-[height] duration-75" style={{ height: `${height}%` }} />)}</div><span className="text-xs font-semibold text-red-100">Gravando</span></div>}
              {audioPreview && <div className="relative"><AudioPlayer src={audioPreview} durationMs={audioDurationMs ?? undefined} /><button type="button" aria-label="Remover áudio" onClick={() => { URL.revokeObjectURL(audioPreview); setAudioBlob(null); setAudioPreview(null); setAudioDurationMs(null); }} className="absolute -right-2 -top-2 grid h-7 w-7 place-items-center rounded-full border border-white/15 bg-[#101126] text-white/65 shadow-lg transition hover:text-white"><X className="h-3.5 w-3.5" /></button></div>}
              {photoError && <p className="text-sm text-red-200">{photoError}</p>}
              <div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-1">
                <Button type="button" variant="ghost" onClick={() => photoInputRef.current?.click()} disabled={isUploadingPhoto || recording} className="text-muted-foreground hover:bg-white/5 hover:text-primary">{isUploadingPhoto ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <ImagePlus className="mr-2 h-4 w-4" />} Foto</Button>
                <Button type="button" variant="ghost" size="icon" title={recording ? 'Parar gravação' : 'Gravar áudio'} aria-label={recording ? 'Parar gravação' : 'Gravar áudio'} onClick={() => void toggleRecording()} disabled={isUploadingPhoto} className={cn('h-10 w-10 shrink-0', recording ? 'text-red-200 hover:bg-red-500/10' : 'text-muted-foreground hover:bg-white/5 hover:text-primary')} >{recording ? <Square className="h-4 w-4 fill-current" /> : <Mic className="h-4 w-4" />}</Button></div>
                <Button 
                  type="submit" 
                  disabled={(!content.trim() && !photoUrl && !audioBlob) || createPost.isPending || isUploadingPhoto || recording}
                  className="premium-cta shimmer border border-[#fff0b4]/60 bg-gradient-to-r from-[#ffe399] via-[#efbd4f] to-[#c87520] px-8 font-bold text-[#150d05] hover:brightness-110"
                >
                  {createPost.isPending ? "Publicando..." : "Publicar"}
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Posts Feed */}
      <div className="space-y-6">
        {isLoadingPosts ? (
          <div className="space-y-6">
            {[1, 2].map(i => (
            <Card key={i} className="bg-black/20 border-white/5 animate-pulse">
                <CardContent className="p-6">
                  <div className="flex gap-4 mb-4">
                    <div className="h-12 w-12 rounded-full bg-white/5" />
                    <div className="space-y-2 flex-1 pt-1">
                      <div className="h-4 w-32 bg-white/5 rounded" />
                      <div className="h-3 w-20 bg-white/5 rounded" />
                    </div>
                  </div>
                  <div className="h-16 w-full bg-white/5 rounded" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : posts?.length === 0 ? (
          <div className="text-center py-16 px-4 bg-black/10 rounded-xl border border-white/5">
            <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-1">Nenhuma mensagem ainda</h3>
            <p className="text-muted-foreground text-sm">Seja o primeiro a escrever no mural!</p>
          </div>
        ) : (
          posts?.map((post) => (
            <Card key={post.id} id={`post-${post.id}`} className="forum-post bg-black/20 border-white/5 overflow-hidden transition-all hover:border-white/10">
              <CardContent className="p-4 sm:p-6 pb-4">
                <div className="flex min-w-0 gap-3 sm:gap-4">
                  <Avatar className="h-12 w-12 border-primary/20 shrink-0">
                    {post.guestAvatarUrl ? <AvatarImage src={post.guestAvatarUrl} alt={post.guestName} /> : null}
                    <AvatarFallback className="bg-secondary text-primary">
                      {post.guestName.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between mb-2">
                      <div className="flex min-w-0 items-center gap-2"><h4 className="font-medium text-foreground text-base truncate">{post.guestName}</h4>{(() => { const status = (post as Post & { rsvpStatus?: string }).rsvpStatus; const tag = status === 'going' ? ['Vou', 'bg-emerald-500/18 text-emerald-200 border-emerald-300/30'] : status === 'maybe' ? ['Talvez', 'bg-amber-500/18 text-amber-100 border-amber-300/30'] : status === 'not_going' ? ['Não vou', 'bg-red-500/18 text-red-100 border-red-300/30'] : null; return tag && <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold ${tag[1]}`}>{tag[0]}</span>; })()}</div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                        {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true, locale: ptBR })}
                      </span>
                    </div>
                    {(() => { const photo = splitPhotoPost(post.content); const audio = splitAudioPost(post.content); return photo ? <div className="space-y-3"><img src={photo.url} alt={`Foto publicada por ${post.guestName}`} className="max-h-[32rem] w-full rounded-2xl border border-white/10 object-cover" />{photo.caption && <p className="text-foreground/90 whitespace-pre-wrap break-words leading-relaxed text-[15px]">{photo.caption}</p>}</div> : audio ? <div className="space-y-3"><AudioPlayer src={audio.url} durationMs={audio.durationMs} />{audio.caption && <p className="text-foreground/90 whitespace-pre-wrap break-words leading-relaxed text-[15px]">{audio.caption}</p>}</div> : <p className="text-foreground/90 whitespace-pre-wrap break-words leading-relaxed text-[15px]">{post.content}</p>; })()}
                    
                    <div className="mt-4 flex items-center justify-between gap-2 border-t border-white/5 pt-3">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => toggleReplies(post.id)}
                        className={cn(
                          "text-muted-foreground hover:text-primary hover:bg-primary/10 -ml-2",
                          expandedPostId === post.id && "text-primary bg-primary/10"
                        )}
                      >
                        <MessageSquare className="h-4 w-4 mr-2" />
                        {post.replyCount}
                      </Button>
                      <ReactionBar postId={post.id} compact />
                    </div>
                  </div>
                </div>

                {expandedPostId === post.id && (
                  <div className="mt-2 animate-in slide-in-from-top-2 duration-300">
                    <PostReplies postId={post.id} />
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

    </div>
  );
}
