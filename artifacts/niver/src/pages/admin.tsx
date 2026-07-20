import { FormEvent, useEffect, useState } from "react";
import { useLocation } from "wouter";
import {
  Check,
  ArrowLeft,
  Copy,
  Link2,
  Send,
  Shield,
  Trash2,
  UserPlus,
  BellRing,
  Vote,
  X,
  ChevronDown,
} from "lucide-react";
import { useSession } from "@/hooks/use-session";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

type Invite = {
  id: number;
  guestId: number;
  name: string;
  slug: string;
  url: string | null;
  claimedAt: string | null;
  rsvpStatus: string;
};
type LedgerGuest = {
  id: number;
  name: string;
  rsvp_status: string;
  payment: "pending" | "paid" | "on_site";
  isAdmin?: boolean;
};
type AdminPost = { id: number; guestName: string; content: string };
type AdminPhoto = { path: string; url: string; guestName: string };
type PushStatus = {
  configured: boolean;
  pairMatches: boolean;
  subscribedDevices: number;
  subscribedGuests: number;
};
type AdminAnnouncement = {
  id: number;
  title: string;
  body: string;
  pollOptions: string[];
  active: boolean;
  totalVotes: number;
  createdAt: string | null;
};
const paymentLabel = {
  pending: "Pendente",
  paid: "Pago",
  on_site: "Paga no local",
};

export default function Admin() {
  const { session } = useSession();
  const [, setLocation] = useLocation();
  const [password, setPassword] = useState(
    () => sessionStorage.getItem("niver_admin_password") ?? "",
  );
  // Nunca confiar em localStorage/sessionStorage para revelar controles de admin.
  // Mesmo a conta do capitão precisa ser confirmada pelo backend antes de renderizar o painel.
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [authError, setAuthError] = useState("");
  const [title, setTitle] = useState("Recado do barco"),
    [body, setBody] = useState(""),
    [url, setUrl] = useState("/evento"),
    [status, setStatus] = useState("");
  const [inviteName, setInviteName] = useState(""),
    [inviteStatus, setInviteStatus] = useState(""),
    [lastCreatedUrl, setLastCreatedUrl] = useState(""),
    [copiedInvite, setCopiedInvite] = useState(false),
    [invites, setInvites] = useState<Invite[]>([]),
    [refreshingInviteId, setRefreshingInviteId] = useState<number | null>(null),
    [expandedInviteId, setExpandedInviteId] = useState<number | null>(null);
  const [ledger, setLedger] = useState<LedgerGuest[]>([]),
    [surpriseName, setSurpriseName] = useState(""),
    [removingId, setRemovingId] = useState<number | null>(null);
  const [posts, setPosts] = useState<AdminPost[]>([]),
    [photos, setPhotos] = useState<AdminPhoto[]>([]),
    [removingContent, setRemovingContent] = useState<string | null>(null);
  const [pushStatus, setPushStatus] = useState<PushStatus | null>(null);
  const [adminTab, setAdminTab] = useState<"avisos" | "operação" | "convites" | "conteúdo">("avisos");
  const [announcements, setAnnouncements] = useState<AdminAnnouncement[]>([]);
  const [announcementTitle, setAnnouncementTitle] = useState(""),
    [announcementBody, setAnnouncementBody] = useState(""),
    [pollOptions, setPollOptions] = useState<string[]>(["", ""]),
    [announcementStatus, setAnnouncementStatus] = useState(""),
    [closingAnnouncementId, setClosingAnnouncementId] = useState<number | null>(null);
  const headers = () => ({
    "Content-Type": "application/json",
    ...(password ? { Authorization: `Bearer ${password}` } : {}),
    ...(session?.adminToken
      ? { "X-Niver-Admin-Invite": session.adminToken }
      : {}),
  });
  const remember = () =>
    password && sessionStorage.setItem("niver_admin_password", password);
  const load = async () => {
    const [a, b, c, d, e, f] = await Promise.all([
      fetch("/api/admin/invites", { headers: headers() }),
      fetch("/api/admin/payments", { headers: headers() }),
      fetch("/api/posts"),
      fetch("/api/photos"),
      fetch("/api/admin/push/status", { headers: headers() }),
      fetch("/api/admin/announcements", { headers: headers() }),
    ]);
    if (!a.ok || !b.ok) return false;
    setInvites(await a.json());
    setLedger((await b.json()).guests);
    if (c.ok) setPosts(await c.json());
    if (d.ok) setPhotos(await d.json());
    if (e.ok) setPushStatus(await e.json());
    if (f.ok) setAnnouncements((await f.json()).announcements ?? []);
    return true;
  };
  useEffect(() => {
    if (!session?.isAdmin) return;
    void load().then((ok) => {
      setAdminUnlocked(ok);
      if (!ok)
        setAuthError("Não foi possível confirmar o acesso administrativo.");
    });
  }, [session?.isAdmin]);
  const unlockAdmin = async () => {
    setAuthError("");
    const ok = await load();
    if (!ok) {
      sessionStorage.removeItem("niver_admin_password");
      setAdminUnlocked(false);
      setAuthError("Senha incorreta. Tente novamente.");
      return;
    }
    remember();
    setAdminUnlocked(true);
  };
  const send = async (e: FormEvent) => {
    e.preventDefault();
    setStatus("Enviando…");
    const r = await fetch("/api/admin/notify", {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ title, body, url }),
      }),
      d = await r.json();
    if (!r.ok) return setStatus(d.error ?? "Não foi possível enviar.");
    remember();
    setStatus(
      `Aviso salvo para ${d.saved} convidado(s). Push entregue em ${d.sent} de ${d.subscribedDevices} aparelho(s)${d.failed ? `; ${d.failed} falharam.` : "."}`,
    );
    void load();
  };
  const publishAnnouncement = async (e: FormEvent) => {
    e.preventDefault();
    setAnnouncementStatus("Publicando comunicado…");
    const response = await fetch("/api/admin/announcements", {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ title: announcementTitle, body: announcementBody, pollOptions: pollOptions.filter(Boolean) }),
    });
    const data = await response.json();
    if (!response.ok) return setAnnouncementStatus(data.error ?? "Não foi possível publicar o comunicado.");
    setAnnouncementTitle("");
    setAnnouncementBody("");
    setPollOptions(["", ""]);
    setAnnouncementStatus(`Comunicado publicado. Push entregue em ${data.sent} aparelho(s).`);
    await load();
  };
  const closeAnnouncement = async (id: number) => {
    setClosingAnnouncementId(id);
    const response = await fetch(`/api/admin/announcements/${id}`, {
      method: "PATCH",
      headers: headers(),
      body: JSON.stringify({ active: false }),
    });
    const data = await response.json();
    if (!response.ok) setAnnouncementStatus(data.error ?? "Não foi possível encerrar o comunicado.");
    else setAnnouncements((items) => items.map((item) => item.id === id ? { ...item, active: false } : item));
    setClosingAnnouncementId(null);
  };
  const copyInviteUrl = async (urlToCopy = lastCreatedUrl) => {
    if (!urlToCopy) return;
    try {
      await navigator.clipboard.writeText(urlToCopy);
      setCopiedInvite(true);
      setInviteStatus("Link copiado. Agora é só enviar para a pessoa.");
    } catch {
      setCopiedInvite(false);
      setInviteStatus(
        "Não foi possível copiar automaticamente. Toque no link e copie manualmente.",
      );
    }
  };
  const createInvite = async (e: FormEvent) => {
    e.preventDefault();
    const r = await fetch("/api/admin/invites", {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ name: inviteName }),
      }),
      d = await r.json();
    if (!r.ok) return setInviteStatus(d.error ?? "Não foi possível criar.");
    remember();
    setInviteName("");
    setLastCreatedUrl(d.url);
    setCopiedInvite(false);
    setInviteStatus(
      `Convite de ${d.name} criado. Copie o link abaixo para enviar.`,
    );
    await load();
  };
  const renewInviteLink = async (invite: Invite) => {
    if (
      !window.confirm(
        `Gerar um novo link para ${invite.name}? O link anterior deixará de funcionar.`,
      )
    )
      return;
    setRefreshingInviteId(invite.id);
    try {
      const response = await fetch(`/api/admin/invites/${invite.id}/link`, {
        method: "POST",
        headers: headers(),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error ?? "Não foi possível gerar o novo link.");
      setLastCreatedUrl(data.url);
      setInvites((items) => items.map((item) => item.id === invite.id ? { ...item, url: data.url } : item));
      setExpandedInviteId(invite.id);
      setCopiedInvite(false);
      setInviteStatus(
        `Novo link de ${data.name} pronto. O anterior deixou de funcionar; copie o novo abaixo.`,
      );
    } catch (error) {
      setInviteStatus(
        error instanceof Error
          ? error.message
          : "Não foi possível gerar o novo link.",
      );
    } finally {
      setRefreshingInviteId(null);
    }
  };
  const inviteRsvpLabel = (rsvpStatus: Invite["rsvpStatus"]) => {
    if (rsvpStatus === "going") return { label: "Vou", className: "border-emerald-300/45 bg-emerald-500/15 text-emerald-100" };
    if (rsvpStatus === "maybe") return { label: "Talvez", className: "border-amber-300/45 bg-amber-500/15 text-amber-100" };
    if (rsvpStatus === "not_going") return { label: "Não vou", className: "border-red-300/35 bg-red-500/15 text-red-100" };
    return { label: "Aguardando", className: "border-white/12 bg-white/[.04] text-white/55" };
  };
  const setPayment = async (id: number, payment: LedgerGuest["payment"]) => {
    const r = await fetch(`/api/admin/payments/${id}`, {
      method: "PATCH",
      headers: headers(),
      body: JSON.stringify({ status: payment }),
    });
    if (r.ok)
      setLedger((xs) => xs.map((x) => (x.id === id ? { ...x, payment } : x)));
  };
  const addSurprise = async (e: FormEvent) => {
    e.preventDefault();
    const r = await fetch("/api/admin/surprise-guests", {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ name: surpriseName, payment: "pending" }),
      }),
      d = await r.json();
    if (!r.ok) return setStatus(d.error ?? "Não foi possível adicionar.");
    setSurpriseName("");
    setLedger((xs) => [...xs, d]);
  };
  const removeGuest = async (guest: LedgerGuest) => {
    if (
      guest.isAdmin ||
      !window.confirm(
        `Apagar ${guest.name} e todo o conteúdo dessa conta? Isso remove mensagens, respostas, notificações e fotos sem volta.`,
      )
    )
      return;
    setRemovingId(guest.id);
    setStatus("Apagando conta e conteúdos…");
    try {
      const response = await fetch(`/api/admin/guests/${guest.id}`, {
        method: "DELETE",
        headers: headers(),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error ?? "Não foi possível apagar.");
      setLedger((items) => items.filter((item) => item.id !== guest.id));
      setInvites((items) => items.filter((item) => item.guestId !== guest.id));
      setStatus(`${guest.name} foi removido(a) junto com seus conteúdos.`);
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Não foi possível apagar.",
      );
    } finally {
      setRemovingId(null);
    }
  };
  const removePost = async (post: AdminPost) => {
    if (!window.confirm(`Apagar a publicação de ${post.guestName}?`)) return;
    setRemovingContent(`post-${post.id}`);
    const response = await fetch(`/api/admin/posts/${post.id}`, {
      method: "DELETE",
      headers: headers(),
    });
    const data = await response.json();
    if (!response.ok)
      setStatus(data.error ?? "Não foi possível apagar a publicação.");
    else setPosts((items) => items.filter((item) => item.id !== post.id));
    setRemovingContent(null);
  };
  const removePhoto = async (photo: AdminPhoto) => {
    if (!window.confirm(`Apagar esta foto enviada por ${photo.guestName}?`))
      return;
    setRemovingContent(`photo-${photo.path}`);
    const response = await fetch("/api/admin/photos", {
      method: "DELETE",
      headers: headers(),
      body: JSON.stringify({ path: photo.path }),
    });
    const data = await response.json();
    if (!response.ok)
      setStatus(data.error ?? "Não foi possível apagar a foto.");
    else setPhotos((items) => items.filter((item) => item.path !== photo.path));
    setRemovingContent(null);
  };
  const canUseAdmin = adminUnlocked;
  const waitingInvites = invites.filter((invite) => !invite.claimedAt);
  const waitingInviteGuestIds = new Set(
    waitingInvites.map((invite) => invite.guestId),
  );
  const waitingAccounts = ledger.filter(
    (guest) =>
      guest.rsvp_status === "pending" &&
      !guest.isAdmin &&
      !waitingInviteGuestIds.has(guest.id),
  );
  return (
    <div className="panel-enter mx-auto max-w-xl space-y-6 pb-24">
      <section>
        <button type="button" onClick={() => setLocation('/evento')} className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-primary hover:text-[#ffe5a2]"><ArrowLeft className="h-4 w-4" />Voltar para o app</button>
        <p className="text-xs font-semibold uppercase tracking-[.2em] text-primary">
          Cabine do capitão
        </p>
        <h1 className="mt-2 flex items-center gap-2 text-3xl font-display font-bold">
          <Shield className="h-6 w-6 text-primary" />
          Administração
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Operação do barco, sem expor dados da tripulação.
        </p>
      </section>
      {!canUseAdmin && (
        <div className="glass-card rounded-2xl p-4">
          <label className="block text-sm font-medium">
            Senha administrativa
            <input
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setAuthError("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") void unlockAdmin();
              }}
              type="password"
              autoComplete="current-password"
              className="mt-2 h-11 w-full rounded-xl border border-white/15 bg-black/30 px-3 text-foreground"
            />
          </label>
          <button
            type="button"
            onClick={() => void unlockAdmin()}
            className="premium-cta shimmer mt-3 h-10 rounded-xl border border-[#fff0b4]/60 bg-gradient-to-r from-[#ffe399] via-[#efbd4f] to-[#c87520] px-4 text-sm font-bold text-[#150d05]"
          >
            Entrar no painel
          </button>
          {authError && (
            <p role="alert" className="mt-3 text-sm text-red-200">
              {authError}
            </p>
          )}
        </div>
      )}
      {canUseAdmin && (
        <>
          <nav aria-label="Seções da administração" className="grid grid-cols-4 rounded-2xl border border-white/10 bg-black/20 p-1 text-[10px] font-bold uppercase tracking-[.08em] sm:text-xs">
            {([
              ["avisos", "Avisos", BellRing],
              ["operação", "Operação", Shield],
              ["convites", "Convites", Link2],
              ["conteúdo", "Conteúdo", Trash2],
            ] as const).map(([key, label, Icon]) => <button key={key} type="button" onClick={() => setAdminTab(key)} className={`flex min-h-10 min-w-0 items-center justify-center gap-1 rounded-xl px-1 transition ${adminTab === key ? "bg-[#dcae42]/18 text-[#ffe39a] shadow-[inset_0_1px_0_rgba(255,255,255,.12)]" : "text-white/45 hover:text-white/80"}`}><Icon className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{label}</span></button>)}
          </nav>
          {adminTab === "operação" && <section className="glass-card space-y-4 rounded-3xl p-5 sm:p-7">
            <div>
              <h2 className="font-display text-xl font-bold">
                Contribuições e lista
              </h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Controle privado. RSVP e pagamento são independentes; apagar
                remove toda a conta e os conteúdos dela.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-emerald-400/10 px-3 py-1 text-emerald-200">
                {ledger.filter((x) => x.payment === "paid").length} pagos
              </span>
              <span className="rounded-full bg-amber-300/10 px-3 py-1 text-amber-100">
                {ledger.filter((x) => x.payment === "on_site").length} no local
              </span>
              <span className="rounded-full bg-white/5 px-3 py-1 text-muted-foreground">
                {ledger.filter((x) => x.payment === "pending").length} pendentes
              </span>
            </div>
            <form
              onSubmit={addSurprise}
              className="rounded-2xl border border-white/10 bg-black/15 p-3"
            >
              <p className="mb-2 text-sm font-medium">Chegou de surpresa?</p>
              <div className="flex gap-2">
                <input
                  value={surpriseName}
                  onChange={(e) => setSurpriseName(e.target.value)}
                  required
                  placeholder="Nome"
                  className="h-10 min-w-0 flex-1 rounded-xl border border-white/15 bg-black/30 px-3 text-sm"
                />
                <button className="inline-flex h-10 items-center rounded-xl border border-primary/30 px-3 text-primary">
                  <UserPlus className="h-4 w-4" />
                </button>
              </div>
            </form>
            <div className="space-y-2">
              {ledger.map((g) => (
                <div
                  key={g.id}
                  className="rounded-2xl border border-white/10 bg-black/15 p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold">
                      {g.name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {g.isAdmin
                        ? "capitão"
                        : g.rsvp_status === "going"
                          ? "vou"
                          : g.rsvp_status}
                    </span>
                  </div>
                  <div className="mt-2 flex gap-1">
                    <div className="grid min-w-0 flex-1 grid-cols-3 gap-1">
                      {(["paid", "on_site", "pending"] as const).map((v) => (
                        <button
                          type="button"
                          key={v}
                          onClick={() => void setPayment(g.id, v)}
                          className={`min-h-9 rounded-lg border px-1 text-[10px] ${g.payment === v ? "border-primary/60 bg-primary/15 text-primary" : "border-white/10 text-muted-foreground"}`}
                        >
                          {paymentLabel[v]}
                        </button>
                      ))}
                    </div>
                    {g.isAdmin ? (
                      <span
                        className="grid h-9 w-9 shrink-0 place-items-center text-xs text-muted-foreground"
                        title="Conta do capitão protegida"
                      >
                        —
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void removeGuest(g)}
                        disabled={removingId === g.id}
                        aria-label={`Apagar ${g.name}`}
                        title="Apagar conta e conteúdos"
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-red-300/20 text-red-200 transition hover:bg-red-500/15 disabled:opacity-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>}
          {adminTab === "operação" && <section className="glass-card space-y-4 rounded-3xl p-5 sm:p-7">
            <div>
              <h2 className="font-display text-xl font-bold">
                Aguardando resposta
              </h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Privado: convites que ainda não abriram e perfis que entraram,
                mas ainda não disseram se vão.
              </p>
            </div>
            {waitingInvites.length + waitingAccounts.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Ninguém pendente por enquanto.
              </p>
            ) : (
              <div className="space-y-2">
                {waitingInvites.map((invite) => (
                  <div
                    key={`invite-${invite.id}`}
                    className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/15 p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">
                        {invite.name}
                      </p>
                      <p className="text-xs text-amber-100/70">
                        convite enviado · ainda não abriu
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        void removeGuest({
                          id: invite.guestId,
                          name: invite.name,
                          rsvp_status: "pending",
                          payment: "pending",
                        })
                      }
                      disabled={removingId === invite.guestId}
                      aria-label={`Apagar ${invite.name}`}
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-red-300/20 text-red-200 hover:bg-red-500/15 disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                {waitingAccounts.map((guest) => (
                  <div
                    key={`account-${guest.id}`}
                    className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/15 p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">
                        {guest.name}
                      </p>
                      <p className="text-xs text-white/45">
                        entrou por conta · ainda não respondeu
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void removeGuest(guest)}
                      disabled={removingId === guest.id}
                      aria-label={`Apagar ${guest.name}`}
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-red-300/20 text-red-200 hover:bg-red-500/15 disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>}
          {adminTab === "convites" && <section className="glass-card space-y-4 rounded-3xl p-5 sm:p-7">
            <div>
              <h2 className="font-display text-xl font-bold">
                Convite individual
              </h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                O nome fica visível no link; o código curto continua sendo a
                chave privada do convite.
              </p>
            </div>
            <form onSubmit={createInvite} className="flex gap-2">
              <input
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                required
                maxLength={80}
                placeholder="Nome do convidado"
                className="h-11 min-w-0 flex-1 rounded-xl border border-white/15 bg-black/30 px-3 text-foreground"
              />
              <button className="premium-cta shimmer inline-flex h-11 shrink-0 items-center rounded-xl border border-[#fff0b4]/60 bg-gradient-to-r from-[#ffe399] via-[#efbd4f] to-[#c87520] px-4 font-bold text-[#150d05]">
                <Link2 className="mr-2 h-4 w-4" />
                Gerar
              </button>
            </form>
            {inviteStatus && (
              <p className="rounded-xl border border-primary/20 bg-primary/10 p-3 text-sm text-primary">
                {inviteStatus}
              </p>
            )}
            {lastCreatedUrl && (
              <div className="space-y-2 rounded-2xl border border-white/10 bg-black/25 p-3">
                <label
                  htmlFor="created-invite-url"
                  className="block text-[10px] font-medium uppercase tracking-widest text-[#fff0c8]/70"
                >
                  Link pronto para enviar
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="created-invite-url"
                    readOnly
                    value={lastCreatedUrl}
                    onFocus={(event) => event.currentTarget.select()}
                    className="h-11 min-w-0 flex-1 rounded-xl border border-white/10 bg-black/25 px-3 font-mono text-xs text-[#ffe39a] outline-none focus:border-primary/60"
                    aria-label="Link do convite individual"
                  />
                  <button
                    type="button"
                    onClick={() => void copyInviteUrl()}
                    className="inline-flex h-11 shrink-0 items-center gap-2 rounded-xl border border-primary/35 bg-primary/10 px-3 text-sm font-semibold text-primary transition hover:bg-primary/20"
                    aria-label="Copiar link do convite"
                  >
                    {copiedInvite ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                    {copiedInvite ? "Copiado" : "Copiar"}
                  </button>
                </div>
              </div>
            )}
            <div className="space-y-2">
              {invites.map((invite) => {
                const rsvp = inviteRsvpLabel(invite.rsvpStatus);
                return <Collapsible key={invite.id} open={expandedInviteId === invite.id} onOpenChange={(open) => setExpandedInviteId(open ? invite.id : null)} className="rounded-xl border border-white/10 bg-black/15">
                  <CollapsibleTrigger className="flex w-full items-center gap-3 p-3 text-left transition hover:bg-white/[.025]">
                    <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{invite.name}</p><p className="mt-0.5 text-xs text-muted-foreground">{invite.claimedAt ? "abriu o convite" : "aguardando abertura"}</p></div>
                    <span className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-bold ${rsvp.className}`}>{rsvp.label}</span>
                    <ChevronDown className={`h-4 w-4 shrink-0 text-white/45 transition ${expandedInviteId === invite.id ? "rotate-180" : ""}`} />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="border-t border-white/8 px-3 pb-3 pt-3">
                    {invite.url ? <div className="flex items-center gap-2"><input readOnly value={invite.url} onFocus={(event) => event.currentTarget.select()} className="h-10 min-w-0 flex-1 rounded-xl border border-white/10 bg-black/25 px-3 font-mono text-[11px] text-[#ffe39a]" aria-label={`Link de convite de ${invite.name}`} /><button type="button" onClick={() => void copyInviteUrl(invite.url ?? "")} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-primary/30 bg-primary/10 text-primary hover:bg-primary/20" aria-label={`Copiar link de ${invite.name}`}><Copy className="h-4 w-4" /></button></div> : <p className="rounded-xl border border-amber-300/15 bg-amber-300/5 p-3 text-xs leading-5 text-amber-100/75">Este é um convite antigo: o link anterior não pode ser recuperado. Gere um novo para ter um link copiável aqui.</p>}
                    <div className="mt-3 flex justify-end"><button type="button" onClick={() => void renewInviteLink(invite)} disabled={refreshingInviteId === invite.id} className="h-9 rounded-lg border border-primary/30 px-3 text-xs font-semibold text-primary hover:bg-primary/10 disabled:opacity-50">{refreshingInviteId === invite.id ? "Gerando…" : invite.url ? "Novo link" : "Gerar link"}</button></div>
                  </CollapsibleContent>
                </Collapsible>;
              })}
            </div>
            <p className="text-xs leading-5 text-white/40">
              “Novo link” invalida o anterior, para manter o convite privado.
            </p>
          </section>}
          {adminTab === "conteúdo" && <section className="glass-card space-y-4 rounded-3xl p-5 sm:p-7">
            <div>
              <h2 className="font-display text-xl font-bold">
                Limpeza de conteúdo
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Apague testes ou publicações indevidas sem precisar limpar o
                banco inteiro.
              </p>
            </div>
            {posts.length === 0 && photos.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Mural e álbum estão limpos.
              </p>
            ) : (
              <div className="space-y-3">
                {posts.map((post) => (
                  <div
                    key={post.id}
                    className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/15 p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">{post.guestName}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {post.content}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void removePost(post)}
                      disabled={removingContent === `post-${post.id}`}
                      className="grid h-9 w-9 place-items-center rounded-lg border border-red-300/20 text-red-200 hover:bg-red-500/15"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                {photos.map((photo) => (
                  <div
                    key={photo.path}
                    className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/15 p-3"
                  >
                    <img
                      src={photo.url}
                      alt=""
                      className="h-10 w-10 rounded-lg object-cover"
                    />
                    <span className="min-w-0 flex-1 truncate text-sm">
                      Foto de {photo.guestName}
                    </span>
                    <button
                      type="button"
                      onClick={() => void removePhoto(photo)}
                      disabled={removingContent === `photo-${photo.path}`}
                      className="grid h-9 w-9 place-items-center rounded-lg border border-red-300/20 text-red-200 hover:bg-red-500/15"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>}
          {adminTab === "avisos" && <>
          <form onSubmit={publishAnnouncement} className="glass-card space-y-4 rounded-3xl p-5 sm:p-7">
            <div>
              <div className="flex items-center gap-2"><Vote className="h-4 w-4 text-primary" /><h2 className="font-display text-xl font-bold">Comunicado importante</h2></div>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">Abre em destaque no app, continua disponível na próxima abertura e envia push para quem ativou avisos.</p>
            </div>
            <label className="block text-sm font-medium">Título<input value={announcementTitle} onChange={(e) => setAnnouncementTitle(e.target.value)} required maxLength={80} placeholder="Ex.: Mudança no ponto de encontro" className="mt-2 h-11 w-full rounded-xl border border-white/15 bg-black/30 px-3 text-foreground" /></label>
            <label className="block text-sm font-medium">Mensagem<textarea value={announcementBody} onChange={(e) => setAnnouncementBody(e.target.value)} required maxLength={240} placeholder="Escreva o recado importante aqui" className="mt-2 min-h-24 w-full rounded-xl border border-white/15 bg-black/30 p-3 text-foreground" /></label>
            <div className="rounded-2xl border border-white/10 bg-black/15 p-3">
              <div className="flex items-center justify-between gap-3"><p className="text-sm font-medium">Enquete opcional</p><button type="button" onClick={() => setPollOptions(["", ""])} className="text-xs text-primary hover:text-[#ffe39a]">Limpar</button></div>
              <p className="mt-1 text-xs text-white/45">Deixe vazia para enviar só o aviso. Com duas ou mais opções, vira enquete.</p>
              <div className="mt-3 space-y-2">{pollOptions.map((option, index) => <div key={index} className="flex gap-2"><input value={option} onChange={(e) => setPollOptions((items) => items.map((item, itemIndex) => itemIndex === index ? e.target.value : item))} maxLength={50} placeholder={`Opção ${index + 1}`} className="h-10 min-w-0 flex-1 rounded-xl border border-white/15 bg-black/30 px-3 text-sm" />{pollOptions.length > 2 && <button type="button" onClick={() => setPollOptions((items) => items.filter((_, itemIndex) => itemIndex !== index))} aria-label="Remover opção" className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 text-white/55 hover:text-red-200"><X className="h-4 w-4" /></button>}</div>)}</div>
              {pollOptions.length < 4 && <button type="button" onClick={() => setPollOptions((items) => [...items, ""])} className="mt-3 text-xs font-semibold text-primary hover:text-[#ffe39a]">+ adicionar opção</button>}
            </div>
            <button className="premium-cta shimmer flex h-12 w-full items-center justify-center rounded-xl border border-[#fff0b4]/60 bg-gradient-to-r from-[#ffe399] via-[#efbd4f] to-[#c87520] font-bold text-[#150d05]"><BellRing className="mr-2 h-4 w-4" />Publicar comunicado</button>
            {announcementStatus && <p className="rounded-xl border border-primary/20 bg-primary/10 p-3 text-sm text-primary">{announcementStatus}</p>}
          </form>
          {announcements.length > 0 && <section className="glass-card space-y-3 rounded-3xl p-5 sm:p-7"><div><h2 className="font-display text-xl font-bold">Comunicados enviados</h2><p className="mt-1 text-sm text-muted-foreground">Encerre um aviso quando ele não precisar mais aparecer.</p></div>{announcements.map((announcement) => <div key={announcement.id} className="rounded-2xl border border-white/10 bg-black/15 p-3"><div className="flex gap-3"><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{announcement.title}</p><p className="mt-1 line-clamp-2 text-xs leading-5 text-white/50">{announcement.body}</p><p className="mt-2 text-[11px] text-white/40">{announcement.pollOptions.length ? `Enquete · ${announcement.totalVotes} voto(s)` : "Aviso"} · {announcement.active ? "ativo" : "encerrado"}</p></div>{announcement.active && <button type="button" onClick={() => void closeAnnouncement(announcement.id)} disabled={closingAnnouncementId === announcement.id} className="h-9 shrink-0 rounded-lg border border-red-300/25 px-3 text-xs font-semibold text-red-200 hover:bg-red-500/15 disabled:opacity-50">{closingAnnouncementId === announcement.id ? "Encerrando…" : "Encerrar"}</button>}</div></div>)}</section>}
          <form
            onSubmit={send}
            className="glass-card space-y-5 rounded-3xl p-5 sm:p-7"
          >
            <div>
              <h2 className="font-display text-xl font-bold">Notificações</h2>
              {pushStatus ? (
                <p
                  className={`mt-1 text-xs ${pushStatus.subscribedDevices > 0 ? "text-emerald-200" : "text-amber-100/75"}`}
                >
                  {pushStatus.configured && pushStatus.pairMatches
                    ? `${pushStatus.subscribedDevices} aparelho(s) ativo(s) em ${pushStatus.subscribedGuests} perfil(is).`
                    : "A configuração de push do servidor precisa de atenção."}
                  {pushStatus.subscribedDevices === 0
                    ? " Ninguém está inscrito neste momento; peça para ativarem os avisos no app."
                    : ""}
                </p>
              ) : (
                <p className="mt-1 text-xs text-muted-foreground">
                  Conferindo aparelhos inscritos…
                </p>
              )}
            </div>
            <label className="block text-sm font-medium">
              Título
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                maxLength={80}
                className="mt-2 h-11 w-full rounded-xl border border-white/15 bg-black/30 px-3 text-foreground"
              />
            </label>
            <label className="block text-sm font-medium">
              Mensagem
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                required
                maxLength={240}
                className="mt-2 min-h-28 w-full rounded-xl border border-white/15 bg-black/30 p-3 text-foreground"
              />
            </label>
            <label className="block text-sm font-medium">
              Abrir ao tocar
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                required
                className="mt-2 h-11 w-full rounded-xl border border-white/15 bg-black/30 px-3 text-foreground"
              />
            </label>
            <button className="premium-cta shimmer flex h-12 w-full items-center justify-center rounded-xl border border-[#fff0b4]/60 bg-gradient-to-r from-[#ffe399] via-[#efbd4f] to-[#c87520] font-bold text-[#150d05]">
              <Send className="mr-2 h-4 w-4" />
              Enviar notificação
            </button>
            {status && (
              <p className="rounded-xl border border-primary/20 bg-primary/10 p-3 text-sm text-primary">
                {status}
              </p>
            )}
          </form>
          </>}
        </>
      )}
    </div>
  );
}
