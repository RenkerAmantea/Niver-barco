import { FormEvent, useEffect, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { ArrowRight, Eye, EyeOff, LockKeyhole, ShipWheel } from "lucide-react";
import { useSession } from "@/hooks/use-session";

type InvitePreview = { id: number; name: string; avatarUrl?: string | null };

export default function Invite() {
  const [, params] = useRoute("/i/:token");
  const [, setLocation] = useLocation();
  const { saveSession } = useSession();
  const [invite, setInvite] = useState<InvitePreview | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const token = params?.token;
    if (!token) {
      setError("Este convite não está completo.");
      return;
    }
    let active = true;
    setInvite(null);
    setError(null);
    void fetch(`/api/invites/${encodeURIComponent(token)}`)
      .then(async (response) => ({ response, data: await response.json() }))
      .then(({ response, data }) => {
        if (!response.ok)
          throw new Error(data?.error || "Este convite não está disponível.");
        if (active) setInvite(data);
      })
      .catch(
        (reason: Error) =>
          active &&
          setError(reason.message || "Não foi possível abrir este convite."),
      );
    return () => {
      active = false;
    };
  }, [params?.token]);

  const claim = async (event: FormEvent) => {
    event.preventDefault();
    if (!params?.token || !invite) return;
    if (password.length < 4)
      return setError("Crie uma senha de pelo menos 4 caracteres.");
    if (password !== confirmPassword)
      return setError("As duas senhas não conferem.");
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/invites/${encodeURIComponent(params.token)}/claim`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password }),
        },
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(data?.error || "Não foi possível ativar este convite.");
      saveSession({
        id: data.id,
        name: data.name,
        avatarUrl: data.avatarUrl,
        isAdmin: Boolean(data.isAdmin),
        adminToken: data.isAdmin ? params.token : undefined,
      });
      setLocation("/evento");
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível ativar este convite.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-[68vh] items-center justify-center px-2">
      <div className="glass-card w-full max-w-md rounded-3xl p-7 text-center">
        <ShipWheel className="mx-auto h-9 w-9 text-primary" />
        {error ? (
          <>
            <h1 className="mt-4 font-display text-2xl font-bold">
              Convite indisponível
            </h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {error}
            </p>
            <button
              type="button"
              onClick={() => setLocation("/")}
              className="mt-5 text-sm font-semibold text-primary hover:text-[#ffe39a]"
            >
              Ir para o acesso normal
            </button>
          </>
        ) : !invite ? (
          <>
            <h1 className="mt-4 font-display text-2xl font-bold">
              Preparando seu embarque
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Só um instante…
            </p>
          </>
        ) : (
          <>
            {invite.avatarUrl ? (
              <img
                src={invite.avatarUrl}
                alt=""
                className="mx-auto mt-4 h-16 w-16 rounded-full border border-primary/35 object-cover"
              />
            ) : null}
            <p className="mt-4 text-[10px] font-semibold uppercase tracking-[.2em] text-primary">
              convite individual
            </p>
            <h1 className="mt-2 font-display text-2xl font-bold">
              Bem-vindo, {invite.name}
            </h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Escolha uma senha para recuperar este perfil depois, no app ou em
              outro aparelho.
            </p>
            <form onSubmit={claim} className="mt-6 space-y-3 text-left">
              <label className="block text-sm font-medium">
                Crie sua senha
                <span className="relative mt-2 block"><input value={password} onChange={(event) => setPassword(event.target.value)} type={showPassword ? 'text' : 'password'} autoComplete="new-password" minLength={4} required className="h-12 w-full rounded-xl border border-white/15 bg-black/30 px-3 pr-12 text-foreground" /><button type="button" aria-label={showPassword ? 'Ocultar senhas' : 'Mostrar senhas'} title={showPassword ? 'Ocultar senhas' : 'Mostrar senhas'} onClick={() => setShowPassword((shown) => !shown)} className="absolute right-1 top-1/2 grid h-10 w-10 -translate-y-1/2 cursor-pointer place-items-center rounded-lg text-white/45 transition hover:bg-white/5 hover:text-primary">{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></span>
              </label>
              <label className="block text-sm font-medium">
                Confirme a senha
                <span className="relative mt-2 block"><input value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} type={showPassword ? 'text' : 'password'} autoComplete="new-password" minLength={4} required className="h-12 w-full rounded-xl border border-white/15 bg-black/30 px-3 pr-12 text-foreground" /><button type="button" aria-label={showPassword ? 'Ocultar senhas' : 'Mostrar senhas'} title={showPassword ? 'Ocultar senhas' : 'Mostrar senhas'} onClick={() => setShowPassword((shown) => !shown)} className="absolute right-1 top-1/2 grid h-10 w-10 -translate-y-1/2 cursor-pointer place-items-center rounded-lg text-white/45 transition hover:bg-white/5 hover:text-primary">{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></span>
              </label>
              <button
                type="submit"
                disabled={submitting}
                className="premium-cta shimmer mt-2 flex h-12 w-full items-center justify-center rounded-xl border border-[#fff0b4]/60 bg-gradient-to-r from-[#ffe399] via-[#efbd4f] to-[#c87520] font-bold text-[#150d05] disabled:opacity-60"
              >
                <LockKeyhole className="mr-2 h-4 w-4" />
                {submitting ? "Ativando…" : "Ativar meu convite"}
                <ArrowRight className="ml-2 h-4 w-4" />
              </button>
            </form>
            <p className="mt-4 text-xs leading-5 text-white/45">
              Este link ativa uma única vez. Depois, entre normalmente com seu
              nome e senha.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
