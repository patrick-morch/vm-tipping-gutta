"use client";

import { useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  useAggregertLedertavle,
  useAlleSpesialTips,
  useAlleTips,
  useBrukere,
  useFasit,
  useKamper,
  type LedertavleRad,
} from "@/lib/data";
import { beregnPoeng } from "@/lib/types";
import { POENG } from "@/lib/vm-data";
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
};

function Ledertavle() {
  const { user, demoModus } = useAuth();
  const aggregert = useAggregertLedertavle();
  const brukere = useBrukere();
  const alleTips = useAlleTips();
  const alleSpesial = useAlleSpesialTips();
  const fasit = useFasit();
  const kamper = useKamper();

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
    // Brukere er sannhetskilden for medlemskap. Live-stats fra tips+kamper
    // og spesialtips+fasit gir umiddelbar oppdatering.
    const aggregertMap = new Map(
      (aggregert?.rader || []).map((r) => [r.uid, r]),
    );
    return brukere
      .map((b) => {
        const agg = aggregertMap.get(b.uid);
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
        };
      })
      .sort((a, b) => b.poeng - a.poeng);
  }, [aggregert, brukere, liveStats, liveSpesial]);

  const top3 = rader.slice(0, 3);
  const resten = rader.slice(3);
  const leder = top3[0]?.poeng || 0;

  const minRad = rader.find((r) => r.uid === user?.uid);
  const minPlass = rader.findIndex((r) => r.uid === user?.uid) + 1;

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
          Ledertavlen oppdateres nattlig kl 03. Første aggregering kommer
          neste natt.
        </div>
      )}

      {minRad && minPlass > 3 && (
        <DinPlasseringKort
          rad={minRad}
          plass={minPlass}
          total={rader.length}
        />
      )}

      {top3.length > 0 && (
        <Podium top3={top3} egenUid={user?.uid} ledersum={leder} />
      )}

      <ListeKort
        rader={resten}
        egenUid={user?.uid}
        startPlass={4}
        ledersum={leder}
      />
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
}: {
  rad: RadMedStats;
  plass: number;
  total: number;
}) {
  return (
    <div className="bg-gradient-to-br from-primary/15 via-primary/5 to-transparent border border-primary/30 rounded-2xl p-4 flex items-center gap-4">
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
    </div>
  );
}

function Podium({
  top3,
  egenUid,
  ledersum,
}: {
  top3: RadMedStats[];
  egenUid: string | undefined;
  ledersum: number;
}) {
  // Klassisk podium: #2 venstre, #1 sentralt og høyere, #3 høyre
  const har1 = top3[0];
  const har2 = top3[1];
  const har3 = top3[2];

  return (
    <div className="grid grid-cols-3 gap-2 items-end">
      {har2 ? (
        <PodiumKort
          rad={har2}
          plass={2}
          egen={har2.uid === egenUid}
          ledersum={ledersum}
        />
      ) : (
        <div />
      )}
      {har1 ? (
        <PodiumKort
          rad={har1}
          plass={1}
          egen={har1.uid === egenUid}
          ledersum={ledersum}
        />
      ) : (
        <div />
      )}
      {har3 ? (
        <PodiumKort
          rad={har3}
          plass={3}
          egen={har3.uid === egenUid}
          ledersum={ledersum}
        />
      ) : (
        <div />
      )}
    </div>
  );
}

function PodiumKort({
  rad,
  plass,
  egen,
  ledersum,
}: {
  rad: RadMedStats;
  plass: 1 | 2 | 3;
  egen: boolean;
  ledersum: number;
}) {
  const stil = {
    1: {
      tema: "bg-gradient-to-br from-gold/35 via-gold/15 to-transparent border-gold/50",
      tag: "bg-gold/25 text-gold",
      medalje: "🥇",
      glow: "shadow-[0_0_40px_rgb(var(--gold)/0.15)]",
      tagTekst: "VINNER",
      paddingTop: "pt-5",
    },
    2: {
      tema: "bg-gradient-to-br from-accent/20 via-accent/8 to-transparent border-accent/30",
      tag: "bg-accent/20 text-accent",
      medalje: "🥈",
      glow: "",
      tagTekst: "2. PLASS",
      paddingTop: "pt-3",
    },
    3: {
      tema: "bg-gradient-to-br from-warning/15 via-warning/5 to-transparent border-warning/30",
      tag: "bg-warning/15 text-warning",
      medalje: "🥉",
      glow: "",
      tagTekst: "3. PLASS",
      paddingTop: "pt-3",
    },
  }[plass];

  const prosent = ledersum > 0 ? Math.round((rad.poeng / ledersum) * 100) : 100;

  return (
    <div
      className={`relative ${stil.paddingTop} pb-3 px-2 rounded-2xl border ${stil.tema} ${stil.glow} ${
        egen ? "ring-2 ring-primary/50" : ""
      }`}
    >
      <div className="text-center space-y-1.5">
        <div className={plass === 1 ? "text-3xl" : "text-2xl"}>
          {stil.medalje}
        </div>
        <div
          className="w-10 h-10 mx-auto rounded-full bg-elevated border border-border flex items-center justify-center font-bold px-1"
          style={{
            fontSize:
              initialer(rad.navn).length <= 2
                ? "12px"
                : initialer(rad.navn).length === 3
                  ? "11px"
                  : "9px",
          }}
        >
          {initialer(rad.navn)}
        </div>
        <div
          className="font-bold text-xs px-1 leading-tight break-words"
          title={rad.navn}
        >
          {rad.navn}
          {egen && <span className="text-primary text-[10px] ml-1">(deg)</span>}
        </div>
        <div className={plass === 1 ? "text-2xl font-bold" : "text-lg font-bold"}>
          {rad.poeng}
          <span className="text-[10px] text-muted font-normal ml-0.5">p</span>
        </div>
        {plass !== 1 && (
          <div className="text-[9px] text-muted">{prosent}% av leder</div>
        )}
      </div>
    </div>
  );
}

function ListeKort({
  rader,
  egenUid,
  startPlass,
  ledersum,
}: {
  rader: RadMedStats[];
  egenUid: string | undefined;
  startPlass: number;
  ledersum: number;
}) {
  return (
    <div className="bg-surface border border-border rounded-2xl overflow-hidden">
      {rader.length === 0 && (
        <div className="px-4 py-8 text-center text-muted text-sm">
          Ingen medlemmer å vise.
        </div>
      )}
      {rader.map((rad, i) => {
        const plass = startPlass + i;
        const egen = rad.uid === egenUid;
        const prosent = ledersum > 0 ? (rad.poeng / ledersum) * 100 : 0;
        return (
          <div
            key={rad.uid}
            className={`relative grid grid-cols-[44px_1fr_auto] gap-3 px-4 py-3 items-center border-b border-border last:border-b-0 ${
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
          </div>
        );
      })}
    </div>
  );
}
