"use client";

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "@/lib/auth-context";
import {
  useAggregertLedertavle,
  useAlleSpesialTips,
  useAlleTips,
  useBrukere,
  useFasit,
  useKamper,
  useSpillerTips,
  useMittSpesialTip,
  type LedertavleRad,
} from "@/lib/data";
import { beregnPoeng, type Match, type Prediction } from "@/lib/types";
import { POENG, flagg, kampErLåst, kortLagNavn } from "@/lib/vm-data";
import Skall from "@/components/Skall";
import Beskytt from "@/components/Beskytt";
import SideHeader from "@/components/SideHeader";

export default function LedertavleSide() {
  return (
    <Beskytt>
      <Skall>
        <Ledertavle />
      </Skall>
    </Beskytt>
  );
}

function initialer(navn: string): string {
  return navn
    .trim()
    .split(/[\s\-]+/)
    .filter((d) => d.length > 0)
    .map((d) => d[0])
    .join("")
    .toUpperCase();
}

type RadMedStats = LedertavleRad & {
  utfall: number;
  feil: number;
  // Delt plassering: like poeng gir samme plass (19,16,16,13 → 1,2,2,4).
  plass: number;
};

function Ledertavle() {
  const { user, demoModus } = useAuth();
  const aggregert = useAggregertLedertavle();
  const brukere = useBrukere();
  // Live-beregning fra alle tips kjøres BARE i demo-modus (ingen backend-
  // aggregering der). I produksjon leser vi det ferdig-aggregerte dokumentet
  // (1 lesing) i stedet for hele tips-samlingen (~tusenvis av lesinger).
  const alleTips = useAlleTips(demoModus);
  const alleSpesial = useAlleSpesialTips(demoModus);
  const fasit = useFasit(demoModus);
  const kamper = useKamper(demoModus);

  const liveStats = useMemo(() => {
    const ferdige = new Map(
      kamper.filter((k) => k.resultat).map((k) => [k.id, k]),
    );
    const m = new Map<
      string,
      { kampPoeng: number; eksakte: number; utfall: number; feil: number }
    >();
    for (const t of alleTips) {
      const k = ferdige.get(t.matchId);
      if (!k || !k.resultat) continue;
      const bonus = k.bonusFaktor || 1;
      const p = beregnPoeng(t, k.resultat, bonus);
      const cur = m.get(t.uid) || {
        kampPoeng: 0,
        eksakte: 0,
        utfall: 0,
        feil: 0,
      };
      cur.kampPoeng += p;
      if (p === 3 * bonus) cur.eksakte += 1;
      else if (p === 1 * bonus) cur.utfall += 1;
      else cur.feil += 1;
      m.set(t.uid, cur);
    }
    return m;
  }, [alleTips, kamper]);

  const liveSpesial = useMemo(() => {
    const m = new Map<string, number>();
    const norm = (s: string) => s.trim().toLowerCase();
    for (const s of alleSpesial) {
      let p = 0;
      if (fasit.vmVinner && fasit.vmVinner === s.vmVinner) p += POENG.vmVinner;
      if (
        fasit.toppscorer &&
        s.toppscorer &&
        norm(s.toppscorer) === norm(fasit.toppscorer)
      )
        p += POENG.toppscorer;
      if (
        fasit.toppassist &&
        s.toppassist &&
        norm(s.toppassist) === norm(fasit.toppassist)
      )
        p += POENG.toppassist;
      if (
        fasit.ronaldoVsMessi &&
        s.ronaldoVsMessi &&
        s.ronaldoVsMessi === fasit.ronaldoVsMessi
      )
        p += POENG.ronaldoVsMessi;
      m.set(s.uid, p);
    }
    return m;
  }, [alleSpesial, fasit]);

  const rader: RadMedStats[] = useMemo(() => {
    // Brukere er sannhetskilden for medlemskap.
    const aggregertMap = new Map(
      (aggregert?.rader || []).map((r) => [r.uid, r]),
    );
    const liste = brukere
      .map((b) => {
        const agg = aggregertMap.get(b.uid);
        // Produksjon: bruk det ferdig-aggregerte dokumentet (samme regler som
        // live-beregningen, så ingen forskjell i poeng — bare billigere).
        if (!demoModus && agg) {
          return {
            uid: b.uid,
            navn: agg.navn || b.navn,
            avdeling: "",
            klubbRolle: agg.klubbRolle || b.klubbRolle,
            poeng: agg.poeng,
            kampPoeng: agg.kampPoeng,
            spesialPoeng: agg.spesialPoeng,
            eksakte: agg.eksakte,
            utfall: agg.utfall ?? 0,
            feil: agg.feil ?? 0,
            plass: 0,
          };
        }
        // Demo-modus (live-beregning) eller bruker uten aggregert rad ennå (0).
        const stats = liveStats.get(b.uid) || {
          kampPoeng: 0,
          eksakte: 0,
          utfall: 0,
          feil: 0,
        };
        const spesialPoeng = liveSpesial.get(b.uid) ?? 0;
        return {
          uid: b.uid,
          navn: agg?.navn || b.navn,
          avdeling: "",
          klubbRolle: agg?.klubbRolle || b.klubbRolle,
          poeng: stats.kampPoeng + spesialPoeng,
          kampPoeng: stats.kampPoeng,
          spesialPoeng,
          eksakte: stats.eksakte,
          utfall: stats.utfall,
          feil: stats.feil,
          plass: 0,
        };
      })
      .sort((a, b) => b.poeng - a.poeng);

    // Delt plassering (standard konkurranse-ranking): like poeng deler plass,
    // og neste forskjellige poengsum hopper fram til sin faktiske indeks.
    let forrigePoeng: number | null = null;
    let forrigePlass = 0;
    liste.forEach((r, i) => {
      if (forrigePoeng === null || r.poeng !== forrigePoeng) {
        r.plass = i + 1;
        forrigePlass = i + 1;
        forrigePoeng = r.poeng;
      } else {
        r.plass = forrigePlass;
      }
    });
    return liste;
  }, [aggregert, brukere, liveStats, liveSpesial, demoModus]);

  const top3 = rader.slice(0, 3);
  const resten = rader.slice(3);
  const leder = top3[0]?.poeng || 0;

  const minIndex = rader.findIndex((r) => r.uid === user?.uid);
  const minRad = minIndex >= 0 ? rader[minIndex] : undefined;
  const minPlass = minRad?.plass ?? 0;

  const [valgtSpiller, setValgtSpiller] = useState<{
    rad: RadMedStats;
    plass: number;
  } | null>(null);
  const velgSpiller = (rad: RadMedStats, plass: number) =>
    setValgtSpiller({ rad, plass });

  const oppdatert = aggregert?.oppdatert
    ? new Date(aggregert.oppdatert).toLocaleString("nb-NO", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <div className="space-y-5">
      <SideHeader
        tittel="Ledertavle"
        undertittel={
          <>
            {aggregert
              ? `${aggregert.kamperSpilt}/${aggregert.kamperTotalt} kamper spilt`
              : `${rader.length} medlemmer`}
            {oppdatert && <span className="ml-1">· oppdatert {oppdatert}</span>}
          </>
        }
      />

      {!aggregert && !demoModus && (
        <div className="bg-warning/10 border border-warning/30 text-warning text-xs rounded-2xl px-3 py-2.5 flex items-center gap-2">
          <span>⏳</span>
          Ledertavlen oppdateres ca. 10 min etter hver ferdigspilte kamp.
          Første tall kommer etter første ferdige kamp.
        </div>
      )}

      {minRad && minIndex > 2 && (
        <DinPlasseringKort
          rad={minRad}
          plass={minPlass}
          total={rader.length}
          onVelg={velgSpiller}
        />
      )}

      {top3.length > 0 && (
        <Podium
          top3={top3}
          egenUid={user?.uid}
          ledersum={leder}
          onVelg={velgSpiller}
        />
      )}

      <ListeKort
        rader={resten}
        egenUid={user?.uid}
        ledersum={leder}
        onVelg={velgSpiller}
      />

      {valgtSpiller && (
        <SpillerDetalj
          rad={valgtSpiller.rad}
          plass={valgtSpiller.plass}
          onLukk={() => setValgtSpiller(null)}
        />
      )}
    </div>
  );
}

function StatLinje({ rad }: { rad: RadMedStats }) {
  return (
    <div className="text-[11px] flex items-center gap-2 mt-0.5 font-semibold">
      <span className="text-success">✓ {rad.eksakte}</span>
      <span className="text-accent">≈ {rad.utfall}</span>
      <span className="text-muted">✗ {rad.feil}</span>
    </div>
  );
}

function DinPlasseringKort({
  rad,
  plass,
  total,
  onVelg,
}: {
  rad: RadMedStats;
  plass: number;
  total: number;
  onVelg: (rad: RadMedStats, plass: number) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onVelg(rad, plass)}
      className="w-full text-left bg-gradient-to-br from-primary/15 via-primary/5 to-transparent border border-primary/30 rounded-2xl p-4 flex items-center gap-4 hover:border-primary/60 transition"
    >
      <div className="w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center text-primary font-bold text-lg">
        #{plass}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] text-primary uppercase tracking-wider font-bold">
          Din plassering · av {total}
        </div>
        <div className="font-bold leading-tight">{rad.navn}</div>
        <StatLinje rad={rad} />
      </div>
      <div className="text-right">
        <div className="text-2xl font-bold leading-none">{rad.poeng}</div>
        <div className="text-[9px] text-muted uppercase tracking-wider mt-1">
          poeng
        </div>
      </div>
    </button>
  );
}

function Podium({
  top3,
  egenUid,
  ledersum,
  onVelg,
}: {
  top3: RadMedStats[];
  egenUid: string | undefined;
  ledersum: number;
  onVelg: (rad: RadMedStats, plass: number) => void;
}) {
  // Klassisk podium: #2 venstre, #1 sentralt og høyere, #3 høyre
  const har1 = top3[0];
  const har2 = top3[1];
  const har3 = top3[2];

  return (
    <div className="relative">
      {/* Gulvglød under pallen */}
      <div className="absolute inset-x-8 bottom-0 h-20 bg-gold/10 blur-3xl pointer-events-none" />
      <div className="relative grid grid-cols-3 gap-2 items-end border-b-2 border-border/70">
        {har2 ? (
          <PodiumKort
            rad={har2}
            slot={2}
            egen={har2.uid === egenUid}
            ledersum={ledersum}
            onVelg={onVelg}
          />
        ) : (
          <div />
        )}
        {har1 ? (
          <PodiumKort
            rad={har1}
            slot={1}
            egen={har1.uid === egenUid}
            ledersum={ledersum}
            onVelg={onVelg}
          />
        ) : (
          <div />
        )}
        {har3 ? (
          <PodiumKort
            rad={har3}
            slot={3}
            egen={har3.uid === egenUid}
            ledersum={ledersum}
            onVelg={onVelg}
          />
        ) : (
          <div />
        )}
      </div>
    </div>
  );
}

function PodiumKort({
  rad,
  slot,
  egen,
  ledersum,
  onVelg,
}: {
  rad: RadMedStats;
  // Fysisk pall-plass styrer medalje/høyde; tallet som vises er rad.plass
  // (delt plassering ved poenglikhet).
  slot: 1 | 2 | 3;
  egen: boolean;
  ledersum: number;
  onVelg: (rad: RadMedStats, plass: number) => void;
}) {
  const stil = {
    1: {
      topp: "👑",
      toppKlasse: "text-4xl drop-shadow-[0_2px_12px_rgb(var(--gold)/0.6)]",
      avatar:
        "w-16 h-16 border-2 border-gold/70 shadow-[0_0_28px_rgb(var(--gold)/0.45)]",
      pall: "h-24 md:h-28 border-gold/60 bg-gradient-to-b from-gold/45 via-gold/20 to-gold/5 shadow-[0_-8px_40px_rgb(var(--gold)/0.25)]",
      tall: "text-gold text-3xl",
      poengKlasse: "text-3xl text-gold",
      tag: "MESTERTIPPEREN",
      tagKlasse: "bg-gold/20 text-gold border border-gold/40",
    },
    2: {
      topp: "🥈",
      toppKlasse: "text-2xl",
      avatar: "w-11 h-11 border border-accent/50",
      pall: "h-14 md:h-16 border-accent/40 bg-gradient-to-b from-accent/25 via-accent/10 to-transparent",
      tall: "text-accent text-2xl",
      poengKlasse: "text-lg",
      tag: null,
      tagKlasse: "",
    },
    3: {
      topp: "🥉",
      toppKlasse: "text-2xl",
      avatar: "w-11 h-11 border border-warning/50",
      pall: "h-9 md:h-11 border-warning/40 bg-gradient-to-b from-warning/25 via-warning/10 to-transparent",
      tall: "text-warning text-2xl",
      poengKlasse: "text-lg",
      tag: null,
      tagKlasse: "",
    },
  }[slot];

  const prosent = ledersum > 0 ? Math.round((rad.poeng / ledersum) * 100) : 100;
  const er1 = slot === 1;

  return (
    <button
      type="button"
      onClick={() => onVelg(rad, rad.plass)}
      className="flex flex-col items-center justify-end min-w-0 hover:opacity-90 transition"
    >
      {/* Personen på pallen */}
      <div className="flex flex-col items-center gap-1.5 pb-2.5 px-1 min-w-0 w-full">
        <div className={`leading-none ${stil.toppKlasse}`}>{stil.topp}</div>
        <div
          className={`rounded-full bg-elevated flex items-center justify-center font-bold ${stil.avatar} ${
            egen ? "ring-2 ring-primary/60 ring-offset-2 ring-offset-bg" : ""
          }`}
          style={{
            fontSize:
              initialer(rad.navn).length <= 2
                ? er1
                  ? "18px"
                  : "13px"
                : initialer(rad.navn).length === 3
                  ? er1
                    ? "14px"
                    : "11px"
                  : "9px",
          }}
        >
          {initialer(rad.navn)}
        </div>
        {stil.tag && (
          <span
            className={`text-[8px] font-bold tracking-[0.14em] px-2 py-0.5 rounded-full ${stil.tagKlasse}`}
          >
            {stil.tag}
          </span>
        )}
        <div
          className="font-bold text-xs text-center leading-tight break-words w-full"
          title={rad.navn}
        >
          {rad.navn}
          {egen && <span className="text-primary text-[10px] ml-1">(deg)</span>}
        </div>
        <div
          className={`font-extrabold leading-none tabular-nums ${stil.poengKlasse}`}
        >
          {rad.poeng}
          <span className="text-[10px] text-muted font-normal ml-0.5">p</span>
        </div>
        {!er1 && (
          <div className="text-[9px] text-muted">{prosent}% av leder</div>
        )}
      </div>

      {/* Selve pallen */}
      <div
        className={`w-full rounded-t-2xl border border-b-0 flex items-start justify-center pt-1.5 ${stil.pall}`}
      >
        <span className={`font-extrabold opacity-90 ${stil.tall}`}>
          {rad.plass}
        </span>
      </div>
    </button>
  );
}

function ListeKort({
  rader,
  egenUid,
  ledersum,
  onVelg,
}: {
  rader: RadMedStats[];
  egenUid: string | undefined;
  ledersum: number;
  onVelg: (rad: RadMedStats, plass: number) => void;
}) {
  return (
    <div className="bg-surface border border-border rounded-2xl overflow-hidden">
      {rader.length === 0 && (
        <div className="px-4 py-8 text-center text-muted text-sm">
          Ingen medlemmer å vise.
        </div>
      )}
      {rader.map((rad) => {
        const plass = rad.plass;
        const egen = rad.uid === egenUid;
        const prosent = ledersum > 0 ? (rad.poeng / ledersum) * 100 : 0;
        return (
          <button
            type="button"
            key={rad.uid}
            onClick={() => onVelg(rad, plass)}
            className={`relative w-full text-left grid grid-cols-[44px_1fr_auto] gap-3 px-4 py-3 items-center border-b border-border last:border-b-0 hover:bg-elevated transition ${
              egen ? "bg-primary/10" : ""
            }`}
          >
            {egen && (
              <div className="absolute inset-y-0 left-0 w-1 bg-primary" />
            )}
            <div className="text-center">
              <div className="text-sm font-bold text-muted">{plass}</div>
            </div>
            <div className="min-w-0">
              <div className="font-semibold flex items-center gap-2 flex-wrap leading-tight">
                <span>{rad.navn}</span>
                {egen && (
                  <span className="text-[10px] text-primary font-bold">
                    DEG
                  </span>
                )}
              </div>
              <StatLinje rad={rad} />
              {ledersum > 0 && (
                <div className="mt-1 h-1 bg-border rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary/50 rounded-full transition-all"
                    style={{ width: `${prosent}%` }}
                  />
                </div>
              )}
            </div>
            <div className="text-right">
              <div className="font-bold text-lg leading-none">{rad.poeng}</div>
              <div className="text-[9px] text-muted uppercase tracking-wider mt-0.5">
                poeng
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function StatPille({
  label,
  verdi,
  farge = "text-text",
}: {
  label: string;
  verdi: string | number;
  farge?: string;
}) {
  return (
    <div className="flex-1 rounded-xl bg-bg/40 border border-border/60 px-2 py-1.5 text-center">
      <div className={`text-base font-extrabold tabular-nums ${farge}`}>
        {verdi}
      </div>
      <div className="text-[9px] uppercase tracking-wider text-muted font-semibold">
        {label}
      </div>
    </div>
  );
}

function SpesialKort({
  ikon,
  label,
  verdi,
}: {
  ikon: string;
  label: string;
  verdi: string;
}) {
  return (
    <div className="rounded-2xl bg-elevated/50 border border-border/60 p-3">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold text-muted mb-1">
        <span className="text-sm">{ikon}</span>
        {label}
      </div>
      <div className="font-semibold text-sm truncate">
        {verdi || <span className="text-muted/60 font-normal">Ikke tippet</span>}
      </div>
    </div>
  );
}

function SpillerDetalj({
  rad,
  plass,
  onLukk,
}: {
  rad: RadMedStats;
  plass: number;
  onLukk: () => void;
}) {
  const tips = useSpillerTips(rad.uid);
  const spesial = useMittSpesialTip(rad.uid);
  const kamper = useKamper();
  const nå = Date.now();

  const kampMap = useMemo(
    () => new Map(kamper.map((k) => [k.id, k])),
    [kamper],
  );
  const synlige = useMemo(
    () =>
      tips
        .map((t) => ({ t, kamp: kampMap.get(t.matchId) }))
        .filter(
          (x): x is { t: Prediction; kamp: Match } =>
            !!x.kamp && kampErLåst(x.kamp, nå),
        )
        .sort((a, b) => b.kamp.starttid - a.kamp.starttid),
    [tips, kampMap, nå],
  );

  const rvm: Record<string, string> = {
    ronaldo: "🇵🇹 Ronaldo",
    likt: "🤝 Likt",
    messi: "🇦🇷 Messi",
  };

  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-50 bg-bg overflow-y-auto overscroll-contain">
      <div className="mx-auto max-w-lg px-4 pb-12">
        <div className="sticky top-0 -mx-4 px-4 py-3 bg-bg/85 backdrop-blur border-b border-border/60 flex items-center gap-3 z-10">
          <button
            type="button"
            onClick={onLukk}
            className="w-9 h-9 rounded-xl bg-elevated border border-border flex items-center justify-center hover:border-primary transition flex-shrink-0"
            aria-label="Tilbake"
          >
            ←
          </button>
          <span className="font-semibold truncate">Spillerprofil</span>
        </div>

        <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-surface via-surface to-elevated/40 p-5 mt-4">
          <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
          <div className="relative flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-elevated border border-border flex items-center justify-center text-xl font-extrabold flex-shrink-0">
              {initialer(rad.navn)}
            </div>
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-[0.18em] font-bold text-primary/80">
                {plass}. plass
              </div>
              <h1 className="text-2xl font-extrabold leading-tight truncate">
                {rad.navn}
              </h1>
              <div className="text-sm text-muted">
                <span className="font-bold text-text">{rad.poeng}</span> poeng
              </div>
            </div>
          </div>
          <div className="relative flex gap-2 mt-4">
            <StatPille label="Kamp" verdi={rad.kampPoeng} />
            <StatPille label="Spesial" verdi={rad.spesialPoeng} />
            <StatPille label="Eksakt" verdi={rad.eksakte} farge="text-success" />
            <StatPille
              label="Utfall"
              verdi={rad.utfall ?? 0}
              farge="text-accent"
            />
          </div>
        </div>

        <div className="mt-5">
          <div className="text-[10px] uppercase tracking-[0.16em] font-bold text-muted mb-2 px-1">
            Spesialtips
          </div>
          {spesial ? (
            <div className="grid grid-cols-2 gap-2">
              <SpesialKort
                ikon="🏆"
                label="VM-vinner"
                verdi={
                  spesial.vmVinner
                    ? `${flagg(spesial.vmVinner)} ${spesial.vmVinner}`
                    : ""
                }
              />
              <SpesialKort
                ikon="⚽"
                label="Toppscorer"
                verdi={spesial.toppscorer}
              />
              <SpesialKort
                ikon="🎯"
                label="Toppassist"
                verdi={spesial.toppassist}
              />
              <SpesialKort
                ikon="🐐"
                label="Ronaldo/Messi"
                verdi={rvm[spesial.ronaldoVsMessi] || ""}
              />
            </div>
          ) : (
            <div className="text-sm text-muted bg-elevated/40 rounded-2xl p-4">
              Ingen spesialtips.
            </div>
          )}
        </div>

        <div className="mt-5">
          <div className="text-[10px] uppercase tracking-[0.16em] font-bold text-muted mb-2 px-1">
            Kamptips · {synlige.length}
          </div>
          {synlige.length === 0 ? (
            <div className="text-sm text-muted bg-elevated/40 rounded-2xl p-4">
              Ingen tips på spilte kamper ennå.
            </div>
          ) : (
            <div className="space-y-1.5">
              {synlige.map(({ t, kamp }) => {
                const harRes = Boolean(kamp.resultat && kamp.ferdig !== false);
                const bonus = kamp.bonusFaktor || 1;
                const p =
                  harRes && kamp.resultat
                    ? beregnPoeng(t, kamp.resultat, bonus)
                    : null;
                const farge =
                  p == null
                    ? "text-muted"
                    : p >= 3 * bonus
                      ? "text-success"
                      : p >= 1 * bonus
                        ? "text-accent"
                        : "text-muted";
                return (
                  <div
                    key={t.matchId}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl bg-elevated/50 border border-border/50 text-[12px]"
                  >
                    <span className="flex-1 min-w-0 truncate">
                      {kortLagNavn(kamp.hjemmelag)} –{" "}
                      {kortLagNavn(kamp.bortelag)}
                    </span>
                    <span className="tabular-nums font-bold w-12 text-center flex-shrink-0">
                      {t.hjemme}–{t.borte}
                    </span>
                    {harRes && kamp.resultat ? (
                      <span className="tabular-nums text-[10px] text-muted w-10 text-center flex-shrink-0">
                        {kamp.resultat.hjemme}–{kamp.resultat.borte}
                      </span>
                    ) : (
                      <span className="w-10 flex-shrink-0" />
                    )}
                    <span
                      className={`font-bold w-8 text-right flex-shrink-0 ${farge}`}
                    >
                      {p != null ? `+${p}p` : ""}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
