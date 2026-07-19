import { ChangeEvent, useEffect, useRef, useState } from 'react';
import { useLocation } from 'wouter';
import { Camera, Check, LoaderCircle, Save, UserRound } from 'lucide-react';
import { useSession } from '@/hooks/use-session';
import { avatarOptions } from '@/lib/avatar-options';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];

export default function Profile() {
  const { session, saveSession } = useSession();
  const [, setLocation] = useLocation();
  const [name, setName] = useState(session?.name ?? '');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(session?.avatarUrl ?? null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (!session) setLocation('/'); }, [session, setLocation]);
  if (!session) return null;

  const uploadAvatar = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!allowedTypes.includes(file.type) || file.size > 8 * 1024 * 1024) { setMessage('Use JPG, PNG, WebP ou HEIC de até 8 MB.'); return; }
    setIsUploading(true); setMessage(null);
    try {
      const signedResponse = await fetch('/api/photos/upload-url', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ guestId: session.id, contentType: file.type, purpose: 'avatar' }) });
      const signed = await signedResponse.json();
      if (!signedResponse.ok) throw new Error(signed.error ?? 'Não foi possível preparar a imagem.');
      const uploadResponse = await fetch(signed.uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type, 'x-upsert': 'false' }, body: file });
      if (!uploadResponse.ok) throw new Error('O envio falhou.');
      setAvatarUrl(signed.publicUrl);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível enviar a imagem.'); }
    finally { setIsUploading(false); }
  };

  const saveProfile = async () => {
    if (!name.trim()) return;
    setIsSaving(true); setMessage(null);
    try {
      const response = await fetch(`/api/guests/${session.id}/profile`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: name.trim(), avatarUrl }) });
      const guest = await response.json();
      if (!response.ok) throw new Error(guest.error ?? 'Não foi possível salvar.');
      saveSession({ id: guest.id, name: guest.name, avatarUrl: guest.avatarUrl });
      setMessage('Perfil salvo. Você está oficialmente pronto para o convés.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível salvar.'); }
    finally { setIsSaving(false); }
  };

  return <div className="panel-enter mx-auto max-w-xl space-y-7 pb-24">
    <section><p className="text-xs font-semibold uppercase tracking-[.2em] text-primary">Sua bandeira a bordo</p><h1 className="mt-2 text-3xl font-display font-bold">Perfil</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">Escolha um símbolo náutico ou use uma foto sua. É opcional, mas ajuda a reconhecer a tripulação.</p></section>
    <section className="glass-card rounded-3xl p-5 sm:p-7">
      <div className="flex items-center gap-4"><div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-3xl border border-primary/30 bg-secondary/40">{avatarUrl ? <img src={avatarUrl} alt="Seu avatar" className="h-full w-full object-cover" /> : <UserRound className="h-9 w-9 text-primary" />}</div><div><p className="font-display text-lg text-foreground">Seu sinal visual</p><p className="mt-1 text-sm text-muted-foreground">Não precisa colocar foto para usar o app.</p><Button type="button" variant="ghost" onClick={() => inputRef.current?.click()} disabled={isUploading} className="mt-2 h-9 px-0 text-primary hover:bg-transparent hover:text-[#ffe29b]">{isUploading ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Camera className="mr-2 h-4 w-4" />}{isUploading ? 'Enviando...' : 'Usar minha foto'}</Button></div></div>
      <input ref={inputRef} type="file" className="sr-only" accept="image/jpeg,image/png,image/webp,image/heic" onChange={uploadAvatar} />
      <label className="mt-7 block text-sm font-medium text-foreground">Como te chamamos?<Input value={name} onChange={(event) => setName(event.target.value)} className="mt-2 h-12 border-white/12 bg-black/30" maxLength={80} /></label>
      <div className="mt-7"><p className="text-sm font-medium text-foreground">Ou escolha seu símbolo</p><div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-6">{avatarOptions.map((avatar) => <button key={avatar.id} type="button" aria-label={`Escolher ${avatar.name}`} aria-pressed={avatarUrl === avatar.url} onClick={() => setAvatarUrl(avatar.url)} className={`relative aspect-square overflow-hidden rounded-2xl border transition-all ${avatarUrl === avatar.url ? 'border-primary ring-2 ring-primary/35' : 'border-white/10 hover:border-primary/55'}`}><img src={avatar.url} alt="" className="h-full w-full" />{avatarUrl === avatar.url && <span className="absolute inset-0 grid place-items-center bg-black/30"><Check className="h-5 w-5 text-[#ffe59a]" /></span>}</button>)}</div></div>
      {message && <p role="status" className="mt-5 rounded-xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm text-primary">{message}</p>}
      <Button type="button" onClick={saveProfile} disabled={!name.trim() || isSaving || isUploading} className="premium-cta shimmer mt-7 h-12 w-full border border-[#fff0b4]/60 bg-gradient-to-r from-[#ffe399] via-[#efbd4f] to-[#c87520] font-bold text-[#150d05]">{isSaving ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}{isSaving ? 'Salvando...' : 'Salvar perfil'}</Button>
    </section>
  </div>;
}
