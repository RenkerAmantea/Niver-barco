import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useGetRsvpSummary } from "@workspace/api-client-react";
import { useSession } from "@/hooks/use-session";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  CalendarDays,
  Check,
  Copy,
  ExternalLink,
  MapPinned,
  MapPin,
  MessageCircle,
  PackageOpen,
  ShipWheel,
  UsersRound,
} from "lucide-react";

const faq = [
  {
    question: "Posso levar alguém?",
    answer:
      "Pode, sim. Para chamar alguém, envie o link público normal — não um convite individual. A pessoa cria o próprio perfil e marca a presença.",
  },
  {
    question: "Até que horas vai a resenha?",
    answer:
      "Não tem horário cravado: depende da empolgação do dono do barco. Pode acabar à meia-noite ou sobreviver até 6h.",
  },
  {
    question: "Vai ter comida?",
    answer:
      "Vai ter uma base bem simbólica: pãezinhos, amendoim e alguns refris. Como tudo foi decidido em cima da hora, se estiver com fome é melhor levar algo ou combinar de pedir por lá. E fica totalmente à vontade para levar ou pedir seus comes e bebes: pode entrar tudo no barco.",
  },
  {
    question: "Chega iFood?",
    answer:
      "Chega, sim. Também há barraquinhas de comida por perto até mais ou menos 20h.",
  },
  {
    question: "Tô brigado com fulano(a), e agora?",
    answer:
      "O barco é grande: dá para ficar em outro canto, montar sua própria rodinha e preservar a paz marítima.",
  },
  { question: "Posso levar criança?", answer: "Pode." },
  {
    question: "O barco vai navegar? Preciso chegar às 19h em ponto?",
    answer:
      "Ele vai ficar atracado. Pode chegar no horário que conseguir, a partir das 19h.",
  },
];

export default function Event() {
  const { session } = useSession();
  const [, setLocation] = useLocation();
  const { data: summary } = useGetRsvpSummary();
  const [copied, setCopied] = useState(false);
  const [copiedPublicLink, setCopiedPublicLink] = useState(false);
  const copyPix = async () => {
    await navigator.clipboard?.writeText("61999898198");
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };
  const copyPublicLink = async () => {
    await navigator.clipboard?.writeText(
      "https://renker-niver-barco.vercel.app",
    );
    setCopiedPublicLink(true);
    window.setTimeout(() => setCopiedPublicLink(false), 1800);
  };
  useEffect(() => {
    if (!session) setLocation("/");
  }, [session, setLocation]);
  if (!session) return null;
  return (
    <div className="panel-enter space-y-7 pb-24">
      <section className="relative overflow-hidden rounded-[2rem] border border-primary/25 bg-gradient-to-br from-[#20143f] via-[#11152e] to-[#071622] p-7 shadow-[0_0_50px_rgba(124,58,237,.18)]">
        <div className="absolute -right-10 -top-10 h-44 w-44 rounded-full bg-primary/20 blur-3xl" />
        <p className="text-xs uppercase tracking-[.2em] text-primary">
          21 JUL · BRASÍLIA
        </p>
        <h1 className="mt-3 max-w-sm text-4xl font-display font-bold leading-none text-white">
          Renker
          <br />
          <span className="text-primary">Niver a bordo</span>
        </h1>
        <p className="mt-5 max-w-md text-sm leading-6 text-white/70">
          Uma resenha pequena, um barco e uma comemoração simples. A grande
          Renker Party fica para mais pra frente. Esta é só a nossa resenha no
          convés.
        </p>
        <div className="mt-7 grid grid-cols-3 gap-2 text-center text-xs text-white/75">
          <div className="rounded-2xl bg-black/20 p-3">
            <CalendarDays className="mx-auto mb-2 h-4 w-4 text-primary" />
            Terça
            <br />
            19h
          </div>
          <div className="rounded-2xl bg-black/20 p-3">
            <ShipWheel className="mx-auto mb-2 h-4 w-4 text-primary" />
            Barco
            <br />
            atracado
          </div>
          <div className="rounded-2xl bg-black/20 p-3">
            <MapPin className="mx-auto mb-2 h-4 w-4 text-primary" />
            Brasília
            <br />
            DF
          </div>
        </div>
      </section>

      <section className="glass-card relative overflow-hidden rounded-3xl border-primary/35 bg-gradient-to-br from-[#241a0d]/90 via-[#151426]/95 to-[#0a1523]/95 p-5 shadow-[0_0_42px_rgba(201,168,76,.18)]">
        <div className="pointer-events-none absolute -right-10 -top-12 h-36 w-36 rounded-full bg-primary/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 -left-10 h-32 w-32 rounded-full bg-[#9d74ff]/10 blur-3xl" />
        <div className="relative flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-primary/40 bg-primary/15 text-[#ffe29b]">
            <ShipWheel className="h-5 w-5" />
          </span>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[.18em] text-[#ffe29b]">
              Contribuição de bordo
            </p>
            <h2 className="mt-1 font-display text-xl text-foreground">
              <strong className="text-[#ffe29b]">R$20</strong> para limpeza e
              manutenção
            </h2>
          </div>
        </div>
        <p className="relative mt-4 max-w-md text-sm leading-6 text-foreground/80">
          Se não tiver condições de verdade, fala comigo — mas não deixe de ir.
        </p>
        <button
          onClick={copyPix}
          className="relative mt-4 flex w-full items-center justify-between rounded-2xl border border-primary/25 bg-black/30 px-4 py-3.5 text-left transition hover:border-primary/60 hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
        >
          <span>
            <span className="block text-[10px] font-medium uppercase tracking-widest text-[#fff0c8]/70">
              PIX · toque para copiar
            </span>
            <strong className="mt-1 block font-sans text-lg font-bold tabular-nums tracking-[.12em] text-[#fff0c8]">
              61999898198
            </strong>
          </span>
          {copied ? (
            <span className="flex items-center gap-2 text-sm font-medium text-emerald-300">
              <Check className="h-5 w-5" />
              Copiado
            </span>
          ) : (
            <Copy className="h-5 w-5 text-primary" />
          )}
        </button>
        <a
          href="https://wa.me/55619989898198?text=Oi%20Renker%2C%20segue%20meu%20comprovante%20da%20contribui%C3%A7%C3%A3o%20do%20Niver%20Barco."
          target="_blank"
          rel="noreferrer"
          className="premium-cta shimmer relative mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-[#fff0b4]/60 bg-gradient-to-r from-[#ffe399] via-[#efbd4f] to-[#c87520] px-4 py-3 text-sm font-bold text-[#150d05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
        >
          <MessageCircle className="h-4 w-4" />
          Enviar comprovante no WhatsApp
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </section>

      <section className="glass-card relative overflow-hidden rounded-3xl p-5">
        <div className="pointer-events-none absolute -right-10 -top-12 h-32 w-32 rounded-full bg-primary/12 blur-3xl" />
        <div className="relative">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
              <MapPinned className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[.18em] text-primary">
                Onde embarcar
              </p>
              <h2 className="mt-1 font-display text-xl leading-tight text-foreground">
                Píer da Orla da Concha Acústica
              </h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Barco atracado em frente ao restaurante O Rei do Camarão.
              </p>
            </div>
          </div>
          <div className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-[#0a1020] shadow-[inset_0_1px_rgba(255,255,255,.05)]">
            <iframe
              title="Mapa do Píer da Orla da Concha Acústica"
              src="https://www.google.com/maps?q=P%C3%ADer%20da%20Orla%20da%20Concha%20Ac%C3%BAstica%20Bras%C3%ADlia&output=embed"
              className="block h-44 w-full border-0 grayscale-[.15] contrast-[.9]"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
          <a
            href="https://www.google.com/searchviewer/10?svid=CAwSHRIbCgNwdnESFENnMHZaeTh4TVdka2VXbzJNbnA1GAo"
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary transition hover:text-[#ffe29b]"
          >
            <MapPin className="h-4 w-4" />
            Abrir localização no Google Maps
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </section>

      <section className="glass-card rounded-3xl p-5">
        <div className="flex gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
            <PackageOpen className="h-5 w-5" />
          </span>
          <div>
            <p className="font-display text-lg text-foreground">
              Leva o que tiver vontade
            </p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Pode levar sua bebida, petisco ou comida sem problema. É tudo
              liberado para entrar no barco.
            </p>
          </div>
        </div>
      </section>

      <section className="glass-card rounded-3xl p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              Tripulação confirmada
            </p>
            <p className="mt-1 text-3xl font-display text-primary">
              {summary?.going ?? 0}
            </p>
          </div>
          <UsersRound className="h-9 w-9 text-primary/70" />
        </div>
        <Button
          className="premium-cta shimmer mt-5 w-full border border-[#fff0b4]/60 bg-gradient-to-r from-[#ffe399] via-[#efbd4f] to-[#c87520] font-bold text-[#150d05] hover:brightness-110"
          onClick={() => setLocation("/convidados")}
        >
          Ver lista e confirmar presença
        </Button>
      </section>

      <section className="glass-card rounded-3xl p-5 sm:p-6">
        <div className="mb-4">
          <p className="text-[10px] font-bold uppercase tracking-[.18em] text-primary">
            Dúvidas de bordo
          </p>
          <h2 className="mt-2 font-display text-2xl text-foreground">
            FAQ da resenha
          </h2>
        </div>
        <Accordion type="single" collapsible className="w-full">
          {faq.map((item, index) => (
            <AccordionItem
              key={item.question}
              value={`faq-${index}`}
              className="border-white/8"
            >
              <AccordionTrigger className="gap-3 py-4 text-left font-medium text-foreground hover:no-underline">
                {item.question}
              </AccordionTrigger>
              <AccordionContent className="pb-4 pr-8 text-sm leading-6 text-muted-foreground">
                {item.answer}
                {index === 0 && (
                  <button
                    type="button"
                    onClick={copyPublicLink}
                    className="mt-3 flex w-full items-center justify-between gap-3 rounded-xl border border-primary/25 bg-black/20 px-3 py-2.5 text-left text-xs text-[#ffe39a] transition hover:bg-primary/10"
                  >
                    <span className="min-w-0 truncate">
                      renker-niver-barco.vercel.app
                    </span>
                    <span className="shrink-0 font-semibold">
                      {copiedPublicLink ? "Copiado" : "Copiar link"}{" "}
                      {copiedPublicLink ? (
                        <Check className="ml-1 inline h-3.5 w-3.5" />
                      ) : (
                        <Copy className="ml-1 inline h-3.5 w-3.5" />
                      )}
                    </span>
                  </button>
                )}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>
    </div>
  );
}
