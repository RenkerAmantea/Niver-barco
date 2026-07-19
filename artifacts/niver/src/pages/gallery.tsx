import { ChangeEvent, useEffect, useRef, useState } from 'react';
import { useLocation } from 'wouter';
import { Camera, ImagePlus, LoaderCircle, UploadCloud } from 'lucide-react';
import { useSession } from '@/hooks/use-session';

type Photo = {
  id: string;
  path: string;
  url: string;
  createdAt: string | null;
  guestName: string;
  guestAvatarUrl: string | null;
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
      setMessage('Foto enviada. Ela já entrou para a tripulação.');
      await loadPhotos();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível enviar a foto.');
    } finally {
      setIsUploading(false);
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
          {photos.map((photo) => <figure key={photo.id} className="gallery-photo"><img src={photo.url} alt={`Foto enviada por ${photo.guestName}`} loading="lazy" /><figcaption><span>{photo.guestName}</span></figcaption></figure>)}
        </div>
      ) : (
        <div className="gallery-empty mt-6"><Camera className="mx-auto h-10 w-10 text-primary" /><h2>O convés ainda está sem flagrantes.</h2><p>Inaugura a galeria. A primeira foto pode ser sua.</p></div>
      )}
    </div>
  );
}
