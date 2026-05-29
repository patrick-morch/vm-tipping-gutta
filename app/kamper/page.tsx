"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useKamper, useMineTips, lagreTip, slettTip } from "@/lib/data";
import { Match, Prediction, beregnPoeng } from "@/lib/types";
import {
  erNorgeKamp,
  erTippbar,
  flagg,
  kortLagNavn,
  LÅS_FØR_KAMP_MS,
} from "@/lib/vm-data";
import Skall from "@/components/Skall";
import Beskytt from "@/components/Beskytt";
import SideHeader from "@/components/SideHeader";
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
    .filter((k) => k.starttid - LÅS_FØR_KAMP_MS > nå && erTippbar(k))
    .sort((a, b) => a.starttid - b.starttid);
  const neste = åpne.slice(0, ANTALL);
  const utenTip = neste.filter((k) => !tips[k.id]).length;

  const sisteFerdige = kamper
    .filter((k) => k.resultat && k.starttid < nå)
    .sort((a, b) => b.starttid - a.starttid)
    .slice(0, 3);

  async function lagre(id: string, h: number, b: number) {
    if (!user || !bruker || frosset) return;
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
  const grupperte = grupperEtterDag(neste, nå);

  const førsteKamp = neste[0];
  const nedTekst = førsteKamp ? formatTid(førsteKamp.starttid - nå) : null;

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

      {frosset && (
        <div className="bg-warning/10 border border-warning/30 text-warning text-sm rounded-2xl px-4 py-3 flex items-center gap-2">
          <span className="text-lg">❄️</span>
          Du er frosset av admin. Du kan se kampene, men ikke tippe.
        </div>
      )}

      {/* På desktop: kamper venstre, Cantona-kicket sticky til høyre */}
      <div className="lg:grid lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:gap-6 lg:items-start space-y-5 lg:space-y-0">
        <div className="space-y-5">
          {neste.length === 0 && (
            <div className="bg-surface border border-border rounded-2xl p-8 text-center text-muted text-sm">
              Ingen åpne kamper akkurat nå.
            </div>
          )}

          {grupperte.map(({ dato, kamper: dagsKamper }) => (
            <div key={dato} className="space-y-2">
              <DatoHeader dato={dato} nå={nå} />
              <div
                className="space-y-2"
                onPointerDownCapture={
                  frosset
                    ? (e) => {
                        const t = e.target as HTMLElement;
                        if (t.tagName === "INPUT" || t.closest("input")) {
                          e.preventDefault();
                          e.stopPropagation();
                          varsle();
                        }
                      }
                    : undefined
                }
              >
                {dagsKamper.map((kamp) => (
                  <KampKort
                    key={kamp.id}
                    kamp={kamp}
                    tip={tips[kamp.id]}
                    frosset={frosset}
                    onLagre={(h, b) => lagre(kamp.id, h, b)}
                    onSlett={() => slett(kamp.id)}
                  />
                ))}
              </div>
            </div>
          ))}

          {åpne.length > ANTALL && (
            <Link
              href="/sluttspill"
              className="block text-center bg-surface border border-border hover:border-primary rounded-2xl py-3 text-sm font-medium transition"
            >
              Se alle {åpne.length} åpne kamper →
            </Link>
          )}

          {sisteFerdige.length > 0 && (
            <div className="space-y-2 pt-2">
              <div className="text-[10px] uppercase tracking-[0.15em] font-bold text-muted px-1">
                Siste resultater
              </div>
              <div className="space-y-2">
                {sisteFerdige.map((kamp) => (
                  <ResultatKort
                    key={kamp.id}
                    kamp={kamp}
                    tip={tips[kamp.id]}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        <aside className="hidden lg:block lg:sticky lg:top-20">
          <div className="relative overflow-hidden rounded-3xl border border-border">
            <img
              src="/cantona-kick.jpeg"
              alt="Eric Cantona, Selhurst Park, 25. januar 1995"
              className="w-full aspect-[3/4] object-cover object-left"
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
  onLagre,
  onSlett,
}: {
  kamp: Match;
  tip?: Prediction;
  frosset?: boolean;
  onLagre: (h: number, b: number) => Promise<void>;
  onSlett: () => Promise<void>;
}) {
  const [hjem, setHjem] = useState(tip ? String(tip.hjemme) : "");
  const [bort, setBort] = useState(tip ? String(tip.borte) : "");
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

  useEffect(() => {
    if (frosset || uendret) return;
    if (gyldig) {
      const t = setTimeout(() => onLagre(Number(hjem), Number(bort)), 500);
      return () => clearTimeout(t);
    }
    if (tom && tip) {
      const t = setTimeout(() => onSlett(), 500);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hjem, bort, gyldig, tom, uendret, Boolean(tip), frosset]);

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
      className={`relative bg-surface border rounded-2xl p-3 transition ${
        erNorge ? "border-norge/40" : "border-border"
      }`}
    >
      <div className="flex items-center justify-between text-[10px] mb-2.5">
        <div className="flex items-center gap-2">
          <span className="font-bold text-muted">{klokke}</span>
          <span className="text-muted/60">·</span>
          <span className="text-muted">{kamp.runde}</span>
        </div>
        {kamp.bonusFaktor > 1 && (
          <span className="px-2 py-0.5 rounded-full bg-norge/15 text-norge font-bold tracking-wider">
            ×{kamp.bonusFaktor} POENG
          </span>
        )}
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <div className="flex items-center justify-end gap-2 min-w-0">
          <span className="font-semibold text-sm truncate">
            {kortLagNavn(kamp.hjemmelag)}
          </span>
          <span className="text-2xl flex-shrink-0">{flagg(kamp.hjemmelag)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Sc verdi={hjem} onChange={setHjem} disabled={frosset} />
          <span className="text-muted/60 text-xs font-bold">:</span>
          <Sc verdi={bort} onChange={setBort} disabled={frosset} />
        </div>
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-2xl flex-shrink-0">{flagg(kamp.bortelag)}</span>
          <span className="font-semibold text-sm truncate">
            {kortLagNavn(kamp.bortelag)}
          </span>
        </div>
      </div>

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
    </div>
  );
}

function ResultatKort({ kamp, tip }: { kamp: Match; tip?: Prediction }) {
  if (!kamp.resultat) return null;
  let status: { tekst: string; farge: string } | null = null;
  if (tip) {
    const p = beregnPoeng(tip, kamp.resultat, kamp.bonusFaktor || 1);
    if (p >= 3) status = { tekst: `+${p}p eksakt`, farge: "text-success" };
    else if (p >= 1)
      status = { tekst: `+${p}p utfall`, farge: "text-accent" };
    else status = { tekst: "0p", farge: "text-muted" };
  }
  const erNorge = erNorgeKamp(kamp);
  return (
    <div
      className={`bg-surface/60 border rounded-xl p-2.5 ${
        erNorge ? "border-norge/30" : "border-border/60"
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="text-base flex-shrink-0">{flagg(kamp.hjemmelag)}</span>
        <span className="text-xs font-medium truncate flex-1 text-right">
          {kortLagNavn(kamp.hjemmelag)}
        </span>
        <span className="font-bold text-sm tabular-nums px-2 py-0.5 rounded bg-elevated border border-border">
          {kamp.resultat.hjemme}–{kamp.resultat.borte}
        </span>
        <span className="text-xs font-medium truncate flex-1">
          {kortLagNavn(kamp.bortelag)}
        </span>
        <span className="text-base flex-shrink-0">{flagg(kamp.bortelag)}</span>
      </div>
      {status && (
        <div className="text-center mt-1">
          <span className={`text-[10px] font-bold ${status.farge}`}>
            {status.tekst}
          </span>
        </div>
      )}
    </div>
  );
}

function Sc({
  verdi,
  onChange,
  disabled,
}: {
  verdi: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <input
      type="number"
      inputMode="numeric"
      min={0}
      max={20}
      value={verdi}
      disabled={disabled}
      onChange={(e) =>
        onChange(e.target.value.replace(/[^0-9]/g, "").slice(0, 2))
      }
      className="w-12 h-12 text-center text-xl font-bold rounded-xl bg-elevated border border-border focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition disabled:opacity-50 disabled:cursor-not-allowed"
    />
  );
}
