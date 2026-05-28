"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import spillerData from "@/lib/spillere.json";

type Spiller = {
  navn: string;
  lag: string;
  pos: "GK" | "DF" | "MF" | "FW";
};

type SpillerJson = Record<string, { navn: string; pos: string }[]>;

function bygglag(): Spiller[] {
  const data = spillerData as SpillerJson;
  const flat: Spiller[] = [];
  for (const [lag, spillere] of Object.entries(data)) {
    for (const s of spillere) {
      flat.push({ navn: s.navn, lag, pos: s.pos as Spiller["pos"] });
    }
  }
  return flat;
}

const ALLE: Spiller[] = bygglag();

function normaliser(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

const POS_FARGE: Record<Spiller["pos"], string> = {
  GK: "text-muted",
  DF: "text-accent",
  MF: "text-success",
  FW: "text-norge",
};

export default function SpillerVelger({
  verdi,
  onVelg,
  placeholder = "Søk spiller…",
  posFilter,
}: {
  verdi: string;
  onVelg: (navn: string) => void;
  placeholder?: string;
  posFilter?: ("GK" | "DF" | "MF" | "FW")[];
}) {
  const [søk, setSøk] = useState(verdi);
  const [åpen, setÅpen] = useState(false);
  const [valgt, setValgt] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSøk(verdi);
  }, [verdi]);

  useEffect(() => {
    function utenfor(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setÅpen(false);
      }
    }
    document.addEventListener("mousedown", utenfor);
    return () => document.removeEventListener("mousedown", utenfor);
  }, []);

  const treff = useMemo(() => {
    const q = normaliser(søk.trim());
    if (!q) return [];
    const filtered = posFilter
      ? ALLE.filter((s) => posFilter.includes(s.pos))
      : ALLE;
    const med = filtered
      .map((s) => {
        const navnN = normaliser(s.navn);
        const lagN = normaliser(s.lag);
        const navnStart = navnN.startsWith(q);
        const navnHar = navnN.includes(q);
        const lagHar = lagN.includes(q);
        if (!navnHar && !lagHar) return null;
        const score = (navnStart ? 100 : 0) + (navnHar ? 50 : 0) + (lagHar ? 10 : 0);
        return { spiller: s, score };
      })
      .filter((x): x is { spiller: Spiller; score: number } => x !== null)
      .sort((a, b) => b.score - a.score)
      .slice(0, 12)
      .map((x) => x.spiller);
    return med;
  }, [søk, posFilter]);

  function velg(s: Spiller) {
    onVelg(s.navn);
    setSøk(s.navn);
    setÅpen(false);
  }

  function tøm() {
    onVelg("");
    setSøk("");
    setÅpen(false);
  }

  function tast(e: React.KeyboardEvent) {
    if (!åpen || treff.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setValgt((v) => Math.min(v + 1, treff.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setValgt((v) => Math.max(v - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      velg(treff[valgt]);
    } else if (e.key === "Escape") {
      setÅpen(false);
    }
  }

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <input
          type="text"
          value={søk}
          onChange={(e) => {
            setSøk(e.target.value);
            setÅpen(true);
            setValgt(0);
          }}
          onFocus={() => setÅpen(true)}
          onKeyDown={tast}
          placeholder={placeholder}
          className="w-full h-11 pl-3 pr-10 rounded-xl bg-elevated border border-border focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
        {søk && (
          <button
            type="button"
            onClick={tøm}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg text-muted hover:text-text hover:bg-border/50 flex items-center justify-center text-lg"
            aria-label="Tøm"
            tabIndex={-1}
          >
            ×
          </button>
        )}
      </div>

      {åpen && treff.length > 0 && (
        <div className="absolute z-20 mt-1 w-full bg-surface border border-border rounded-xl shadow-card overflow-hidden max-h-[320px] overflow-y-auto">
          {treff.map((s, i) => (
            <button
              key={`${s.navn}-${s.lag}`}
              type="button"
              onMouseEnter={() => setValgt(i)}
              onClick={() => velg(s)}
              className={`w-full text-left px-3 py-2 flex items-center justify-between gap-2 transition ${
                i === valgt ? "bg-elevated" : ""
              }`}
            >
              <div className="min-w-0">
                <div className="font-medium text-sm truncate">{s.navn}</div>
                <div className="text-[11px] text-muted truncate">{s.lag}</div>
              </div>
              <span
                className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${POS_FARGE[s.pos]} bg-elevated`}
              >
                {s.pos}
              </span>
            </button>
          ))}
        </div>
      )}

      {åpen && søk.trim() && treff.length === 0 && (
        <div className="absolute z-20 mt-1 w-full bg-surface border border-border rounded-xl px-3 py-2 text-sm text-muted">
          Ingen treff. Spillerlista oppdateres når FIFA-tropper er klare 1. juni.
        </div>
      )}
    </div>
  );
}
