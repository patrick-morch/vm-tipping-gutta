"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useAggregertLedertavle } from "@/lib/data";
import Skall from "@/components/Skall";
import Beskytt from "@/components/Beskytt";
import SideHeader from "@/components/SideHeader";

export default function UtviklingSide() {
  return (
    <Beskytt>
      <Skall>
        <Utvikling />
      </Skall>
    </Beskytt>
  );
}

type Modus = "poeng" | "plass";

// Fargepalett for de fremhevede spillerne (du selv tegnes alltid i primærfarge).
const PALETT = ["#60a5fa", "#f59e0b", "#a78bfa", "#ec4899", "#14b8a6", "#f43f5e"];

// Stabil farge per spiller ut fra rekkefølgen blant de fremhevede. Du = primær,
// de neste går gjennom paletten, og utover det genereres distinkte HSL-farger
// (så «velg alle» fortsatt gir hver spiller sin egen farge).
function fargeFraIndex(i: number) {
  if (i < PALETT.length) return PALETT[i];
  const hue = (i * 47) % 360;
  return `hsl(${hue} 70% 62%)`;
}

// Måler containerbredden så grafen kan tegnes i ekte piksler (skarp tekst på
// alle skjermer, i stedet for en viewBox som forvrenger fontstørrelsen).
function useBredde() {
  const ref = useRef<HTMLDivElement>(null);
  const [bredde, setBredde] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) setBredde(e.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { ref, bredde };
}

function Utvikling() {
  const { user } = useAuth();
  const aggregert = useAggregertLedertavle();
  const [modus, setModus] = useState<Modus>("poeng");
  const [valgte, setValgte] = useState<string[]>([]);
  const { ref, bredde } = useBredde();

  const meUid = user?.uid;

  // All grafdata kommer ferdig-aggregert fra ÉN doc (aggregert/ledertavle):
  // kompakt historikk + navnene fra radene. Ingen lesing av alle tips.
  const { sjekkpunkter, poengSerie, plassSerie, sluttSortert, navnFor } =
    useMemo(() => {
      const punkter = aggregert?.historikk?.punkter || [];
      const hpoeng = aggregert?.historikk?.poeng || {};
      const rader = aggregert?.rader || [];
      const spillere = rader.map((r) => ({ uid: r.uid, navn: r.navn }));
      const navnFor = new Map(spillere.map((s) => [s.uid, s.navn]));

      const poengSerie = new Map<string, number[]>();
      for (const s of spillere) {
        const base = hpoeng[s.uid];
        const arr =
          base && base.length === punkter.length
            ? base
            : new Array(punkter.length).fill(0);
        poengSerie.set(s.uid, [0, ...arr]);
      }

      // Plassering per sjekkpunkt (delt plass ved likhet) — billig å regne lokalt.
      const antallPkt = punkter.length + 1;
      const plassSerie = new Map<string, number[]>(
        spillere.map((s) => [s.uid, []]),
      );
      for (let j = 0; j < antallPkt; j++) {
        const rad = spillere
          .map((s) => ({ uid: s.uid, poeng: poengSerie.get(s.uid)![j] }))
          .sort((a, b) => b.poeng - a.poeng);
        let forrige: number | null = null;
        let forrigeRank = 0;
        rad.forEach((r, i) => {
          let rank: number;
          if (forrige === null || r.poeng !== forrige) {
            rank = i + 1;
            forrigeRank = i + 1;
            forrige = r.poeng;
          } else {
            rank = forrigeRank;
          }
          plassSerie.get(r.uid)!.push(rank);
        });
      }

      const sisteIdx = punkter.length;
      const sluttSortert = [...spillere].sort(
        (a, b) =>
          poengSerie.get(b.uid)![sisteIdx] - poengSerie.get(a.uid)![sisteIdx],
      );

      return {
        sjekkpunkter: punkter,
        poengSerie,
        plassSerie,
        sluttSortert,
        navnFor,
      };
    }, [aggregert]);

  // Standardvalg når ingenting er valgt: du + topp 5.
  const standard = useMemo(() => {
    const liste: string[] = [];
    if (meUid && navnFor.has(meUid)) liste.push(meUid);
    for (const s of sluttSortert) {
      if (liste.length >= 6) break;
      if (!liste.includes(s.uid)) liste.push(s.uid);
    }
    return liste;
  }, [meUid, sluttSortert, navnFor]);

  // Aktive (fremhevede) spillere, ordnet: du først, deretter etter plassering.
  // Gir stabil fargetildeling uansett hvem som er valgt.
  const aktive = useMemo(() => {
    const valgtSett = new Set(valgte.length ? valgte : standard);
    const ordnet: string[] = [];
    if (meUid && valgtSett.has(meUid)) ordnet.push(meUid);
    for (const s of sluttSortert)
      if (valgtSett.has(s.uid) && s.uid !== meUid) ordnet.push(s.uid);
    return ordnet;
  }, [valgte, standard, sluttSortert, meUid]);

  const fargeMap = useMemo(() => {
    const m = new Map<string, string>();
    let i = 0;
    for (const uid of aktive) {
      if (uid === meUid) m.set(uid, "rgb(var(--primary))");
      else m.set(uid, fargeFraIndex(i++));
    }
    return m;
  }, [aktive, meUid]);

  const toggle = (uid: string) =>
    setValgte((v) =>
      v.includes(uid) ? v.filter((u) => u !== uid) : [...v, uid],
    );

  const harData = sjekkpunkter.length > 0;
  const fornavn = (uid: string) => (navnFor.get(uid) || "?").split(" ")[0];

  return (
    <div className="space-y-5">
      <SideHeader
        tittel="Utvikling"
        undertittel="Kamp-poeng gjennom turneringen. Spesialpoeng kommer i tillegg når VM er ferdig."
      />

      <div className="flex items-center gap-2">
        <ModusKnapp aktiv={modus === "poeng"} onClick={() => setModus("poeng")}>
          Poeng
        </ModusKnapp>
        <ModusKnapp aktiv={modus === "plass"} onClick={() => setModus("plass")}>
          Plassering
        </ModusKnapp>
      </div>

      <div className="bg-surface border border-border rounded-2xl p-3 sm:p-4">
        <div ref={ref} className="w-full">
          {!harData ? (
            <div className="py-16 text-center text-muted text-sm">
              Grafen fylles når de første kampene er ferdigspilt.
            </div>
          ) : bredde > 0 ? (
            <Graf
              bredde={bredde}
              modus={modus}
              sjekkpunkter={sjekkpunkter}
              poengSerie={poengSerie}
              plassSerie={plassSerie}
              spillerUids={sluttSortert.map((s) => s.uid)}
              aktive={aktive}
              fargeMap={fargeMap}
              meUid={meUid}
              fornavn={fornavn}
            />
          ) : (
            <div className="h-[340px]" />
          )}
        </div>
      </div>

      {harData && (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
              Velg spillere ({valgte.length || `topp 5${meUid ? " + deg" : ""}`})
            </span>
            <div className="flex items-center gap-2">
              <MiniKnapp onClick={() => setValgte(sluttSortert.map((s) => s.uid))}>
                Velg alle
              </MiniKnapp>
              <MiniKnapp onClick={() => setValgte([])}>Nullstill</MiniKnapp>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5 max-h-44 overflow-y-auto p-0.5">
            {sluttSortert.map((s, i) => {
              const valgtAktiv = valgte.includes(s.uid);
              const visesNå = aktive.includes(s.uid);
              const farge = fargeMap.get(s.uid);
              return (
                <button
                  key={s.uid}
                  onClick={() => toggle(s.uid)}
                  className={`flex items-center gap-1.5 pl-1.5 pr-2.5 py-1 rounded-full border text-xs font-semibold transition ${
                    valgtAktiv
                      ? "border-primary bg-primary/10"
                      : "border-border bg-surface hover:border-primary/50"
                  }`}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{
                      background: visesNå ? farge : "rgb(var(--muted) / 0.35)",
                    }}
                  />
                  <span className="text-muted/70 tabular-nums">{i + 1}.</span>
                  {s.uid === meUid ? "Deg" : fornavn(s.uid)}
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-muted px-1">
            {valgte.length
              ? "Viser de valgte spillerne. «Nullstill» går tilbake til topp 5."
              : "Tynne grå linjer er resten av gjengen. Trykk en spiller for å følge akkurat den."}
          </p>
        </div>
      )}
    </div>
  );
}

function ModusKnapp({
  aktiv,
  onClick,
  children,
}: {
  aktiv: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-1.5 rounded-full text-sm font-semibold border transition ${
        aktiv
          ? "bg-primary text-primaryFg border-primary"
          : "bg-surface border-border text-muted hover:border-primary/50"
      }`}
    >
      {children}
    </button>
  );
}

function MiniKnapp({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="px-2.5 py-1 rounded-full border border-border bg-surface text-[11px] font-semibold text-muted hover:border-primary/50 transition"
    >
      {children}
    </button>
  );
}

function Graf({
  bredde,
  modus,
  sjekkpunkter,
  poengSerie,
  plassSerie,
  spillerUids,
  aktive,
  fargeMap,
  meUid,
  fornavn,
}: {
  bredde: number;
  modus: Modus;
  sjekkpunkter: { key: string; label: string }[];
  poengSerie: Map<string, number[]>;
  plassSerie: Map<string, number[]>;
  spillerUids: string[];
  aktive: string[];
  fargeMap: Map<string, string>;
  meUid?: string;
  fornavn: (uid: string) => string;
}) {
  const [hover, setHover] = useState<{ uid: string; i: number } | null>(null);

  const mobil = bredde < 640;
  const H = mobil ? 360 : 460;
  const padT = 16;
  const padB = 30;
  const padL = 30;
  const padR = mobil ? 64 : 88; // plass til navn-etiketter til høyre

  // Serien som faktisk plottes (y-akse), og den vi alltid bruker i tooltip.
  const serie = modus === "poeng" ? poengSerie : plassSerie;

  const nPkt = sjekkpunkter.length + 1;
  const xFor = (i: number) =>
    nPkt <= 1 ? padL : padL + (i / (nPkt - 1)) * (bredde - padL - padR);

  const alleVerdier = spillerUids.flatMap((uid) => serie.get(uid) || []);
  const maxPoeng = Math.max(1, ...alleVerdier);
  const antallSpillere = spillerUids.length || 1;

  const yFor = (val: number) => {
    const h = H - padT - padB;
    if (modus === "poeng") return padT + (1 - val / maxPoeng) * h;
    // Plassering: 1 øverst, N nederst.
    return padT + ((val - 1) / Math.max(1, antallSpillere - 1)) * h;
  };

  const punktString = (uid: string) =>
    (serie.get(uid) || []).map((v, i) => `${xFor(i)},${yFor(v)}`).join(" ");

  // Y-akse-merker. Poeng: 4 jevne steg. Plassering: hver 5. plass + alltid 1 og N.
  const yMerker: { y: number; tekst: string }[] = [];
  if (modus === "poeng") {
    const antSteg = 4;
    for (let i = 0; i <= antSteg; i++) {
      const val = Math.round((maxPoeng * i) / antSteg);
      yMerker.push({ y: yFor(val), tekst: String(val) });
    }
  } else {
    const ranks = new Set<number>([1, antallSpillere]);
    for (let r = 5; r < antallSpillere; r += 5) ranks.add(r);
    for (const r of Array.from(ranks).sort((a, b) => a - b))
      yMerker.push({ y: yFor(r), tekst: `${r}.` });
  }

  const xSteg = Math.max(1, Math.ceil(sjekkpunkter.length / (mobil ? 5 : 9)));
  const aktivSett = new Set(aktive);
  const bakgrunn = spillerUids.filter((uid) => !aktivSett.has(uid));

  // Navn-etiketter til høyre: dytt fra hverandre så de aldri overlapper (f.eks.
  // når flere ligger likt). yRaw = linjas faktiske endepunkt, y = justert.
  // Strammere avstand når mange er valgt, så alle får plass.
  const gap = aktive.length > 16 ? 9 : aktive.length > 10 ? 10.5 : 12;
  const minY = padT + 4;
  const maxY = H - padB - 2;
  const etiketter = aktive
    .map((uid) => {
      const verdier = serie.get(uid) || [];
      const yRaw = yFor(verdier[verdier.length - 1] ?? 0);
      return { uid, farge: fargeMap.get(uid) || "rgb(var(--text))", yRaw, y: yRaw };
    })
    .sort((a, b) => a.yRaw - b.yRaw);
  // Forover: hold minst `gap` mellom hver.
  for (let i = 1; i < etiketter.length; i++) {
    if (etiketter[i].y < etiketter[i - 1].y + gap)
      etiketter[i].y = etiketter[i - 1].y + gap;
  }
  // Hvis bunnen flyter over, skyv hele blokka opp og klem mot toppen.
  const sisteEtikett = etiketter[etiketter.length - 1];
  if (sisteEtikett && sisteEtikett.y > maxY) {
    const overflyt = sisteEtikett.y - maxY;
    for (const e of etiketter) e.y = Math.max(minY, e.y - overflyt);
    for (let i = 1; i < etiketter.length; i++) {
      if (etiketter[i].y < etiketter[i - 1].y + gap)
        etiketter[i].y = etiketter[i - 1].y + gap;
    }
  }

  // Linjene tegnes segment-for-segment. Der flere fremhevede ligger på samme
  // segment (like verdier i begge ender) legges fargene SIDE OM SIDE ved å
  // forskyve hver litt vinkelrett på linja — så ser man hver farge tydelig.
  const BÅND = 11; // maks bredde på fargebåndet ved likhet
  const segmentLinjer: {
    nøkkel: string;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    farge: string;
    bredde: number;
  }[] = [];
  for (let i = 0; i < nPkt - 1; i++) {
    const grupper = new Map<string, string[]>();
    for (const uid of aktive) {
      const v = serie.get(uid) || [];
      const key = `${v[i]}_${v[i + 1]}`;
      const arr = grupper.get(key) || [];
      arr.push(uid);
      grupper.set(key, arr);
    }
    for (const medlemmer of grupper.values()) {
      const k = medlemmer.length;
      const avstand = k > 1 ? Math.min(3, BÅND / (k - 1)) : 0;
      const tykk = k > 1 ? Math.min(3, Math.max(1.8, avstand)) : 2.8;
      medlemmer.forEach((uid, idx) => {
        const v = serie.get(uid) || [];
        const x1 = xFor(i);
        const y1 = yFor(v[i]);
        const x2 = xFor(i + 1);
        const y2 = yFor(v[i + 1]);
        const dx = x2 - x1;
        const dy = y2 - y1;
        const len = Math.hypot(dx, dy) || 1;
        const px = -dy / len; // vinkelrett enhetsvektor
        const py = dx / len;
        const off = (idx - (k - 1) / 2) * avstand;
        segmentLinjer.push({
          nøkkel: `${uid}-${i}`,
          x1: x1 + px * off,
          y1: y1 + py * off,
          x2: x2 + px * off,
          y2: y2 + py * off,
          farge: fargeMap.get(uid) || "rgb(var(--text))",
          bredde: uid === meUid ? tykk + 0.6 : tykk,
        });
      });
    }
  }

  // Én ren prikk per (kamp-dag, verdi). Deler flere samme punkt, tegnes det
  // bare ÉN prikk der (farge fra den øverst rangerte) — ingen doble punkter.
  const prikkR = aktive.length > 12 ? 2.6 : 3.4;
  const punktPrikker: { nøkkel: string; cx: number; cy: number; farge: string }[] =
    [];
  const settPunkt = new Set<string>();
  for (let i = 0; i < nPkt; i++) {
    for (const uid of aktive) {
      const v = serie.get(uid) || [];
      const cy = yFor(v[i]);
      const key = `${i}_${Math.round(cy)}`;
      if (settPunkt.has(key)) continue;
      settPunkt.add(key);
      punktPrikker.push({
        nøkkel: `${uid}-${i}`,
        cx: xFor(i),
        cy,
        farge: fargeMap.get(uid) || "rgb(var(--text))",
      });
    }
  }

  // Tooltip-data: alle fremhevede som deler verdi i punktet musa/fingeren er på.
  const tt = (() => {
    if (!hover) return null;
    const v = (serie.get(hover.uid) || [])[hover.i];
    if (v === undefined) return null;
    const like = aktive.filter((u) => (serie.get(u) || [])[hover.i] === v);
    const poeng = poengSerie.get(hover.uid)?.[hover.i] ?? 0;
    const plass = plassSerie.get(hover.uid)?.[hover.i] ?? 0;
    const x = xFor(hover.i);
    const y = yFor(v);
    const dato = hover.i === 0 ? "Start" : sjekkpunkter[hover.i - 1]?.label || "";
    const alle = like.map((u) => ({
      navn: u === meUid ? "Deg" : fornavn(u),
      farge: fargeMap.get(u) || "rgb(var(--text))",
    }));
    const maks = 6;
    const vist = alle.slice(0, maks);
    const flere = alle.length > maks ? alle.length - maks : 0;
    const bw = 150;
    const bh = 34 + vist.length * 13 + (flere ? 14 : 4);
    const bx = Math.min(Math.max(x - bw / 2, 4), bredde - bw - 4);
    const by = y - bh - 12 < padT ? y + 12 : y - bh - 12;
    return { x, y, poeng, plass, dato, vist, flere, bw, bh, bx, by };
  })();

  return (
    <svg
      width={bredde}
      height={H}
      viewBox={`0 0 ${bredde} ${H}`}
      className="block touch-none"
      role="img"
      aria-label="Utviklingsgraf"
    >
      {/* Bakgrunn — trykk for å lukke tooltip */}
      <rect
        x={0}
        y={0}
        width={bredde}
        height={H}
        fill="transparent"
        onClick={() => setHover(null)}
      />

      {/* Horisontale gridlinjer + y-etiketter */}
      {yMerker.map((m, i) => (
        <g key={`y${i}`} style={{ pointerEvents: "none" }}>
          <line
            x1={padL}
            y1={m.y}
            x2={bredde - padR}
            y2={m.y}
            stroke="rgb(var(--border))"
            strokeWidth={1}
            strokeDasharray="3 4"
          />
          <text
            x={padL - 6}
            y={m.y + 3}
            textAnchor="end"
            className="fill-muted"
            style={{ fontSize: 10 }}
          >
            {m.tekst}
          </text>
        </g>
      ))}

      {/* Vertikale hjelpelinjer + x-etiketter per kamp-dag */}
      {sjekkpunkter.map((cp, i) => {
        const vis = i % xSteg === 0 || i === sjekkpunkter.length - 1;
        const x = xFor(i + 1);
        return (
          <g key={cp.key} style={{ pointerEvents: "none" }}>
            <line
              x1={x}
              y1={padT}
              x2={x}
              y2={H - padB}
              stroke="rgb(var(--border))"
              strokeWidth={1}
              strokeOpacity={0.25}
            />
            {vis && (
              <text
                x={x}
                y={H - 10}
                textAnchor="middle"
                className="fill-muted"
                style={{ fontSize: 10 }}
              >
                {cp.label}
              </text>
            )}
          </g>
        );
      })}

      {/* Bakgrunnslinjer (ikke-valgte spillere) */}
      {bakgrunn.map((uid) => (
        <polyline
          key={uid}
          points={punktString(uid)}
          fill="none"
          stroke="rgb(var(--muted))"
          strokeWidth={1}
          strokeOpacity={aktive.length > spillerUids.length / 2 ? 0.1 : 0.16}
          strokeLinejoin="round"
          style={{ pointerEvents: "none" }}
        />
      ))}

      {/* Fremhevede linjer, segment-for-segment med fargene side om side ved likhet */}
      <g style={{ pointerEvents: "none" }}>
        {segmentLinjer.map((s, n) => (
          <line
            key={`${s.nøkkel}-${n}`}
            x1={s.x1}
            y1={s.y1}
            x2={s.x2}
            y2={s.y2}
            stroke={s.farge}
            strokeWidth={s.bredde}
            strokeLinecap="round"
          />
        ))}
      </g>

      {/* Tydelige prikker per kamp-dag, med ring så de står frem */}
      <g style={{ pointerEvents: "none" }}>
        {punktPrikker.map((p, n) => (
          <circle
            key={`${p.nøkkel}-${n}`}
            cx={p.cx}
            cy={p.cy}
            r={prikkR}
            fill={p.farge}
            stroke="rgb(var(--surface))"
            strokeWidth={1.3}
          />
        ))}
      </g>

      {/* Navn-etiketter til høyre: ryddig vertikal liste med fargeprikk foran
          hvert navn (dyttet fra hverandre ved likhet, ingen overlapp). Skjules
          når veldig mange er valgt — da brukes velgeren + tooltip i stedet. */}
      {etiketter.map((e) => (
        <g key={`lbl-${e.uid}`} style={{ pointerEvents: "none" }}>
          <circle cx={xFor(nPkt - 1) + 5} cy={e.y - 3} r={2.6} fill={e.farge} />
          <text
            x={xFor(nPkt - 1) + 11}
            y={e.y}
            className="font-semibold"
            style={{ fontSize: aktive.length > 16 ? 8.5 : 10, fill: e.farge }}
          >
            {e.uid === meUid ? "Deg" : fornavn(e.uid)}
          </text>
        </g>
      ))}

      {/* Treffområder for hover/trykk — usynlige, men fanger pekeren */}
      {aktive.map((uid) =>
        (serie.get(uid) || []).map((v, i) => (
          <circle
            key={`${uid}-${i}`}
            cx={xFor(i)}
            cy={yFor(v)}
            r={10}
            fill="transparent"
            style={{ cursor: "pointer" }}
            onMouseEnter={() => setHover({ uid, i })}
            onMouseLeave={() =>
              setHover((h) => (h && h.uid === uid && h.i === i ? null : h))
            }
            onClick={() =>
              setHover((h) =>
                h && h.uid === uid && h.i === i ? null : { uid, i },
              )
            }
          />
        )),
      )}

      {/* Tooltip: delt plass + poeng, og ALLE som ligger likt i punktet */}
      {tt && (
        <g style={{ pointerEvents: "none" }}>
          <circle
            cx={tt.x}
            cy={tt.y}
            r={4.5}
            fill="rgb(var(--text))"
            stroke="rgb(var(--surface))"
            strokeWidth={2}
          />
          <rect
            x={tt.bx}
            y={tt.by}
            width={tt.bw}
            height={tt.bh}
            rx={8}
            fill="rgb(var(--elevated))"
            stroke="rgb(var(--border))"
            strokeWidth={1}
          />
          <text
            x={tt.bx + 10}
            y={tt.by + 16}
            className="font-bold"
            style={{ fontSize: 11, fill: "rgb(var(--text))" }}
          >
            {tt.plass}. plass · {tt.poeng}p
          </text>
          <text
            x={tt.bx + tt.bw - 10}
            y={tt.by + 16}
            textAnchor="end"
            style={{ fontSize: 9, fill: "rgb(var(--muted))" }}
          >
            {tt.dato}
          </text>
          {tt.vist.map((n, idx) => (
            <g key={idx}>
              <circle
                cx={tt.bx + 13}
                cy={tt.by + 31 + idx * 13}
                r={3}
                fill={n.farge}
              />
              <text
                x={tt.bx + 21}
                y={tt.by + 34 + idx * 13}
                className="font-semibold"
                style={{ fontSize: 10, fill: "rgb(var(--text))" }}
              >
                {n.navn}
              </text>
            </g>
          ))}
          {tt.flere > 0 && (
            <text
              x={tt.bx + 13}
              y={tt.by + 34 + tt.vist.length * 13}
              style={{ fontSize: 9, fill: "rgb(var(--muted))" }}
            >
              +{tt.flere} til likt
            </text>
          )}
        </g>
      )}
    </svg>
  );
}
