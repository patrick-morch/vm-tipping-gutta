"use client";

import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useMemo, useState, type CSSProperties } from "react";
import { useAuth } from "@/lib/auth-context";
import { useKamper, useMineTips, useFasit } from "@/lib/data";
import type { Match } from "@/lib/types";
import {
  GRUPPER,
  NORGE,
  erTippbar,
  flagg,
  kortLagNavn,
} from "@/lib/vm-data";
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
              ? "bg-primary text-primaryFg shadow-glow"
              : "text-muted hover:text-text"
          }`}
        >
          Grupper
        </button>
        <button
          onClick={() => router.push("/sluttspill?fane=knockout")}
          className={`h-10 rounded-xl text-sm font-semibold transition active:scale-[0.98] ${
            fane === "knockout"
              ? "bg-primary text-primaryFg shadow-glow"
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
            className={`bg-surface border rounded-2xl p-3 transition-all duration-150 hover:border-primary hover:-translate-y-0.5 hover:shadow-card ${
              harNorge
                ? "border-norge/40 bg-gradient-to-br from-norge/10 via-surface to-surface"
                : "border-border"
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

// Grupperer knockout-kamper per runde, sortert på avspark. Brukes til å
// fylle bracket-sporene med ekte lag etterhvert som sync-jobben oppretter dem.

// Et bracket-spor: enten et ekte lag (når gruppa er ferdig / kampen er synket)
// eller en posisjons-etikett ("Vinner gruppe A", "2'er gruppe C", "3.-plass …").
type Lagslot = { lag?: string; label: string; kode?: string };
type BracketKamp = {
  id: string;
  runde: string;
  a: Lagslot;
  b: Lagslot;
  starttid?: number;
  resultat?: { hjemme: number; borte: number } | null;
};

// Offisielt 16-delsfinale-oppsett (VM 2026, kamp 73–88), lagt i den rekkefølgen
// braket-treet forventer: indeks 0–7 = venstre halvdel, 8–15 = høyre halvdel.
// Paringen mater R16/kvart/semi slik FIFA har fastsatt, så vinnerne flyter
// riktig vei mot finalen. "3:ABCDF" = beste 3.-plass fra én av de gruppene.
const POSISJON_R32: [string, string][] = [
  ["2A", "2B"], // 73
  ["1F", "2C"], // 75
  ["1E", "3:ABCDF"], // 74
  ["1I", "3:CDFGH"], // 77
  ["2K", "2L"], // 83
  ["1H", "2J"], // 84
  ["1D", "3:BEFIJ"], // 81
  ["1G", "3:AEHIJ"], // 82
  ["1C", "2F"], // 76
  ["2E", "2I"], // 78
  ["1A", "3:CEFHI"], // 79
  ["1L", "3:EHIJK"], // 80
  ["1J", "2H"], // 86
  ["2D", "2G"], // 88
  ["1B", "3:EFGIJ"], // 85
  ["1K", "3:DEIJL"], // 87
];

type GruppeStatus = {
  ferdig: boolean;
  tabell: ReturnType<typeof beregnTabell>;
};

// Slår opp ekte lag for en posisjonskode hvis gruppa er ferdigspilt, ellers
// returnerer den bare etiketten. 3.-plass-koden kan ikke knyttes til ett lag
// før hele gruppespillet er over (FIFA-tabell med 495 kombinasjoner), så den
// vises alltid som etikett.
function lagFraKode(
  kode: string,
  grupper: Map<string, GruppeStatus>,
  // Gruppebokstav → 3.-plass-lag, kun for de 8 som faktisk er videre. Tom til
  // hele gruppespillet er ferdig.
  kvalifiserteTreere: Map<string, string>,
): Lagslot {
  if (kode.startsWith("3:")) {
    const kandidatGrupper = kode.slice(2).split("");
    // Smal inn til de gruppene hvis 3.-plass faktisk gikk videre.
    const videre = kandidatGrupper.filter((g) => kvalifiserteTreere.has(g));
    // Når bare ÉN av kandidatgruppene er blant de 8 beste treerne, er sporet
    // entydig bestemt → vis det ekte laget. (Den fulle FIFA-fordelingen av
    // treere på spor kommer uansett inn automatisk når trekningen synkes.)
    if (kvalifiserteTreere.size > 0 && videre.length === 1) {
      return {
        lag: kvalifiserteTreere.get(videre[0]),
        label: `3.-plass gruppe ${videre[0]}`,
        kode: "3.",
      };
    }
    const vis = videre.length > 0 ? videre : kandidatGrupper;
    return { label: `3.-plass (${vis.join("/")})`, kode: "3." };
  }
  const pos = Number(kode[0]);
  const bokstav = kode[1];
  const label =
    pos === 1 ? `Vinner gruppe ${bokstav}` : `2'er gruppe ${bokstav}`;
  const g = grupper.get(bokstav);
  if (g?.ferdig && g.tabell[pos - 1]) {
    return { lag: g.tabell[pos - 1].lag, label, kode };
  }
  return { label, kode };
}

// De 8 beste 3.-plassene (av 12 grupper) går videre i 48-lags-formatet.
// Returnerer gruppebokstav → lagnavn, men bare når ALLE grupper er ferdige,
// så vi ikke gjetter mens tabellene fortsatt endrer seg.
function beregnKvalifiserteTreere(
  grupper: Map<string, GruppeStatus>,
): Map<string, string> {
  const ut = new Map<string, string>();
  const alleFerdig = [...grupper.values()].every((g) => g.ferdig);
  if (!alleFerdig) return ut;
  [...grupper.entries()]
    .map(([id, g]) => ({ id, rad: g.tabell[2] }))
    .filter((x) => !!x.rad)
    .sort(
      (a, b) =>
        b.rad.poeng - a.rad.poeng ||
        b.rad.målDiff - a.rad.målDiff ||
        b.rad.målFor - a.rad.målFor,
    )
    .slice(0, 8)
    .forEach((t) => ut.set(t.id, t.rad.lag));
  return ut;
}

// Bygger hele braketten: 16-delsfinalen projiseres fra gruppetabellene (lag
// fylles inn etterhvert som grupper blir ferdige), dypere runder står som TBD
// til de spilles. Ekte synkede knockout-kamper overstyrer projeksjonen.
function useBracket(): Record<string, BracketKamp[]> {
  const kamper = useKamper();
  return useMemo(() => {
    const grupper = new Map<string, GruppeStatus>();
    GRUPPER.forEach((g) => {
      const gk = kamper.filter((k) => k.runde === `Gruppe ${g.id}`);
      const spilt = gk.filter((k) => k.resultat).length;
      grupper.set(g.id, {
        ferdig: gk.length > 0 && spilt === gk.length,
        tabell: beregnTabell(g.lag, gk),
      });
    });

    const kvalifiserteTreere = beregnKvalifiserteTreere(grupper);

    const synket: Record<string, Match[]> = {};
    for (const k of kamper) {
      if (k.runde.startsWith("Gruppe")) continue;
      (synket[k.runde] ||= []).push(k);
    }
    Object.values(synket).forEach((l) =>
      l.sort((a, b) => a.starttid - b.starttid),
    );

    const fraEkte = (m: Match): BracketKamp => ({
      id: m.id,
      runde: m.runde,
      a: { lag: m.hjemmelag, label: "" },
      b: { lag: m.bortelag, label: "" },
      starttid: m.starttid,
      resultat: m.resultat ?? null,
    });

    const out: Record<string, BracketKamp[]> = {};
    out["32-delsfinale"] = POSISJON_R32.map(([ca, cb], i) => {
      const ekte = synket["32-delsfinale"]?.[i];
      if (ekte) return fraEkte(ekte);
      return {
        id: `r32-${i}`,
        runde: "32-delsfinale",
        a: lagFraKode(ca, grupper, kvalifiserteTreere),
        b: lagFraKode(cb, grupper, kvalifiserteTreere),
      };
    });

    const tomme: [string, number][] = [
      ["16-delsfinale", 8],
      ["Kvartfinale", 4],
      ["Semifinale", 2],
      ["Finale", 1],
      ["Bronsefinale", 1],
    ];
    for (const [kort, n] of tomme) {
      out[kort] = Array.from({ length: n }).map((_, i) => {
        const ekte = synket[kort]?.[i];
        if (ekte) return fraEkte(ekte);
        return {
          id: `${kort}-${i}`,
          runde: kort,
          a: { label: "" },
          b: { label: "" },
        };
      });
    }
    return out;
  }, [kamper]);
}

function KnockoutFane() {
  return (
    <div className="space-y-3">
      {/* Live-prognose mens gruppespillet pågår */}
      <KvalifisertNå />

      {/* Desktop: konvergerende to-sidig bracket */}
      <div className="hidden lg:block">
        <BracketDesktop />
      </div>

      {/* Mobil/tablet: VG-stil kart eller detaljert liste */}
      <div className="lg:hidden">
        <KnockoutMobil />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div className="bg-surface border border-border rounded-2xl p-3 text-center text-xs text-muted">
          Lag fylles inn fra ferdigspilte grupper. Motstandere og kamptider
          kommer etterhvert.
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

// Viser hvem som er kvalifisert akkurat nå basert på spilte gruppekamper.
// Oppdateres live mens gruppespillet pågår; forsvinner når braketten er full.
function KvalifisertNå() {
  const kamper = useKamper();

  const data = useMemo(() => {
    const grupper = GRUPPER.map((g) => {
      const gk = kamper.filter((k) => k.runde === `Gruppe ${g.id}`);
      const spilt = gk.filter((k) => k.resultat).length;
      return {
        id: g.id,
        spilt,
        total: gk.length,
        // Ferdig = alle gruppekampene har resultat → de to øverste er låst.
        ferdig: gk.length > 0 && spilt === gk.length,
        tabell: beregnTabell(g.lag, gk),
      };
    });
    const spiltTotalt = grupper.reduce((s, g) => s + g.spilt, 0);
    const totalKamper = grupper.reduce((s, g) => s + g.total, 0);
    const ferdigeGrupper = grupper.filter((g) => g.ferdig).length;
    // 8 beste treere går videre i 48-lags-formatet
    const treere = grupper
      .filter((g) => g.spilt > 0)
      .map((g) => ({ gruppe: g.id, ferdig: g.ferdig, ...g.tabell[2] }))
      .sort(
        (a, b) =>
          b.poeng - a.poeng || b.målDiff - a.målDiff || b.målFor - a.målFor,
      );
    return { grupper, spiltTotalt, totalKamper, treere, ferdigeGrupper };
  }, [kamper]);

  const brakettFull =
    kamper.filter((k) => k.runde === "32-delsfinale").length >= 16;
  if (data.spiltTotalt === 0 || brakettFull) return null;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-surface to-elevated/30 p-4">
      <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full bg-primary/8 blur-3xl pointer-events-none" />
      <div className="relative">
        <div className="flex items-baseline justify-between gap-2 mb-3">
          <h3 className="text-xs font-bold uppercase tracking-[0.1em] text-primary">
            Videre til knockout
          </h3>
          <span className="text-[10px] text-muted">
            {data.ferdigeGrupper > 0 && (
              <span className="text-success font-semibold">
                {data.ferdigeGrupper}/{data.grupper.length} grupper klare
              </span>
            )}
            {data.ferdigeGrupper > 0 && " · "}
            {data.spiltTotalt}/{data.totalKamper} kamper spilt
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {data.grupper.map((g) => (
            <div
              key={g.id}
              className={`rounded-xl px-2.5 py-2 min-w-0 border ${
                g.ferdig
                  ? "bg-success/5 border-success/40"
                  : "bg-elevated/60 border-border"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold text-muted">
                  GRUPPE {g.id}
                </span>
                {g.ferdig ? (
                  <span className="text-[9px] font-bold text-success">
                    ✓ KLAR
                  </span>
                ) : (
                  <span className="text-[9px] text-muted/70 tabular-nums">
                    {g.spilt}/{g.total}
                  </span>
                )}
              </div>
              {g.spilt === 0 ? (
                <div className="text-[11px] text-muted/60 py-1">
                  Ikke startet
                </div>
              ) : (
                g.tabell.slice(0, 2).map((s, i) => (
                  <div
                    key={s.lag}
                    className={`flex items-center gap-1.5 text-[11px] leading-5 min-w-0 ${
                      s.lag === NORGE ? "text-norge font-bold" : ""
                    }`}
                  >
                    <span
                      className={`w-3 text-right font-bold text-[10px] flex-shrink-0 ${
                        i === 0 ? "text-success" : "text-accent"
                      }`}
                    >
                      {i + 1}
                    </span>
                    <span className="flex-shrink-0">{flagg(s.lag)}</span>
                    <span className="truncate font-medium">
                      {kortLagNavn(s.lag)}
                    </span>
                    {g.ferdig && (
                      <span className="ml-auto flex-shrink-0 text-[8px] font-bold uppercase tracking-wider text-success/80">
                        videre
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          ))}
        </div>

        {data.treere.length > 0 && (
          <div className="mt-3 pt-3 border-t border-border/60">
            <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted mb-1.5">
              Beste treere — 8 går videre
            </div>
            <div className="flex flex-wrap gap-1.5">
              {data.treere.map((t, i) => (
                <span
                  key={t.lag}
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-full border text-[10px] font-semibold ${
                    i < 8
                      ? t.lag === NORGE
                        ? "border-norge/50 bg-norge/15 text-norge"
                        : "border-success/40 bg-success/10"
                      : "border-border text-muted opacity-60"
                  }`}
                >
                  {flagg(t.lag)} {kortLagNavn(t.lag)}
                  <span className="text-muted/70 tabular-nums">{t.poeng}p</span>
                  {t.ferdig && i < 8 && (
                    <span className="text-success font-bold">✓</span>
                  )}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function BracketDesktop() {
  const venstre = RUNDER_YTRE_TIL_INDRE;
  const høyre = [...RUNDER_YTRE_TIL_INDRE].reverse();
  const bracket = useBracket();

  return (
    <div className="relative bg-gradient-to-br from-surface via-surface to-elevated/30 border border-border rounded-3xl p-4 overflow-x-auto">
      {/* Subtilt bakgrunnsglød bak finalen */}
      <div className="absolute inset-0 pointer-events-none opacity-40 [background-image:radial-gradient(circle_at_center,rgb(var(--gold)/0.07)_0,transparent_60%)]" />

      <div
        className="relative flex items-stretch w-full min-w-[860px]"
        style={{ "--rad": RAD } as CSSProperties}
      >
        {/* Venstre halvdel: ytre → indre (flyt mot høyre) */}
        <Halvdel side="venstre" runder={venstre} bracket={bracket} />

        {/* Sentrum: pokal, finale og bronse */}
        <SentrumKolonne />

        {/* Høyre halvdel: indre → ytre (flyt mot venstre) */}
        <Halvdel side="høyre" runder={høyre} bracket={bracket} />
      </div>
    </div>
  );
}

// Mobil: veksler mellom kompakt bracket-kart (à la VG-profeten) og
// detaljert liste. Kartet viser hele sluttspillet på én skjerm.
function KnockoutMobil() {
  const [visning, setVisning] = useState<"kart" | "liste">("kart");
  return (
    <div className="space-y-3">
      <div className="flex justify-center">
        <div className="inline-flex bg-surface border border-border rounded-xl p-1 gap-1">
          {(["kart", "liste"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setVisning(v)}
              className={`h-8 px-4 rounded-lg text-xs font-semibold transition active:scale-[0.97] ${
                visning === v
                  ? "bg-primary text-primaryFg shadow-glow"
                  : "text-muted hover:text-text"
              }`}
            >
              {v === "kart" ? "Kart" : "Liste"}
            </button>
          ))}
        </div>
      </div>
      {visning === "kart" ? <KartMobil /> : <RunderMobil />}
    </div>
  );
}

// VG-stil bracket-kart: begge halvdeler konvergerer mot finalen i midten.
// 9 kolonner — flagg-kort uten navn; trykk på en kamp for detaljer.
function KartMobil() {
  const bracket = useBracket();
  const fasit = useFasit();
  const [valgt, setValgt] = useState<BracketKamp | null>(null);

  const hent = (runde: string, i: number) => bracket[runde]?.[i];
  const finale = hent("Finale", 0);
  const bronse = hent("Bronsefinale", 0);

  // [runde, kolonne, antall kort, indeks-offset i sortert kampliste]
  const kolonner: [string, number, number, number][] = [
    ["32-delsfinale", 1, 8, 0],
    ["16-delsfinale", 2, 4, 0],
    ["Kvartfinale", 3, 2, 0],
    ["Kvartfinale", 7, 2, 2],
    ["16-delsfinale", 8, 4, 4],
    ["32-delsfinale", 9, 8, 8],
  ];

  const etiketter: { kol: number; tekst: string }[] = [
    { kol: 1, tekst: "32" },
    { kol: 2, tekst: "16" },
    { kol: 3, tekst: "KF" },
    { kol: 4, tekst: "SF" },
    { kol: 5, tekst: "FINALE" },
    { kol: 6, tekst: "SF" },
    { kol: 7, tekst: "KF" },
    { kol: 8, tekst: "16" },
    { kol: 9, tekst: "32" },
  ];

  return (
    <div className="relative overflow-x-auto rounded-3xl border border-border bg-gradient-to-br from-surface via-surface to-elevated/30 p-2">
      <div className="absolute inset-0 pointer-events-none opacity-50 [background-image:radial-gradient(circle_at_center,rgb(var(--gold)/0.08)_0,transparent_55%)]" />

      <div
        className="relative grid gap-x-0.5 min-w-[340px]"
        style={{
          gridTemplateColumns:
            "repeat(4, minmax(0, 1fr)) auto repeat(4, minmax(0, 1fr))",
          gridTemplateRows: "18px repeat(16, 23px)",
        }}
      >
        {etiketter.map((e) => (
          <div
            key={e.kol}
            style={{ gridColumn: e.kol, gridRow: 1 }}
            className={`text-center text-[8px] font-bold tracking-wider self-center ${
              e.kol === 5 ? "text-gold" : "text-muted/70"
            }`}
          >
            {e.tekst}
          </div>
        ))}

        {kolonner.flatMap(([runde, kol, antall, offset]) => {
          const span = 16 / antall;
          return Array.from({ length: antall }).map((_, i) => {
            const kamp = hent(runde, offset + i);
            return (
              <div
                key={`${kol}-${i}`}
                style={{
                  gridColumn: kol,
                  gridRow: `${i * span + 2} / span ${span}`,
                }}
                className="flex items-center justify-center min-w-0"
              >
                <MiniKamp
                  kamp={kamp}
                  valgt={!!kamp && valgt?.id === kamp.id}
                  onVelg={setValgt}
                />
              </div>
            );
          });
        })}

        {/* Semifinaler flankerer finalen */}
        <div
          style={{ gridColumn: 4, gridRow: "8 / span 4" }}
          className="flex items-center justify-center"
        >
          <MiniKamp
            kamp={hent("Semifinale", 0)}
            valgt={!!hent("Semifinale", 0) && valgt?.id === hent("Semifinale", 0)?.id}
            onVelg={setValgt}
          />
        </div>
        <div
          style={{ gridColumn: 6, gridRow: "8 / span 4" }}
          className="flex items-center justify-center"
        >
          <MiniKamp
            kamp={hent("Semifinale", 1)}
            valgt={!!hent("Semifinale", 1) && valgt?.id === hent("Semifinale", 1)?.id}
            onVelg={setValgt}
          />
        </div>

        {/* Sentrum: pokal, finale og bronse */}
        <div
          style={{ gridColumn: 5, gridRow: "2 / span 6" }}
          className="flex flex-col items-center justify-end pb-1.5 px-1"
        >
          <div className="relative text-center">
            <div className="absolute -inset-2 bg-gold/15 blur-xl pointer-events-none" />
            <div className="relative text-2xl drop-shadow-[0_2px_8px_rgb(var(--gold)/0.45)]">
              🏆
            </div>
            <div className="relative text-[7px] font-bold uppercase tracking-[0.12em] text-gold mt-0.5">
              {fasit.vmVinner ? (
                <span>
                  {flagg(fasit.vmVinner)} {kortLagNavn(fasit.vmVinner)}
                </span>
              ) : (
                "Verdensmester"
              )}
            </div>
          </div>
        </div>
        <div
          style={{ gridColumn: 5, gridRow: "8 / span 4" }}
          className="flex flex-col items-center justify-center gap-1 px-1"
        >
          <MiniKamp
            kamp={finale}
            gull
            valgt={!!finale && valgt?.id === finale.id}
            onVelg={setValgt}
          />
        </div>
        <div
          style={{ gridColumn: 5, gridRow: "12 / span 5" }}
          className="flex flex-col items-center justify-start gap-1 px-1 pt-1"
        >
          <span className="text-[7px] font-bold uppercase tracking-[0.12em] text-warning bg-warning/10 border border-warning/30 px-1.5 py-0.5 rounded-full">
            Bronse
          </span>
          <MiniKamp
            kamp={bronse}
            valgt={!!bronse && valgt?.id === bronse.id}
            onVelg={setValgt}
          />
        </div>
      </div>

      {/* Detaljlinje for valgt kamp */}
      <div className="relative mt-2 bg-elevated/70 border border-border rounded-xl px-3 py-2 text-center min-h-[38px] flex items-center justify-center">
        {valgt ? (
          <KampDetalj kamp={valgt} />
        ) : (
          <span className="text-[11px] text-muted">
            Trykk på en kamp for detaljer
          </span>
        )}
      </div>
    </div>
  );
}

function formatTid(ms: number) {
  const d = new Date(ms);
  return `${d.getDate()}/${d.getMonth() + 1} kl ${d.toLocaleTimeString("nb-NO", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

function slotFlagg(s: Lagslot) {
  return s.lag ? flagg(s.lag) : "🏳";
}
function slotNavn(s: Lagslot) {
  return s.lag ? kortLagNavn(s.lag) : s.label || "TBD";
}

function KampDetalj({ kamp }: { kamp: BracketKamp }) {
  const res = kamp.resultat;
  const tid = kamp.starttid
    ? formatTid(kamp.starttid)
    : "Kamptid ikke satt";
  return (
    <div className="text-[11px] leading-tight">
      <span className="font-semibold">
        {slotFlagg(kamp.a)} {slotNavn(kamp.a)}
      </span>
      <span className="font-bold text-text mx-1.5 tabular-nums">
        {res ? `${res.hjemme}–${res.borte}` : "–"}
      </span>
      <span className="font-semibold">
        {slotNavn(kamp.b)} {slotFlagg(kamp.b)}
      </span>
      <div className="text-[10px] text-muted mt-0.5">
        {kamp.runde} · {res ? "ferdigspilt" : tid}
      </div>
    </div>
  );
}

// Bittelite bracket-kort: bare flagg, à la VG-profetens kompaktvisning.
function MiniKamp({
  kamp,
  gull,
  valgt,
  onVelg,
}: {
  kamp?: BracketKamp;
  gull?: boolean;
  valgt?: boolean;
  onVelg: (k: BracketKamp) => void;
}) {
  const norge = kamp ? kamp.a.lag === NORGE || kamp.b.lag === NORGE : false;
  // Et spor regnes som "fylt" hvis minst ett ekte lag er på plass.
  const fylt = !!(kamp && (kamp.a.lag || kamp.b.lag));
  const res = kamp?.resultat;
  const vinner = res
    ? res.hjemme > res.borte
      ? "h"
      : res.borte > res.hjemme
        ? "b"
        : null
    : null;

  return (
    <button
      type="button"
      disabled={!kamp}
      onClick={() => kamp && onVelg(kamp)}
      className={`w-9 rounded-md overflow-hidden border bg-elevated transition active:scale-95 ${
        valgt
          ? "border-primary ring-2 ring-primary/40"
          : gull
            ? "border-gold/50 shadow-[0_0_12px_rgb(var(--gold)/0.25)]"
            : norge
              ? "border-norge/60 shadow-[0_0_10px_rgb(var(--norge)/0.3)]"
              : "border-border"
      } ${fylt ? "" : "opacity-60"}`}
    >
      <MiniLag slot={kamp?.a} vant={vinner === "h"} medSkille />
      <MiniLag slot={kamp?.b} vant={vinner === "b"} />
    </button>
  );
}

function MiniLag({
  slot,
  vant,
  medSkille,
}: {
  slot?: Lagslot;
  vant?: boolean;
  medSkille?: boolean;
}) {
  const innhold = slot?.lag ? (
    flagg(slot.lag)
  ) : slot?.kode ? (
    <span className="text-[8px] font-bold text-muted/80">{slot.kode}</span>
  ) : (
    "·"
  );
  return (
    <span
      className={`h-[19px] flex items-center justify-center text-[13px] leading-none ${
        medSkille ? "border-b border-border/50" : ""
      } ${vant ? "bg-primary/20" : ""} ${slot?.lag ? "" : "opacity-40"}`}
    >
      {innhold}
    </span>
  );
}

// Mobil: rundene stablet vertikalt, kamper i kompakt 2-kolonners rutenett.
function RunderMobil() {
  const fasit = useFasit();
  const bracket = useBracket();
  const finale = bracket["Finale"]?.[0];
  const bronse = bracket["Bronsefinale"]?.[0];

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
              <SlotKort key={i} kamp={bracket[r.kort]?.[i]} visTid />
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

function Halvdel({
  side,
  runder,
  bracket,
}: {
  side: "venstre" | "høyre";
  runder: Runde[];
  bracket: Record<string, BracketKamp[]>;
}) {
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
                  <SlotKort
                    kamp={bracket[r.kort]?.[erVenstre ? i : r.kamper + i]}
                  />
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
  const fasit = useFasit();
  const bracket = useBracket();
  const finale = bracket["Finale"]?.[0];
  const bronse = bracket["Bronsefinale"]?.[0];

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

function BronseKort({ kamp }: { kamp?: BracketKamp }) {
  const lagH = kamp ? slotNavn(kamp.a) : "TBD";
  const lagB = kamp ? slotNavn(kamp.b) : "TBD";
  const fH = kamp ? slotFlagg(kamp.a) : "🏳";
  const fB = kamp ? slotFlagg(kamp.b) : "🏳";
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

// Én bracket-rad: ekte lag (flagg + navn + score) hvis kjent, ellers en
// posisjons-etikett ("Vinner gruppe A" / "3.-plass …") eller TBD.
function SlotRad({
  slot,
  score,
  vant,
  medSkille,
}: {
  slot?: Lagslot;
  score?: number;
  vant?: boolean;
  medSkille?: boolean;
}) {
  const lag = slot?.lag;
  return (
    <div
      className={`flex items-center justify-between gap-2 px-2.5 py-1.5 ${
        medSkille ? "border-b border-border/40" : ""
      }`}
    >
      <div className="flex items-center gap-1.5 min-w-0 flex-1">
        {lag ? (
          <>
            <span className="text-sm flex-shrink-0">{flagg(lag)}</span>
            <span
              className={`text-[11px] truncate ${
                vant
                  ? "font-bold"
                  : score != null
                    ? "text-muted"
                    : `font-medium ${lag === NORGE ? "text-norge" : ""}`
              }`}
            >
              {kortLagNavn(lag)}
            </span>
          </>
        ) : (
          <>
            <div className="w-4 h-4 rounded-full bg-border/60 border border-border flex-shrink-0" />
            <span className="text-[11px] text-muted/80 truncate">
              {slot?.label || "TBD"}
            </span>
          </>
        )}
      </div>
      <span
        className={`text-xs font-mono tabular-nums w-4 text-right ${
          vant ? "font-bold" : "text-muted"
        }`}
      >
        {score ?? "–"}
      </span>
    </div>
  );
}

// Bracket-kort: viser de to sporene (lag eller etikett), kamptid og resultat.
// `visTid` brukes i mobil-visningen der det er plass til en tidslinje; på
// desktop ligger tiden i title-tooltip.
function SlotKort({ kamp, visTid }: { kamp?: BracketKamp; visTid?: boolean }) {
  if (!kamp) {
    return (
      <div className="w-full rounded-lg overflow-hidden bg-elevated border border-border">
        <SlotRad medSkille />
        <SlotRad />
      </div>
    );
  }

  const tidTekst = kamp.starttid ? formatTid(kamp.starttid) : null;
  const norge = kamp.a.lag === NORGE || kamp.b.lag === NORGE;
  const res = kamp.resultat;
  const vinner = res
    ? res.hjemme > res.borte
      ? "h"
      : res.borte > res.hjemme
        ? "b"
        : null
    : null;

  return (
    <div
      title={`${slotNavn(kamp.a)} – ${slotNavn(kamp.b)}${
        tidTekst ? ` · ${tidTekst}` : ""
      }`}
      className={`w-full rounded-lg overflow-hidden bg-elevated border transition-colors ${
        norge
          ? "border-norge/50 shadow-[0_0_16px_rgb(var(--norge)/0.15)]"
          : "border-border hover:border-primary/40"
      }`}
    >
      {visTid && tidTekst && !res && (
        <div className="px-2.5 pt-1.5 text-[9px] font-semibold text-muted/80 tabular-nums">
          {tidTekst}
        </div>
      )}
      <SlotRad
        slot={kamp.a}
        score={res?.hjemme}
        vant={vinner === "h"}
        medSkille
      />
      <SlotRad slot={kamp.b} score={res?.borte} vant={vinner === "b"} />
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
function FinaleKort({ kamp }: { kamp?: BracketKamp }) {
  const lagH = kamp ? slotNavn(kamp.a) : "TBD";
  const lagB = kamp ? slotNavn(kamp.b) : "TBD";
  const fH = kamp ? slotFlagg(kamp.a) : "🏳";
  const fB = kamp ? slotFlagg(kamp.b) : "🏳";
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
