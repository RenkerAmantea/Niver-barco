import { ChangeEvent, useEffect, useRef, useState } from 'react';
import { useLocation } from 'wouter';
import { Camera, ImagePlus, LoaderCircle, UploadCloud, X } from 'lucide-react';
import { useSession } from '@/hooks/use-session';
import { PostReplies } from '@/components/post-replies';

type Photo = {
  id: string;
  path: string;
  url: string;
  createdAt: string | null;
  guestName: string;
  guestAvatarUrl: string | null;
  source: 'mural' | 'album';
  postId: number | null;
  caption: string;
};

const acceptedTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic']);
const maxFileSize = 8 * 1024 * 1024;

export default function Gallery() {
  const { session } = useSession();
  const [, setLocation] = useLocation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [selected, setSelected] = useState<Photo | null>(null);

  const loadPhotos = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/photos');
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'Não foi possível carregar a galeria.');
      setPhotos(data);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível carregar a galeria.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!session) setLocation('/');
    else void loadPhotos();
  }, [session, setLocation]);

  if (!session) return null;

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!acceptedTypes.has(file.type)) {
      setMessage('Use uma foto JPG, PNG, WebP ou HEIC.');
      return;
    }
    if (file.size > maxFileSize) {
      setMessage('Essa foto passa de 8 MB. Escolha uma versão menor.');
      return;
    }
    setIsUploading(true);
    setMessage(null);
    try {
      const signedResponse = await fetch('/api/photos/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guestId: session.id, contentType: file.type }),
      });
      const signed = await signedResponse.json();
      if (!signedResponse.ok) throw new Error(signed.error ?? 'Não foi possível preparar o upload.');
      const uploadResponse = await fetch(signed.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type, 'x-upsert': 'false' },
        body: file,
      });
      if (!uploadResponse.ok) throw new Error('O envio falhou. Tente de novo em alguns segundos.');
      const postResponse = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guestId: session.id, content: `[[niver-photo:${signed.publicUrl}|album]]` }),
      });
      const post = await postResponse.json();
      if (!postResponse.ok) throw new Error(post.error ?? 'A foto subiu, mas não conseguimos abrir os comentários ainda.');
      setMessage('Foto enviada. Ela também ganhou espaço no mural para comentários.');
      await loadPhotos();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível enviar a foto.');
    } finally {
      setIsUploading(false);
    }
  };

  const openLegacyDiscussion = async () => {
    if (!selected || !session?.id) return;
    setMessage(null);
    try {
      const response = await fetch('/api/posts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ guestId: session.id, content: `[[niver-photo:${selected.url}|album]]${selected.caption ?? ''}` }) });
      const post = await response.json();
      if (!response.ok) throw new Error(post.error ?? 'Não foi possível abrir a conversa desta foto.');
      const next = { ...selected, source: 'album' as const, postId: post.id };
      setSelected(next);
      setPhotos((current) => current.map((photo) => photo.id === selected.id ? next : photo));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível abrir a conversa desta foto.');
    }
  };

  return (
    <div className="panel-enter gallery-page pb-24">
      <section className="mb-6 flex items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[.18em] text-primary">Memórias a bordo</p>
          <h1 className="mt-2 text-3xl font-display font-bold">Fotos da noite</h1>
          <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">Manda a foto boa. A comprometedoramente boa também.</p>
        </div>
        <span className="gallery-counter">{photos.length} {photos.length === 1 ? 'foto' : 'fotos'}</span>
      </section>

      <input ref={inputRef} className="sr-only" type="file" accept="image/jpeg,image/png,image/webp,image/heic" onChange={handleFile} />
      <button type="button" onClick={() => inputRef.current?.click()} disabled={isUploading} className="upload-deck w-full cursor-pointer text-left disabled:cursor-wait" aria-label="Enviar uma foto">
        <span className="upload-deck-icon">{isUploading ? <LoaderCircle className="h-6 w-6 animate-spin" /> : <UploadCloud className="h-6 w-6" />}</span>
        <span className="min-w-0 flex-1"><strong>{isUploading ? 'Enviando sua foto...' : 'Enviar uma foto'}</strong><small>JPG, PNG, WebP ou HEIC · até 8 MB</small></span>
        <ImagePlus className="h-5 w-5 opacity-70" />
      </button>

      {message && <p role="status" className="gallery-status mt-4">{message}</p>}

      {isLoading ? (
        <div className="gallery-grid mt-6" aria-label="Carregando fotos">{[1, 2, 3, 4].map((item) => <div key={item} className="gallery-skeleton animate-pulse" />)}</div>
      ) : photos.length ? (
        <div className="gallery-grid mt-6">
          {photos.map((photo) => <button key={photo.id} type="button" onClick={() => setSelected(photo)} className="gallery-photo cursor-zoom-in text-left"><img src={photo.url} alt={`Foto enviada por ${photo.guestName}`} loading="lazy" /><figcaption><span>{photo.guestName}</span></figcaption></button>)}
        </div>
      ) : (
        <div className="gallery-empty mt-6"><Camera className="mx-auto h-10 w-10 text-primary" /><h2>O convés ainda está sem flagrantes.</h2><p>Inaugura a galeria. A primeira foto pode ser sua.</p></div>
      )}
      {selected && <div className="fixed inset-0 z-[80] grid place-items-center bg-black/80 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Foto ampliada" onClick={() => setSelected(null)}><div className="relative max-h-full w-full max-w-xl overflow-auto rounded-3xl border border-white/15 bg-[#101126] p-3" onClick={(event) => event.stopPropagation()}><button type="button" onClick={() => setSelected(null)} className="absolute right-5 top-5 z-10 grid h-9 w-9 place-items-center rounded-full bg-black/65 text-white"><X className="h-5 w-5" /></button><img src={selected.url} alt={`Foto enviada por ${selected.guestName}`} className="max-h-[56vh] w-full rounded-2xl object-contain" /><div className="p-3"><p className="font-display text-lg text-foreground">{selected.guestName}</p>{selected.caption && <p className="mt-1 text-sm leading-6 text-foreground/90">{selected.caption}</p>}<div className="mt-2 flex items-center justify-between gap-3"><p className="text-sm text-muted-foreground">{selected.source === 'mural' ? 'Publicada pelo mural.' : 'Enviada direto ao álbum.'}</p>{selected.postId && <a href={`/forum#post-${selected.postId}`} className="shrink-0 text-sm font-medium text-primary hover:text-primary/80">Ver no mural</a>}</div>{selected.postId ? <PostReplies postId={selected.postId} /> : <button type="button" onClick={() => void openLegacyDiscussion()} className="mt-5 w-full rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm font-medium text-primary hover:bg-primary/20">Abrir conversa desta foto</button>}</div></div></div>}
    </div>
  );
}
