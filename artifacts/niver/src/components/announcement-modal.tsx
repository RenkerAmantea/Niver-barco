import { useCallback, useEffect, useState } from "react";
import { BellRing, Check, MessageSquareText, Vote } from "lucide-react";
import { useSession } from "@/hooks/use-session";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

type Announcement = {
  id: number;
  title: string;
  body: string;
  pollOptions: string[];
  active: boolean;
  dismissed: boolean;
  myVote: number | null;
  voteCounts: number[];
  totalVotes: number;
};

export function AnnouncementModal({ enabled = true, onPendingChange, onChecked }: { enabled?: boolean; onPendingChange?: (pending: boolean) => void; onChecked?: () => void }) {
  const { session } = useSession();
  const [items, setItems] = useState<Announcement[]>([]);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!session?.id) return;
    try {
      const response = await fetch(`/api/announcements?guestId=${session.id}`);
      if (!response.ok) return;
      const data = await response.json();
      const next = Array.isArray(data.announcements) ? data.announcements : [];
      setItems(next);
      const pending = next.some((item: Announcement) => !item.dismissed);
      onPendingChange?.(pending);
      onChecked?.();
      if (pending && enabled) setOpen(true);
    } catch {
      // Um comunicado não deve impedir a pessoa de usar o app sem rede.
      onChecked?.();
    }
  }, [enabled, onChecked, onPendingChange, session?.id]);

  useEffect(() => {
    if (enabled && items.some((item) => !item.dismissed)) setOpen(true);
    if (!enabled) setOpen(false);
  }, [enabled, items]);

  useEffect(() => {
    void load();
    const refresh = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", refresh);
    const interval = window.setInterval(refresh, 20_000);
    return () => {
      document.removeEventListener("visibilitychange", refresh);
      window.clearInterval(interval);
    };
  }, [load]);

  const current = items.find((item) => !item.dismissed) ?? null;
  const dismiss = useCallback(async () => {
    if (!current || !session?.id) return;
    setOpen(false);
    setItems((previous) => previous.map((item) => item.id === current.id ? { ...item, dismissed: true } : item));
    await fetch(`/api/announcements/${current.id}/dismiss`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ guestId: session.id }),
    });
    window.setTimeout(() => void load(), 180);
  }, [current, load, session?.id]);

  const vote = async (optionIndex: number) => {
    if (!current || !session?.id) return;
    setSubmitting(optionIndex);
    try {
      const response = await fetch(`/api/announcements/${current.id}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guestId: session.id, optionIndex }),
      });
      const data = await response.json();
      if (response.ok && data.announcement)
        setItems((previous) => previous.map((item) => item.id === current.id ? data.announcement : item));
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <Dialog open={Boolean(open && current)} onOpenChange={(next) => { if (!next) void dismiss(); }}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-md gap-0 overflow-hidden rounded-[1.8rem] border border-[#ffe39a]/25 bg-[#0b1022]/95 p-0 text-foreground shadow-[0_30px_80px_rgba(0,0,0,.62)] backdrop-blur-2xl">
        {current && <div className="p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-[#ffe7a4]/35 bg-[#dcae42]/12 text-[#ffe09a] shadow-[inset_0_1px_0_rgba(255,255,255,.16)]">
              {current.pollOptions.length ? <Vote className="h-5 w-5" /> : <BellRing className="h-5 w-5" />}
            </span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[.2em] text-[#ffd873]/80">Comunicado do barco</p>
              <DialogTitle className="mt-1 font-display text-xl font-bold tracking-tight text-[#fff1ce]">{current.title}</DialogTitle>
            </div>
          </div>
          <DialogDescription className="mt-5 whitespace-pre-line text-sm leading-6 text-[#d8d9e8]">{current.body}</DialogDescription>
          {current.pollOptions.length > 0 && <div className="mt-5 space-y-2" aria-label="Opções da enquete">
            {current.pollOptions.map((option, index) => {
              const selected = current.myVote === index;
              const percent = current.totalVotes ? Math.round((current.voteCounts[index] / current.totalVotes) * 100) : 0;
              return <button key={option} type="button" disabled={submitting !== null} onClick={() => void vote(index)} className={`relative flex min-h-12 w-full items-center overflow-hidden rounded-xl border px-4 text-left text-sm transition ${selected ? "border-[#ffd875]/65 bg-[#dcae42]/15 text-[#fff0c8]" : "border-white/12 bg-black/20 text-[#e8e9f2] hover:border-[#ffd875]/35"}`}>
                <span className={`absolute inset-y-0 left-0 bg-[#dcae42]/12 transition-all ${current.myVote !== null ? "opacity-100" : "opacity-0"}`} style={{ width: `${percent}%` }} />
                <span className="relative flex min-w-0 flex-1 items-center gap-2"><span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border ${selected ? "border-[#ffe39a] bg-[#e9b94d] text-[#161003]" : "border-white/25"}`}>{selected && <Check className="h-3 w-3" />}</span><span className="truncate">{option}</span></span>
                {current.myVote !== null && <span className="relative ml-3 text-xs font-semibold text-[#ffe29a]">{current.voteCounts[index]} · {percent}%</span>}
              </button>;
            })}
            <p className="flex items-center gap-1.5 pt-1 text-xs text-white/45"><MessageSquareText className="h-3.5 w-3.5" /> {current.myVote === null ? "Seu voto pode ser alterado enquanto a enquete estiver aberta." : `${current.totalVotes} voto${current.totalVotes === 1 ? "" : "s"} até agora.`}</p>
          </div>}
          <button type="button" onClick={() => void dismiss()} className="premium-cta shimmer mt-6 flex h-11 w-full items-center justify-center rounded-xl border border-[#fff0b4]/60 bg-gradient-to-r from-[#ffe399] via-[#efbd4f] to-[#c87520] text-sm font-bold text-[#150d05]">{current.pollOptions.length ? "Pronto" : "Entendi"}</button>
        </div>}
      </DialogContent>
    </Dialog>
  );
}
