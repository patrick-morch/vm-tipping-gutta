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
  const sortert = [...tips].sort((a, b) => {
    if (kamp.resultat) {
      return (
        beregnPoeng(b, kamp.resultat, bonus) -
        beregnPoeng(a, kamp.resultat, bonus)
      );
    }
    return a.navn.localeCompare(b.navn, "nb");
  });

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
          {sortert.map((t) => {
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
            return (
              <div
                key={t.uid}
                className="flex items-center justify-between gap-2 text-[11px]"
              >
                <span className="truncate text-text/90">{t.navn}</span>
                <span className="flex items-center gap-2 flex-shrink-0">
                  <span className="tabular-nums font-bold">
                    {t.hjemme}–{t.borte}
                  </span>
                  {poengTekst && (
                    <span className={`font-bold ${farge} w-9 text-right`}>
                      {poengTekst}
                    </span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
