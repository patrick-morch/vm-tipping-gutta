"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useKamper, useMineTips, lagreTip, slettTip } from "@/lib/data";
import { Match, Prediction, beregnPoeng } from "@/lib/types";
import {
  erNorgeKamp,
  erTippbar,
  flagg,
  kampErLåst,
  kortLagNavn,
  nesteSynkTid,
  tippingLåst,
} from "@/lib/vm-data";
import Skall from "@/components/Skall";
import Beskytt from "@/components/Beskytt";
import SideHeader from "@/components/SideHeader";
import AlleTipsForKamp from "@/components/AlleTipsForKamp";
import { useFrosseToast } from "@/components/FrosseToast";

const ANTALL = 5;

export default function KamperSide() {
  return (
    <Beskytt>
      <Skall>
        <Kamper />
      </Skall>
    </Beskytt>
  );
}

function Kamper() {
  const { user, bruker } = useAuth();
  const kamper = useKamper();
  const tips = useMineTips(user?.uid);
  const [nå, setNå] = useState(Date.now());
  const [visAlle, setVisAlle] = useState(false);
  const frosset = bruker?.frosset === true;
  const { varsle, toast } = useFrosseToast();

  useEffect(() => {
    const t = setInterval(() => setNå(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    document.body.dataset.page = "kamper";
    return () => {
      delete document.body.dataset.page;
    };
  }, []);

  const åpne = kamper
    .filter((k) => k.starttid > nå && erTippbar(k))
    .sort((a, b) => a.starttid - b.starttid);
  const neste = åpne.slice(0, ANTALL);
  const utenTip = neste.filter((k) => !tips[k.id]).length;
  // Når man trykker "Se alle" vises hele den åpne kamplisten inline,
  // ellers bare de neste fem.
  const synligeÅpne = visAlle ? åpne : neste;

  // Kamper som har startet men ikke har resultat ennå — vises som låst
  // til de er ferdigspilt og dukker opp under "Siste resultater".
  const pågår = kamper
    .filter((k) => kampErLåst(k, nå) && !k.resultat && erTippbar(k))
    .sort((a, b) => a.starttid - b.starttid);

  // Ferdigspilte kamper blir liggende på Kamper-siden i ~2 timer etter full
  // tid (avspark + ~2t kamp + 2t), så forsvinner de som vanlig.
  const SPILT_SYNLIG_MS = 4 * 3600_000;
  const nyligSpilte = kamper
    .filter(
      (k) => k.resultat && erTippbar(k) && nå - k.starttid < SPILT_SYNLIG_MS,
    )
    .sort((a, b) => a.starttid - b.starttid);

  const visKamper = [...nyligSpilte, ...pågår, ...synligeÅpne].sort(
    (a, b) => a.starttid - b.starttid,
  );

  async function lagre(id: string, h: number, b: number) {
    if (!user || !bruker || frosset) return;
    const kamp = kamper.find((k) => k.id === id);
    if (kamp && tippingLåst(kamp)) return;
    // Kaster videre hvis serveren ikke bekrefter — KampKort fanger det og
    // viser «ikke bekreftet» i stedet for å late som tippet er lagret.
    await lagreTip({
      matchId: id,
      uid: user.uid,
      navn: bruker.navn,
      hjemme: h,
      borte: b,
      lagretTid: Date.now(),
    });
  }

  async function slett(id: string) {
    if (!user || frosset) return;
    await slettTip(id, user.uid);
  }

  // Grupperer kamper etter dag
  const grupperte = grupperEtterDag(visKamper, nå);

  const førsteKamp = neste[0];
  const nedTekst = førsteKamp ? formatTid(førsteKamp.starttid - nå) : null;
  // Når poeng neste gang oppdateres (synk-jobben kjører på faste tider).
  const nesteOppdatering = formatTid(nesteSynkTid(nå) - nå);
  // Kamper som spilles nå (avspark passert, ikke ferdig, < 3,5 t siden start).
  const pågårNå = kamper.filter(
    (k) =>
      erTippbar(k) &&
      kampErLåst(k, nå) &&
      k.ferdig !== true &&
      nå - k.starttid < 3.5 * 3600_000,
  );

  return (
    <div className="space-y-5">
      <SideHeader
        tittel="Neste kamper"
        undertittel={
          neste.length === 0 ? (
            "Ingen åpne kamper"
          ) : (
            <>
              {nedTekst && (
                <>
                  <span className="text-text font-semibold">
                    Neste om {nedTekst}
                  </span>{" "}
                  ·{" "}
                </>
              )}
              {utenTip} ikke tippet
            </>
          )
        }
      />

      {!frosset && <TippefristBanner kamper={kamper} tips={tips} nå={nå} />}

      {frosset && (
        <div className="bg-warning/10 border border-warning/30 text-warning text-sm rounded-2xl px-4 py-3 flex items-center gap-2">
          <span className="text-lg">❄️</span>
          Du er frosset av admin. Du kan se kampene, men ikke tippe.
        </div>
      )}

      {
        <div className="bg-surface border border-border rounded-2xl px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-lg">⏱</span>
            <div className="min-w-0">
              <div className="text-sm font-semibold">
                Neste poengoppdatering
              </div>
              <div className="text-[11px] text-muted">
                {pågårNå.length > 0
                  ? `${pågårNå.length} kamp${pågårNå.length > 1 ? "er" : ""} spilles nå`
                  : "Resultater hentes automatisk"}
              </div>
            </div>
          </div>
          <div className="text-sm font-bold tabular-nums whitespace-nowrap">
            om ~{nesteOppdatering}
          </div>
        </div>
      }

      {/* På desktop: kamper venstre (smalere), Cantona-kicket fyller høyrekolonnen */}
      <div className="lg:grid lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:gap-6 space-y-5 lg:space-y-0">
        <div className="space-y-5">
          {visKamper.length === 0 && (
            <div className="bg-surface border border-border rounded-2xl p-8 text-center text-muted text-sm">
              Ingen åpne kamper akkurat nå.
            </div>
          )}

          {grupperte.map(({ dato, kamper: dagsKamper }) => (
            <div key={dato} className="space-y-2">
              <DatoHeader dato={dato} nå={nå} />
              <div className="space-y-2">
                {dagsKamper.map((kamp) => (
                  <KampKort
                    key={kamp.id}
                    kamp={kamp}
                    tip={tips[kamp.id]}
                    frosset={frosset}
                    redigerStengt={tippingLåst(kamp, nå)}
                    onLagre={(h, b) => lagre(kamp.id, h, b)}
                    onSlett={() => slett(kamp.id)}
                    varsle={varsle}
                  />
                ))}
              </div>
            </div>
          ))}

          {åpne.length > ANTALL && (
            <button
              onClick={() => setVisAlle((v) => !v)}
              className="block w-full text-center bg-surface border border-border hover:border-primary rounded-2xl py-3 text-sm font-medium transition"
            >
              {visAlle
                ? "Vis færre kamper ↑"
                : `Se alle ${åpne.length} åpne kamper ↓`}
            </button>
          )}
        </div>

        <aside className="hidden lg:block lg:h-full">
          <div className="relative overflow-hidden rounded-3xl border border-border h-full">
            <img
              src="/cantona-kick.jpeg"
              alt="Eric Cantona, Selhurst Park, 25. januar 1995"
              className="w-full h-full object-cover object-[20%_60%]"
            />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4">
              <div className="text-[10px] uppercase tracking-[0.18em] font-bold text-white/70">
                Selhurst Park · 25.01.1995
              </div>
              <div className="text-white text-sm font-semibold">
                "Au revoir."
              </div>
            </div>
          </div>
        </aside>
      </div>

      {toast}
    </div>
  );
}

// Tippefrist-nudge: dukker bare opp når du mangler tips på en kamp som låses
// snart. Rød/«haster» under 3 timer til avspark, ellers en rolig påminnelse.
// Forsvinner helt så snart alt er tippet.
function TippefristBanner({
  kamper,
  tips,
  nå,
}: {
  kamper: Match[];
  tips: Record<string, Prediction>;
  nå: number;
}) {
  const TIME = 3600_000;
  const utippede = kamper
    .filter((k) => k.starttid > nå && erTippbar(k) && !tips[k.id])
    .sort((a, b) => a.starttid - b.starttid);
  if (utippede.length === 0) return null;

  const neste = utippede[0];
  const msTil = neste.starttid - nå;
  // Ikke mas i tide og utide — vis bare når noe låses innen 12 timer.
  if (msTil > 12 * TIME) return null;

  const haster = msTil <= 3 * TIME;
  const antallSnart = utippede.filter(
    (k) => k.starttid - nå <= 12 * TIME,
  ).length;

  return (
    <div
      className={`rounded-2xl px-4 py-3 flex items-center gap-3 border ${
        haster
          ? "bg-danger/10 border-danger/40 text-danger"
          : "bg-accent/10 border-accent/40 text-accent"
      }`}
    >
      <span className="text-lg flex-shrink-0">{haster ? "⏰" : "✍️"}</span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-bold">
          {antallSnart === 1
            ? "1 kamp mangler tips"
            : `${antallSnart} kamper mangler tips`}
        </div>
        <div className="text-[11px] opacity-90 truncate">
          Neste låses om {formatTid(msTil)} · {kortLagNavn(neste.hjemmelag)} mot{" "}
          {kortLagNavn(neste.bortelag)}
        </div>
      </div>
    </div>
  );
}

function grupperEtterDag(
  kamper: Match[],
  nå: number,
): { dato: string; kamper: Match[] }[] {
  const map = new Map<string, Match[]>();
  for (const k of kamper) {
    const dato = new Date(k.starttid).toLocaleDateString("nb-NO", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const liste = map.get(dato) || [];
    liste.push(k);
    map.set(dato, liste);
  }
  return Array.from(map.entries()).map(([dato, kamper]) => ({ dato, kamper }));
}

function DatoHeader({ dato, nå }: { dato: string; nå: number }) {
  const [d, m, y] = dato.split(".").map((s) => s.trim());
  const dt = new Date(`${y}-${m}-${d}T12:00:00`);
  const idag = new Date(nå);
  const imorgen = new Date(nå + 24 * 3600_000);

  const sammeDag = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  let tag = "";
  let temaKlasse = "text-muted";
  if (sammeDag(dt, idag)) {
    tag = "I DAG";
    temaKlasse = "text-primary";
  } else if (sammeDag(dt, imorgen)) {
    tag = "I MORGEN";
    temaKlasse = "text-accent";
  } else {
    tag = dt.toLocaleDateString("nb-NO", { weekday: "long" }).toUpperCase();
  }

  const beskrivelse = dt.toLocaleDateString("nb-NO", {
    day: "numeric",
    month: "long",
  });

  return (
    <div className="flex items-baseline gap-2 px-1">
      <span
        className={`text-[11px] font-bold uppercase tracking-[0.12em] ${temaKlasse}`}
      >
        {tag}
      </span>
      <span className="text-[10px] text-muted/70">{beskrivelse}</span>
    </div>
  );
}

function formatTid(ms: number): string {
  if (ms <= 0) return "0 min";
  const totalMin = Math.floor(ms / 60_000);
  const dager = Math.floor(totalMin / (60 * 24));
  const timer = Math.floor((totalMin % (60 * 24)) / 60);
  const min = totalMin % 60;
  if (dager > 0) return `${dager}d ${timer}t`;
  if (timer > 0) return `${timer}t ${min}m`;
  return `${min} min`;
}

function KampKort({
  kamp,
  tip,
  frosset,
  redigerStengt,
  onLagre,
  onSlett,
  varsle,
}: {
  kamp: Match;
  tip?: Prediction;
  frosset?: boolean;
  redigerStengt?: boolean;
  onLagre: (h: number, b: number) => Promise<void>;
  onSlett: () => Promise<void>;
  varsle: (melding?: string) => void;
}) {
  // Inputs sperres allerede et lite vindu før avspark (redigerStengt), mens
  // `låst` (selve avsparket) styrer badge + avsløring av alles tips.
  const blokkert = Boolean(frosset || redigerStengt);
  const [hjem, setHjem] = useState(tip ? String(tip.hjemme) : "");
  const [bort, setBort] = useState(tip ? String(tip.borte) : "");
  // Lagrings-status så brukeren ser at tippet faktisk nådde serveren —
  // ikke bare ble skrevet til lokal cache.
  const [lagreStatus, setLagreStatus] = useState<
    "idle" | "lagrer" | "ok" | "feil"
  >("idle");
  const montert = useRef(true);
  useEffect(() => {
    montert.current = true;
    return () => {
      montert.current = false;
    };
  }, []);

  useEffect(() => {
    if (tip) {
      setHjem(String(tip.hjemme));
      setBort(String(tip.borte));
    } else {
      setHjem("");
      setBort("");
    }
  }, [tip]);

  const gyldig =
    hjem !== "" && bort !== "" && Number(hjem) >= 0 && Number(bort) >= 0;
  const tom = hjem === "" && bort === "";
  const erNorge = erNorgeKamp(kamp);
  const uendret =
    tip && gyldig && Number(hjem) === tip.hjemme && Number(bort) === tip.borte;

  async function utførLagre(h: number, b: number) {
    setLagreStatus("lagrer");
    try {
      await onLagre(h, b);
      if (montert.current) setLagreStatus("ok");
    } catch {
      if (montert.current) setLagreStatus("feil");
      varsle("Tippet ble ikke bekreftet — sjekk nett og prøv igjen.");
    }
  }
  async function utførSlett() {
    setLagreStatus("lagrer");
    try {
      await onSlett();
      if (montert.current) setLagreStatus("idle");
    } catch {
      if (montert.current) setLagreStatus("feil");
      varsle("Kunne ikke slette tippet — sjekk nett og prøv igjen.");
    }
  }

  // Siste «ulagrede» handling holdes i en ref, så vi kan flushe den umiddelbart
  // ved blur eller når kortet forsvinner (f.eks. bytte side innen 500 ms) i
  // stedet for å miste den når debounce-timeren ryddes.
  const flushRef = useRef<() => void>(() => {});
  flushRef.current = () => {
    if (blokkert || uendret) return;
    if (gyldig) utførLagre(Number(hjem), Number(bort));
    else if (tom && tip) utførSlett();
  };

  useEffect(() => {
    if (blokkert || uendret) return;
    if (gyldig || (tom && tip)) {
      const t = setTimeout(() => flushRef.current(), 500);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hjem, bort, gyldig, tom, uendret, Boolean(tip), blokkert]);

  // Flush ved unmount: taster man inn et tipp og bytter side / lukker appen
  // innen debounce-vinduet, lagres det likevel før kortet rives ned.
  useEffect(
    () => () => {
      flushRef.current();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const dato = new Date(kamp.starttid);
  const klokke = dato.toLocaleTimeString("nb-NO", {
    hour: "2-digit",
    minute: "2-digit",
  });

  let status: { tekst: string; farge: string } | null = null;
  if (kamp.resultat && tip) {
    const p = beregnPoeng(tip, kamp.resultat, kamp.bonusFaktor || 1);
    if (p >= 3) status = { tekst: `Eksakt! +${p}p`, farge: "text-success" };
    else if (p >= 1)
      status = { tekst: `Riktig utfall +${p}p`, farge: "text-accent" };
    else status = { tekst: "Feil tipp", farge: "text-danger" };
  }

  return (
    <div
      className={`relative bg-surface border rounded-2xl p-3 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-card ${
        erNorge
          ? "border-norge/40 bg-gradient-to-br from-norge/10 via-surface to-surface hover:border-norge/60"
          : "border-border hover:border-primary/40"
      }`}
    >
      <div className="flex items-center justify-between text-[10px] mb-2.5">
        <div className="flex items-center gap-2">
          <span className="font-bold text-muted">{klokke}</span>
          <span className="text-muted/60">·</span>
          <span className="text-muted">{kamp.runde}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {kamp.bonusFaktor > 1 && (
            <span className="px-2 py-0.5 rounded-full bg-norge/15 text-norge font-bold tracking-wider">
              ×{kamp.bonusFaktor} POENG
            </span>
          )}
          {redigerStengt && !kamp.resultat && (
            <span className="px-2 py-0.5 rounded-full bg-warning/15 text-warning font-bold tracking-wider">
              🔒 LÅST
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <div className="flex items-center justify-end gap-2 min-w-0">
          <span className="font-semibold text-sm truncate">
            {kortLagNavn(kamp.hjemmelag)}
          </span>
          <span className="text-2xl flex-shrink-0">{flagg(kamp.hjemmelag)}</span>
        </div>
        <div className="relative flex items-center gap-1.5">
          <Sc
            verdi={hjem}
            onChange={setHjem}
            disabled={blokkert}
            onBlur={() => flushRef.current()}
          />
          <span className="text-muted/60 text-xs font-bold">:</span>
          <Sc
            verdi={bort}
            onChange={setBort}
            disabled={blokkert}
            onBlur={() => flushRef.current()}
          />
          {blokkert && (
            <div
              className="absolute inset-0 cursor-not-allowed"
              onPointerDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                varsle(
                  frosset
                    ? "Du er frosset — kan ikke endre tips."
                    : "Kampen er låst.",
                );
              }}
            />
          )}
        </div>
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-2xl flex-shrink-0">{flagg(kamp.bortelag)}</span>
          <span className="font-semibold text-sm truncate">
            {kortLagNavn(kamp.bortelag)}
          </span>
        </div>
      </div>

      {!blokkert && !kamp.resultat && lagreStatus !== "idle" && (
        <div className="mt-2 text-center text-[10px] font-semibold">
          {lagreStatus === "lagrer" && (
            <span className="text-muted">Lagrer…</span>
          )}
          {lagreStatus === "ok" && (
            <span className="text-success">✓ Lagret</span>
          )}
          {lagreStatus === "feil" && (
            <span className="text-danger">⚠ Ikke bekreftet – sjekk nett</span>
          )}
        </div>
      )}

      {kamp.resultat && (
        <div className="mt-2 pt-2 border-t border-border flex items-center justify-between">
          <div className="text-[11px]">
            <span className="text-muted">Fasit </span>
            <span className="font-bold tabular-nums">
              {kamp.resultat.hjemme}–{kamp.resultat.borte}
            </span>
          </div>
          {status && (
            <span className={`text-[11px] font-bold ${status.farge}`}>
              {status.tekst}
            </span>
          )}
        </div>
      )}

      {redigerStengt && <AlleTipsForKamp kamp={kamp} />}
    </div>
  );
}

function Sc({
  verdi,
  onChange,
  disabled,
  onBlur,
}: {
  verdi: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  onBlur?: () => void;
}) {
  return (
    <input
      type="number"
      inputMode="numeric"
      min={0}
      max={20}
      value={verdi}
      disabled={disabled}
      onBlur={onBlur}
      onChange={(e) =>
        onChange(e.target.value.replace(/[^0-9]/g, "").slice(0, 2))
      }
      className="w-12 h-12 text-center text-xl font-bold tabular-nums rounded-xl bg-elevated border border-border focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15 focus:shadow-glow transition disabled:opacity-50 disabled:cursor-not-allowed"
    />
  );
}
