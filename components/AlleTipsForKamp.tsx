"use client";

import { useState } from "react";
import { useKampTips } from "@/lib/data";
import { beregnPoeng, type Match } from "@/lib/types";

/**
 * Utvidbar "Se alles tips" for én kamp. Leser on-demand (kun når åpnet), og
 * tipsene er frosne etter avspark → caches lokalt. Brukes på kamper- og
 * sluttspill-sidene for å se hva alle har tippet på låste/spilte kamper.
 */
export default function AlleTipsForKamp({ kamp }: { kamp: Match }) {
  const [vis, setVis] = useState(false);
  const tips = useKampTips(vis ? kamp.id : null);

  const bonus = kamp.bonusFaktor || 1;

  // Hvor mange har tippet hvert resultat — brukes til å la de mest populære
  // tippene komme øverst når kampen ikke er spilt ennå.
  const tippNøkkel = (h: number, b: number) => `${h}-${b}`;
  const antall = new Map<string, number>();
  for (const t of tips) {
    const k = tippNøkkel(t.hjemme, t.borte);
    antall.set(k, (antall.get(k) || 0) + 1);
  }

  // Grupperer like tipp under hverandre. Når kampen er spilt: høyest poeng
  // først, ellers de mest populære resultatene først. Innen hver gruppe
  // sorteres det alfabetisk på navn.
  const sortert = [...tips].sort((a, b) => {
    if (kamp.resultat) {
      const pd =
        beregnPoeng(b, kamp.resultat, bonus) -
        beregnPoeng(a, kamp.resultat, bonus);
      if (pd !== 0) return pd;
    } else {
      const cd =
        antall.get(tippNøkkel(b.hjemme, b.borte))! -
        antall.get(tippNøkkel(a.hjemme, a.borte))!;
      if (cd !== 0) return cd;
    }
    // Hold identiske resultat samlet.
    if (a.hjemme !== b.hjemme) return b.hjemme - a.hjemme;
    if (a.borte !== b.borte) return b.borte - a.borte;
    return a.navn.localeCompare(b.navn, "nb");
  });

  // Snitt-tipp og vanligste resultat i gjengen (regnes av de innlastede tipsene).
  const oppsummering = (() => {
    if (tips.length === 0) return null;
    const snittH = Math.round(
      tips.reduce((s, t) => s + t.hjemme, 0) / tips.length,
    );
    const snittB = Math.round(
      tips.reduce((s, t) => s + t.borte, 0) / tips.length,
    );
    let vanligst = "";
    let vanligstAntall = 0;
    for (const [k, n] of antall) {
      if (n > vanligstAntall) {
        vanligst = k;
        vanligstAntall = n;
      }
    }
    const [vH, vB] = vanligst.split("-");
    return { snittH, snittB, vH, vB, vanligstAntall };
  })();

  return (
    <div className="mt-2 pt-2 border-t border-border">
      <button
        type="button"
        onClick={() => setVis((v) => !v)}
        className="text-[11px] font-semibold text-muted hover:text-text flex items-center gap-1"
      >
        <span>{vis ? "▾" : "▸"}</span>
        {vis ? "Skjul alles tips" : "Se alles tips"}
      </button>
      {vis && (
        <div className="mt-2 space-y-1">
          {sortert.length === 0 && (
            <div className="text-[11px] text-muted">
              Ingen har tippet denne kampen.
            </div>
          )}
          {oppsummering && (
            <div className="flex items-center gap-3 px-2.5 py-1.5 rounded-lg bg-bg/40 text-[11px] text-muted mb-1">
              <span>
                Snitt:{" "}
                <span className="font-bold text-text tabular-nums">
                  {oppsummering.snittH}–{oppsummering.snittB}
                </span>
              </span>
              <span className="text-muted/40">·</span>
              <span>
                Vanligst:{" "}
                <span className="font-bold text-text tabular-nums">
                  {oppsummering.vH}–{oppsummering.vB}
                </span>{" "}
                ({oppsummering.vanligstAntall})
              </span>
            </div>
          )}
          {sortert.map((t, i) => {
            let poengTekst: string | null = null;
            let farge = "text-muted";
            if (kamp.resultat) {
              const p = beregnPoeng(t, kamp.resultat, bonus);
              poengTekst = `+${p}p`;
              farge =
                p >= 3 * bonus
                  ? "text-success"
                  : p >= 1 * bonus
                    ? "text-accent"
                    : "text-muted";
            }
            // Ny gruppe når resultatet skiller seg fra raden over → litt luft.
            const forrige = sortert[i - 1];
            const nyGruppe =
              i > 0 &&
              (forrige.hjemme !== t.hjemme || forrige.borte !== t.borte);
            return (
              <div
                key={t.uid}
                className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-elevated/50 border border-border/50 text-[11px] ${
                  nyGruppe ? "mt-2" : ""
                }`}
              >
                <span className="flex-1 min-w-0 truncate font-semibold">
                  {t.navn}
                </span>
                <span className="tabular-nums font-bold bg-bg/60 px-1.5 py-0.5 rounded w-12 text-center flex-shrink-0">
                  {t.hjemme}–{t.borte}
                </span>
                <span
                  className={`font-bold w-8 text-right flex-shrink-0 ${farge}`}
                >
                  {poengTekst}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
