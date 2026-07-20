import { ChangeEvent, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'wouter';
import { Camera, Check, LoaderCircle, LogOut, Save, UserRound, X, ZoomIn, ZoomOut, Smartphone } from 'lucide-react';
import { useSession } from '@/hooks/use-session';
import { avatarAccents, avatarOptions, makeAvatar } from '@/lib/avatar-options';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PushControls } from '@/components/push-controls';

const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];

export default function Profile() {
  const { session, saveSession, clearSession } = useSession();
  const [location, setLocation] = useLocation();
  const [name, setName] = useState(session?.name ?? '');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(session?.avatarUrl ?? null);
  const [avatarId, setAvatarId] = useState('star');
  const [avatarAccent, setAvatarAccent] = useState('original');
  const [crop, setCrop] = useState<{ src: string; width: number; height: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ x: number; y: number; offsetX: number; offsetY: number } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [confirmLogout, setConfirmLogout] = useState(false);

  useEffect(() => { if (!session) setLocation('/'); }, [session, setLocation]);
  useEffect(() => {
    if (!location.endsWith('#notificacoes')) return;
    const timer = window.setTimeout(() => {
      document.getElementById('notificacoes')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 80);
    return () => window.clearTimeout(timer);
  }, [location]);
  if (!session) return null;

  const selectAvatarPhoto = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!allowedTypes.includes(file.type) || file.size > 16 * 1024 * 1024) { setMessage('Use JPG, PNG ou WebP de até 16 MB.'); return; }
    setMessage(null);
    try {
      const src = URL.createObjectURL(file);
      const image = new Image();
      await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error('Não conseguimos abrir essa imagem.')); image.src = src; });
      setCrop({ src, width: image.naturalWidth, height: image.naturalHeight }); setZoom(1); setOffset({ x: 0, y: 0 });
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível abrir a imagem.'); }
  };

  const uploadCroppedAvatar = async () => {
    if (!crop) return;
    setIsUploading(true); setMessage(null);
    try {
      const image = new Image();
      await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error('Não conseguimos preparar a imagem.')); image.src = crop.src; });
      const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 512;
      const context = canvas.getContext('2d'); if (!context) throw new Error('Não foi possível preparar o recorte.');
      const base = Math.max(512 / crop.width, 512 / crop.height); const scale = base * zoom;
      context.drawImage(image, (512 - crop.width * scale) / 2 + offset.x * (512 / 280), (512 - crop.height * scale) / 2 + offset.y * (512 / 280), crop.width * scale, crop.height * scale);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.86));
      if (!blob) throw new Error('Não foi possível comprimir a imagem.');
      const signedResponse = await fetch('/api/photos/upload-url', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ guestId: session.id, contentType: 'image/jpeg', purpose: 'avatar' }) });
      const signed = await signedResponse.json();
      if (!signedResponse.ok) throw new Error(signed.error ?? 'Não foi possível preparar a imagem.');
      const uploadResponse = await fetch(signed.uploadUrl, { method: 'PUT', headers: { 'Content-Type': 'image/jpeg', 'x-upsert': 'false' }, body: blob });
      if (!uploadResponse.ok) throw new Error('O envio falhou.');
      const profileResponse = await fetch(`/api/guests/${session.id}/profile`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: name.trim() || session.name, avatarUrl: signed.publicUrl }) });
      const guest = await profileResponse.json();
      if (!profileResponse.ok) throw new Error(guest.error ?? 'A foto subiu, mas não conseguimos salvar o perfil.');
      setAvatarUrl(guest.avatarUrl); saveSession({ id: guest.id, name: guest.name, avatarUrl: guest.avatarUrl }); URL.revokeObjectURL(crop.src); setCrop(null); setMessage('Foto de perfil salva. Ela já aparece no mural.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível enviar a imagem.'); }
    finally { setIsUploading(false); }
  };

  const cropBase = crop ? Math.max(280 / crop.width, 280 / crop.height) * zoom : 1;

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
      <input ref={inputRef} type="file" className="sr-only" accept="image/jpeg,image/png,image/webp" onChange={selectAvatarPhoto} />
      <label className="mt-7 block text-sm font-medium text-foreground">Como te chamamos?<Input value={name} onChange={(event) => setName(event.target.value)} className="mt-2 h-12 border-white/12 bg-black/30" maxLength={80} /></label>
      <div className="mt-7"><p className="text-sm font-medium text-foreground">Escolha seu símbolo</p><div className="mt-3 grid grid-cols-4 gap-3 sm:grid-cols-6">{avatarOptions.map((avatar) => <button key={avatar.id} type="button" aria-label={`Escolher ${avatar.name}`} onClick={() => { setAvatarId(avatar.id); setAvatarUrl(makeAvatar(avatar.id, avatarAccent)); }} className={`relative aspect-square overflow-hidden rounded-2xl border transition-all ${avatarId === avatar.id ? 'border-primary ring-2 ring-primary/35' : 'border-white/10 hover:border-primary/55'}`}><img src={makeAvatar(avatar.id, avatarAccent)} alt="" className="h-full w-full" />{avatarId === avatar.id && <span className="absolute inset-0 grid place-items-center bg-black/30"><Check className="h-5 w-5 text-[#ffe59a]" /></span>}</button>)}</div><p className="mt-6 text-sm font-medium text-foreground">Realce discreto</p><div className="mt-3 flex flex-wrap gap-3">{avatarAccents.map((accent) => <button key={accent.id} type="button" aria-label={`Escolher realce ${accent.label}`} onClick={() => { setAvatarAccent(accent.id); setAvatarUrl(makeAvatar(avatarId, accent.id)); }} className={`h-10 min-w-10 rounded-full border-2 px-3 text-xs font-medium transition ${avatarAccent === accent.id ? 'border-white ring-2 ring-primary/45' : 'border-white/15'}`} style={{ backgroundColor: accent.id === 'original' ? '#28213c' : accent.color, color: accent.id === 'original' ? '#f8cc6d' : '#191126' }}>{accent.label}</button>)}</div><p className="mt-2 text-xs leading-5 text-muted-foreground">O símbolo mantém a sua paleta própria; o realce muda apenas um detalhe.</p></div>
      {message && <p role="status" className="mt-5 rounded-xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm text-primary">{message}</p>}
      <Button type="button" onClick={saveProfile} disabled={!name.trim() || isSaving || isUploading} className="premium-cta shimmer mt-7 h-12 w-full border border-[#fff0b4]/60 bg-gradient-to-r from-[#ffe399] via-[#efbd4f] to-[#c87520] font-bold text-[#150d05]">{isSaving ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}{isSaving ? 'Salvando...' : 'Salvar perfil'}</Button>
    </section>
    <PushControls />
    <button type="button" onClick={() => { localStorage.removeItem('niver_ios_install_seen'); window.dispatchEvent(new Event('niver:open-ios-install-guide')); }} className="mt-3 flex min-h-11 items-center gap-2 text-sm font-medium text-[#ffe29b] transition hover:text-[#fff0c8]"><Smartphone className="h-4 w-4" />Como instalar no iPhone</button>
    <section className="rounded-3xl border border-red-300/15 bg-red-500/[.04] p-5"><p className="font-display text-lg text-foreground">Encerrar sessão</p><p className="mt-1 text-sm text-muted-foreground">Você poderá entrar de novo com seu nome e senha.</p><Button type="button" variant="outline" onClick={() => setConfirmLogout(true)} className="mt-4 border-red-300/25 text-red-200 hover:bg-red-500/10 hover:text-red-100"><LogOut className="mr-2 h-4 w-4" />Sair desta conta</Button></section>
    {confirmLogout && createPortal(<div className="fixed inset-0 z-[120] grid place-items-center bg-[#050617]/80 p-4 backdrop-blur-sm"><div role="dialog" aria-modal="true" aria-labelledby="logout-title" className="w-full max-w-sm rounded-3xl border border-white/15 bg-[#101126] p-6 shadow-[0_24px_70px_rgba(0,0,0,.58)]"><span className="grid h-11 w-11 place-items-center rounded-2xl border border-red-300/20 bg-red-500/10 text-red-200"><LogOut className="h-5 w-5" /></span><h2 id="logout-title" className="mt-4 font-display text-xl text-[#fff0c8]">Sair da conta?</h2><p className="mt-2 text-sm leading-6 text-white/55">Seu perfil continua salvo. Para voltar, use seu nome e senha.</p><div className="mt-6 flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setConfirmLogout(false)}>Cancelar</Button><Button type="button" onClick={() => { clearSession(); setLocation('/'); }} className="border border-red-300/30 bg-red-500/20 text-red-100 hover:bg-red-500/30">Sair</Button></div></div></div>, document.body)}
    {crop && <div className="fixed inset-0 z-[90] grid place-items-center bg-black/80 p-4 backdrop-blur-sm"><div className="w-full max-w-sm rounded-3xl border border-white/15 bg-[#101126] p-5 shadow-2xl"><div className="flex items-start justify-between gap-4"><div><h2 className="font-display text-xl text-foreground">Ajustar sua foto</h2><p className="mt-1 text-sm leading-5 text-muted-foreground">Arraste para enquadrar. Ela será salva como um avatar leve.</p></div><button type="button" aria-label="Cancelar recorte" onClick={() => { URL.revokeObjectURL(crop.src); setCrop(null); }} className="grid h-10 w-10 place-items-center rounded-full border border-white/10 text-foreground hover:bg-white/5"><X className="h-5 w-5" /></button></div><div className="relative mx-auto mt-5 h-[280px] w-[280px] touch-none overflow-hidden rounded-full border-2 border-primary/60 bg-black/40" onPointerDown={(event) => { dragRef.current = { x: event.clientX, y: event.clientY, offsetX: offset.x, offsetY: offset.y }; event.currentTarget.setPointerCapture(event.pointerId); }} onPointerMove={(event) => { if (dragRef.current) setOffset({ x: dragRef.current.offsetX + event.clientX - dragRef.current.x, y: dragRef.current.offsetY + event.clientY - dragRef.current.y }); }} onPointerUp={() => { dragRef.current = null; }}><img src={crop.src} alt="Prévia do recorte de avatar" draggable={false} className="pointer-events-none absolute left-1/2 top-1/2 max-w-none select-none" style={{ width: crop.width * cropBase, height: crop.height * cropBase, transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))` }} /></div><div className="mt-5 flex items-center gap-3 text-primary"><ZoomOut className="h-4 w-4" /><input aria-label="Aumentar ou diminuir o zoom da foto" type="range" min="1" max="3" step="0.05" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} className="w-full accent-[#f8cc6d]" /><ZoomIn className="h-4 w-4" /></div><Button type="button" onClick={() => void uploadCroppedAvatar()} disabled={isUploading} className="premium-cta shimmer mt-5 h-12 w-full border border-[#fff0b4]/60 bg-gradient-to-r from-[#ffe399] via-[#efbd4f] to-[#c87520] font-bold text-[#150d05]">{isUploading ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Camera className="mr-2 h-4 w-4" />}{isUploading ? 'Preparando foto...' : 'Usar este enquadramento'}</Button></div></div>}
  </div>;
}
