import { useEffect, useState } from 'react';
import { useLocation, useRoute } from 'wouter';
import { ShipWheel } from 'lucide-react';
import { useSession } from '@/hooks/use-session';

export default function Invite() {
  const [, params] = useRoute('/i/:token');
  const [, setLocation] = useLocation();
  const { saveSession } = useSession();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = params?.token;
    if (!token) { setError('Este convite não está completo.'); return; }
    let active = true;
    void fetch(`/api/invites/${encodeURIComponent(token)}`)
      .then(async (response) => ({ response, data: await response.json() }))
      .then(({ response, data }) => {
        if (!active) return;
        if (!response.ok) throw new Error(data?.error || 'Este convite não está disponível.');
        saveSession({ id: data.id, name: data.name, avatarUrl: data.avatarUrl, isAdmin: Boolean(data.isAdmin), adminToken: data.isAdmin ? token : undefined });
        setLocation('/evento');
      })
      .catch((reason: Error) => active && setError(reason.message || 'Não foi possível abrir este convite.'));
    return () => { active = false; };
  }, [params?.token, saveSession, setLocation]);

  return <div className="flex min-h-[68vh] items-center justify-center px-2"><div className="glass-card w-full max-w-md rounded-3xl p-7 text-center"><ShipWheel className="mx-auto h-9 w-9 text-primary" />{error ? <><h1 className="mt-4 font-display text-2xl font-bold">Convite indisponível</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">{error}</p></> : <><h1 className="mt-4 font-display text-2xl font-bold">Preparando seu embarque</h1><p className="mt-2 text-sm text-muted-foreground">Só um instante…</p></>}</div></div>;
}
