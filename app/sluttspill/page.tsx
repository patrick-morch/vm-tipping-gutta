"use client";

import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, type CSSProperties } from "react";
import { useAuth } from "@/lib/auth-context";
import { useKamper, useMineTips, useFasit } from "@/lib/data";
import { GRUPPER, NORGE, erTippbar, flagg, kortLagNavn } from "@/lib/vm-data";
import { beregnTabell, kamperMedMineTips } from "@/lib/standings";
import Skall from "@/components/Skall";
import Beskytt from "@/components/Beskytt";
import SideHeader from "@/components/SideHeader";

export default function SluttspillSide() {
  return (
    <Beskytt>
      <Skall>
        <Suspense fallback={<div className="text-muted text-sm">Laster…</div>}>
          <Sluttspill />
        </Suspense>
      </Skall>
    </Beskytt>
  );
}

function Sluttspill() {
  const search = useSearchParams();
  const router = useRouter();
  const fane = search.get("fane") === "knockout" ? "knockout" : "grupper";

  return (
    <div className="space-y-4">
      <SideHeader
        tittel="Sluttspill"
        undertittel={
          fane === "grupper"
            ? "Tipp resultater — tabellen oppdaterer seg"
            : "Knockout-runder fra 28. juni"
        }
      />

      <div className="grid grid-cols-2 gap-1.5 bg-surface border border-border rounded-2xl p-1.5">
        <button
          onClick={() => router.push("/sluttspill")}
          className={`h-10 rounded-xl text-sm font-semibold transition active:scale-[0.98] ${
            fane === "grupper"
              ? "bg-primary text-primaryFg"
              : "text-muted hover:text-text"
          }`}
        >
          Grupper
        </button>
        <button
          onClick={() => router.push("/sluttspill?fane=knockout")}
          className={`h-10 rounded-xl text-sm font-semibold transition active:scale-[0.98] ${
            fane === "knockout"
              ? "bg-primary text-primaryFg"
              : "text-muted hover:text-text"
          }`}
        >
          Knockout
        </button>
      </div>

      {fane === "grupper" ? <GrupperFane /> : <KnockoutFane />}
    </div>
  );
}

function GrupperFane() {
  const { user } = useAuth();
  const kamper = useKamper();
  const tips = useMineTips(user?.uid);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
      {GRUPPER.map((g) => {
        const gruppeKamper = kamper.filter(
          (k) => k.runde === `Gruppe ${g.id}`,
        );
        const predikert = beregnTabell(
          g.lag,
          kamperMedMineTips(gruppeKamper, tips),
        );
        const tippbare = gruppeKamper.filter(erTippbar);
        const tippet = tippbare.filter((k) => tips[k.id]).length;
        const totalTippbar = tippbare.length;
        const harNorge = g.lag.includes(NORGE);
        return (
          <Link
            key={g.id}
            href={`/sluttspill/${g.id}`}
            className={`bg-surface border rounded-2xl p-3 transition hover:border-primary ${
              harNorge ? "border-norge/40" : "border-border"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-elevated border border-border flex items-center justify-center text-xs font-bold">
                  {g.id}
                </div>
                <span className="font-semibold text-sm">Gruppe {g.id}</span>
                {harNorge && (
                  <span className="px-1.5 py-0.5 rounded-full bg-norge/15 text-norge text-[9px] font-bold">
                    NOR
                  </span>
                )}
              </div>
              <span className="text-[10px] text-muted">
                {tippet}/{totalTippbar} tippet
              </span>
            </div>
            <div className="space-y-1">
              {predikert.map((s) => (
                <div
                  key={s.lag}
                  className={`flex items-center justify-between text-xs ${
                    s.lag === NORGE ? "text-norge font-semibold" : ""
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`w-4 text-right font-bold ${
                        s.posisjon === 1
                          ? "text-success"
                          : s.posisjon === 2
                            ? "text-accent"
                            : s.posisjon === 3
                              ? "text-muted"
                              : "text-text/40"
                      }`}
                    >
                      {s.posisjon}
                    </span>
                    <span className="truncate">
                      <span className="mr-1">{flagg(s.lag)}</span>
                      {kortLagNavn(s.lag)}
                    </span>
                  </div>
                  <span className="font-mono text-muted">
                    {s.målFor}-{s.målMot} ·{" "}
                    <span className="text-text font-bold">{s.poeng}</span>
                  </span>
                </div>
              ))}
            </div>
          </Link>
        );
      })}
    </div>
  );
}

// Antall spor (rader) per halvdel = antall kamper i ytterste runde.
const SPOR = 8;
// Radhøyden tilpasser seg skjermhøyden (clamp), men holdes lesbar.
const RAD = "clamp(50px, 7.4vh, 74px)";
const STUB = 10; // lengde på horisontale connector-stubber

type Runde = { id: string; kort: string; periode: string; kamper: number };

// Rundenavn følger de kanoniske `runde`-strengene fra auto-sync
// (scripts/sync-resultater.mjs) slik at brackettet matcher /kamper-siden.
// Ytre runde har 8 kamper per halvdel (= 16 totalt).
const RUNDER_YTRE_TIL_INDRE: Runde[] = [
  { id: "32del", kort: "32-delsfinale", periode: "28/6 – 3/7", kamper: 8 },
  { id: "16del", kort: "16-delsfinale", periode: "4 – 7/7", kamper: 4 },
  { id: "kvart", kort: "Kvartfinale", periode: "9 – 11/7", kamper: 2 },
  { id: "semi", kort: "Semifinale", periode: "14 – 15/7", kamper: 1 },
];

// Hele runder (begge halvdeler slått sammen) — brukes i mobil-visningen.
const HELE_RUNDER: Runde[] = [
  { id: "32del", kort: "32-delsfinale", periode: "28/6 – 3/7", kamper: 16 },
  { id: "16del", kort: "16-delsfinale", periode: "4 – 7/7", kamper: 8 },
  { id: "kvart", kort: "Kvartfinale", periode: "9 – 11/7", kamper: 4 },
  { id: "semi", kort: "Semifinale", periode: "14 – 15/7", kamper: 2 },
];

function KnockoutFane() {
  return (
    <div className="space-y-3">
      {/* Desktop: konvergerende to-sidig bracket */}
      <div className="hidden lg:block">
        <BracketDesktop />
      </div>

      {/* Mobil/tablet: vertikal runde-for-runde — ingen horisontal scroll */}
      <div className="lg:hidden">
        <RunderMobil />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div className="bg-surface border border-border rounded-2xl p-3 text-center text-xs text-muted">
          Lagene fylles automatisk inn etter trekningen 27. juni.
        </div>
        <Link
          href="/kamper"
          className="bg-surface border border-primary/30 rounded-2xl p-3 text-center text-xs text-primary font-semibold hover:bg-primary/5 transition"
        >
          Tipp neste kamper →
        </Link>
      </div>
    </div>
  );
}

function BracketDesktop() {
  const venstre = RUNDER_YTRE_TIL_INDRE;
  const høyre = [...RUNDER_YTRE_TIL_INDRE].reverse();

  return (
    <div className="relative bg-gradient-to-br from-surface via-surface to-elevated/30 border border-border rounded-3xl p-4 overflow-x-auto">
      {/* Subtilt bakgrunnsglød bak finalen */}
      <div className="absolute inset-0 pointer-events-none opacity-40 [background-image:radial-gradient(circle_at_center,rgb(var(--gold)/0.07)_0,transparent_60%)]" />

      <div
        className="relative flex items-stretch w-full min-w-[860px]"
        style={{ "--rad": RAD } as CSSProperties}
      >
        {/* Venstre halvdel: ytre → indre (flyt mot høyre) */}
        <Halvdel side="venstre" runder={venstre} />

        {/* Sentrum: pokal, finale og bronse */}
        <SentrumKolonne />

        {/* Høyre halvdel: indre → ytre (flyt mot venstre) */}
        <Halvdel side="høyre" runder={høyre} />
      </div>
    </div>
  );
}

// Mobil: rundene stablet vertikalt, kamper i kompakt 2-kolonners rutenett.
function RunderMobil() {
  const kamper = useKamper();
  const fasit = useFasit();
  const finale = kamper.find((k) => k.runde === "Finale");
  const bronse = kamper.find((k) => k.runde === "Bronsefinale");

  return (
    <div className="space-y-3">
      {HELE_RUNDER.map((r) => (
        <div
          key={r.id}
          className="bg-gradient-to-br from-surface to-elevated/30 border border-border rounded-2xl p-3"
        >
          <div className="flex items-baseline justify-between mb-2.5">
            <h3 className="text-xs font-bold uppercase tracking-[0.1em] text-muted">
              {r.kort}
            </h3>
            <span className="text-[10px] text-muted/70">{r.periode}</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {Array.from({ length: r.kamper }).map((_, i) => (
              <KampKort key={i} />
            ))}
          </div>
        </div>
      ))}

      {/* Finale */}
      <div className="relative bg-gradient-to-br from-gold/12 via-gold/5 to-transparent border border-gold/30 rounded-2xl p-4">
        <div className="flex items-baseline justify-between mb-3">
          <h3 className="text-xs font-bold uppercase tracking-[0.1em] text-gold">
            Finale
          </h3>
          <span className="text-[10px] text-gold/70">19. juli</span>
        </div>
        <div className="max-w-[260px] mx-auto flex flex-col items-center gap-3">
          <VinnerKort mester={fasit.vmVinner} />
          <FinaleKort kamp={finale} />
        </div>
      </div>

      {/* Bronsefinale */}
      <div className="bg-gradient-to-br from-surface to-elevated/30 border border-border rounded-2xl p-3">
        <div className="flex items-baseline justify-between mb-2.5">
          <h3 className="text-xs font-bold uppercase tracking-[0.1em] text-warning">
            Bronsefinale
          </h3>
          <span className="text-[10px] text-warning/70">18. juli</span>
        </div>
        <div className="max-w-[200px] mx-auto">
          <BronseKort kamp={bronse} />
        </div>
      </div>
    </div>
  );
}

function Halvdel({ side, runder }: { side: "venstre" | "høyre"; runder: Runde[] }) {
  const erVenstre = side === "venstre";
  // Indre side = mot sentrum. Ytre side = mot kanten.
  const indreSide = erVenstre ? "right" : "left";
  const ytreSide = erVenstre ? "left" : "right";

  return (
    <div className="flex items-stretch flex-1">
      {runder.map((r, ri) => {
        const radPerKamp = SPOR / r.kamper;
        // Mottar denne kolonnen et par fra runden lenger ut?
        // Venstre: ytre er til venstre → kolonner etter den første (ri>0).
        // Høyre: ytre er til høyre → kolonner før den siste (ri<lengde-1).
        const mottar = erVenstre ? ri > 0 : ri < runder.length - 1;

        return (
          <div key={r.id} className="flex-1 min-w-0">
            <div className="mb-3 text-center">
              <div className="text-[10px] font-bold text-muted uppercase tracking-[0.08em]">
                {r.kort}
              </div>
              <div className="text-[9px] text-muted/70 mt-0.5">{r.periode}</div>
            </div>
            <div
              className="grid"
              style={{ gridTemplateRows: `repeat(${SPOR}, var(--rad))` }}
            >
              {Array.from({ length: r.kamper }).map((_, i) => (
                <div
                  key={i}
                  style={{ gridRow: `${i * radPerKamp + 1} / span ${radPerKamp}` }}
                  className="flex items-center px-1 relative"
                >
                  {/* Stub mot sentrum (mater neste runde) */}
                  <div
                    className="absolute top-1/2 h-px bg-border/60"
                    style={{ [indreSide]: -STUB, width: STUB }}
                  />
                  {/* Mottak fra ytre runde: stub + vertikal som binder paret */}
                  {mottar && (
                    <>
                      <div
                        className="absolute top-1/2 h-px bg-border/60"
                        style={{ [ytreSide]: -STUB, width: STUB }}
                      />
                      <div
                        className="absolute w-px bg-border/60"
                        style={{
                          [ytreSide]: -STUB,
                          top: `calc(var(--rad) * ${radPerKamp / 4})`,
                          height: `calc(var(--rad) * ${radPerKamp / 2})`,
                        }}
                      />
                    </>
                  )}
                  <KampKort />
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SentrumKolonne() {
  const kamper = useKamper();
  const fasit = useFasit();
  const finale = kamper.find((k) => k.runde === "Finale");
  const bronse = kamper.find((k) => k.runde === "Bronsefinale");

  return (
    <div className="flex-none w-[150px] xl:w-[168px] px-1">
      <div className="mb-3 text-center">
        <div className="text-[10px] font-bold text-gold uppercase tracking-[0.1em]">
          Finale
        </div>
        <div className="text-[9px] text-gold/70 mt-0.5">19. juli</div>
      </div>
      <div
        className="flex flex-col items-center justify-center gap-3 relative"
        style={{ height: `calc(var(--rad) * ${SPOR})` }}
      >
        {/* Stubber inn fra begge semifinaler */}
        <div className="absolute left-[-14px] top-1/2 w-3.5 h-px bg-gold/40" />
        <div className="absolute right-[-14px] top-1/2 w-3.5 h-px bg-gold/40" />

        <VinnerKort mester={fasit.vmVinner} />
        <FinaleKort kamp={finale} />
        <BronseKort kamp={bronse} />
      </div>
    </div>
  );
}

function BronseKort({
  kamp,
}: {
  kamp?: { hjemmelag: string; bortelag: string; resultat?: { hjemme: number; borte: number } | null };
}) {
  const lagH = kamp ? kortLagNavn(kamp.hjemmelag) : "TBD";
  const lagB = kamp ? kortLagNavn(kamp.bortelag) : "TBD";
  const fH = kamp ? flagg(kamp.hjemmelag) : "🏳";
  const fB = kamp ? flagg(kamp.bortelag) : "🏳";
  const scoreH = kamp?.resultat?.hjemme ?? "–";
  const scoreB = kamp?.resultat?.borte ?? "–";

  return (
    <div className="w-full bg-gradient-to-br from-warning/15 via-warning/5 to-transparent border border-warning/40 rounded-xl overflow-hidden shadow-[0_0_24px_rgb(var(--warning)/0.08)]">
      <div className="text-center pt-2 pb-1">
        <div className="text-2xl leading-none">🥉</div>
      </div>
      <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 border-t border-warning/15">
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <span className="text-sm flex-shrink-0">{fH}</span>
          <span className="text-[11px] text-muted truncate">{lagH}</span>
        </div>
        <span className="text-xs text-muted font-mono tabular-nums w-4 text-right">
          {scoreH}
        </span>
      </div>
      <div className="flex items-center justify-between gap-2 px-2.5 py-1.5">
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <span className="text-sm flex-shrink-0">{fB}</span>
          <span className="text-[11px] text-muted truncate">{lagB}</span>
        </div>
        <span className="text-xs text-muted font-mono tabular-nums w-4 text-right">
          {scoreB}
        </span>
      </div>
    </div>
  );
}

// Én lag-rad i et bracket-kort.
function LagRad({ medSkille }: { medSkille?: boolean }) {
  return (
    <div
      className={`flex items-center justify-between gap-2 px-2.5 py-1.5 ${
        medSkille ? "border-b border-border/40" : ""
      }`}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <div className="w-4 h-4 rounded-full bg-border/60 border border-border flex-shrink-0" />
        <span className="text-[11px] text-muted truncate">TBD</span>
      </div>
      <span className="text-xs text-muted font-mono tabular-nums w-4 text-right">
        –
      </span>
    </div>
  );
}

function KampKort() {
  return (
    <div className="w-full rounded-lg overflow-hidden bg-elevated border border-border hover:border-primary/40 transition-colors">
      <LagRad medSkille />
      <LagRad />
    </div>
  );
}

// Én lag-rad i finale-kortet — gull-tonet, viser ekte lag når det finnes.
function FinaleRad({
  flagg: f,
  navn,
  score,
  medSkille,
}: {
  flagg: string;
  navn: string;
  score: number | string;
  medSkille?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-2 px-2.5 py-2 ${
        medSkille ? "border-b border-gold/20" : ""
      }`}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <span className="text-sm flex-shrink-0">{f}</span>
        <span className="text-[11px] text-gold/80 truncate">{navn}</span>
      </div>
      <span className="text-xs text-gold/70 font-mono tabular-nums w-4 text-right">
        {score}
      </span>
    </div>
  );
}

// Finale-kampen i sentrum — gull-fremhevet. Synker med live kampdata.
function FinaleKort({
  kamp,
}: {
  kamp?: { hjemmelag: string; bortelag: string; resultat?: { hjemme: number; borte: number } | null };
}) {
  const lagH = kamp ? kortLagNavn(kamp.hjemmelag) : "TBD";
  const lagB = kamp ? kortLagNavn(kamp.bortelag) : "TBD";
  const fH = kamp ? flagg(kamp.hjemmelag) : "🏳";
  const fB = kamp ? flagg(kamp.bortelag) : "🏳";
  const scoreH = kamp?.resultat?.hjemme ?? "–";
  const scoreB = kamp?.resultat?.borte ?? "–";

  return (
    <div className="w-full rounded-xl overflow-hidden border border-gold/40 bg-gradient-to-br from-gold/15 via-gold/5 to-transparent shadow-[0_0_24px_rgb(var(--gold)/0.1)]">
      <FinaleRad flagg={fH} navn={lagH} score={scoreH} medSkille />
      <FinaleRad flagg={fB} navn={lagB} score={scoreB} />
    </div>
  );
}

// Mester/pokal-kortet som kroner sentrum. Synker med fasit.vmVinner.
function VinnerKort({ mester }: { mester?: string }) {
  const harMester = !!mester;
  return (
    <div className="relative w-full rounded-2xl overflow-hidden">
      <div className="absolute -inset-3 bg-gold/10 blur-2xl pointer-events-none" />
      <div className="relative border-2 border-gold/50 rounded-2xl px-3 py-3 text-center bg-bg/40 backdrop-blur">
        <div className="text-3xl mb-1 drop-shadow-[0_2px_8px_rgb(var(--gold)/0.4)]">
          🏆
        </div>
        <div className="text-[9px] text-gold uppercase tracking-[0.15em] font-bold mb-1">
          Verdensmester
        </div>
        <div className="text-sm font-bold text-gold/80">
          {harMester ? (
            <span>
              <span className="mr-1">{flagg(mester!)}</span>
              {kortLagNavn(mester!)}
            </span>
          ) : (
            "TBD"
          )}
        </div>
      </div>
    </div>
  );
}
