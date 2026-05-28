import { Match, Prediction } from "./types";

export type Standing = {
  lag: string;
  spilt: number;
  seier: number;
  uavgjort: number;
  tap: number;
  målFor: number;
  målMot: number;
  målDiff: number;
  poeng: number;
};

export type StandingMedPosisjon = Standing & { posisjon: number };

function tom(lag: string): Standing {
  return {
    lag,
    spilt: 0,
    seier: 0,
    uavgjort: 0,
    tap: 0,
    målFor: 0,
    målMot: 0,
    målDiff: 0,
    poeng: 0,
  };
}

/**
 * Beregn gruppetabell basert på et sett kamper med resultater.
 * Kampene kan være fakta eller brukerens prediksjoner.
 */
export function beregnTabell(
  lag: string[],
  kamper: {
    hjemmelag: string;
    bortelag: string;
    resultat?: { hjemme: number; borte: number } | null;
  }[],
): StandingMedPosisjon[] {
  const map = new Map<string, Standing>();
  lag.forEach((l) => map.set(l, tom(l)));

  kamper.forEach((k) => {
    if (!k.resultat) return;
    const hjem = map.get(k.hjemmelag);
    const bort = map.get(k.bortelag);
    if (!hjem || !bort) return;
    const { hjemme, borte } = k.resultat;
    hjem.spilt += 1;
    bort.spilt += 1;
    hjem.målFor += hjemme;
    hjem.målMot += borte;
    bort.målFor += borte;
    bort.målMot += hjemme;
    if (hjemme > borte) {
      hjem.seier += 1;
      hjem.poeng += 3;
      bort.tap += 1;
    } else if (hjemme < borte) {
      bort.seier += 1;
      bort.poeng += 3;
      hjem.tap += 1;
    } else {
      hjem.uavgjort += 1;
      bort.uavgjort += 1;
      hjem.poeng += 1;
      bort.poeng += 1;
    }
  });

  return Array.from(map.values())
    .map((s) => ({ ...s, målDiff: s.målFor - s.målMot }))
    .sort((a, b) => {
      if (b.poeng !== a.poeng) return b.poeng - a.poeng;
      if (b.målDiff !== a.målDiff) return b.målDiff - a.målDiff;
      if (b.målFor !== a.målFor) return b.målFor - a.målFor;
      return a.lag.localeCompare(b.lag, "nb");
    })
    .map((s, i) => ({ ...s, posisjon: i + 1 }));
}

/**
 * Lag en "syntetisk kampliste" der hver kamp har resultat hentet fra
 * tipsene hvis brukeren har tippet, ellers null.
 */
export function kamperMedMineTips(
  kamper: Match[],
  tips: Record<string, Prediction>,
): {
  hjemmelag: string;
  bortelag: string;
  resultat: { hjemme: number; borte: number } | null;
}[] {
  return kamper.map((k) => {
    const t = tips[k.id];
    if (t) {
      return {
        hjemmelag: k.hjemmelag,
        bortelag: k.bortelag,
        resultat: { hjemme: t.hjemme, borte: t.borte },
      };
    }
    return {
      hjemmelag: k.hjemmelag,
      bortelag: k.bortelag,
      resultat: k.resultat ?? null,
    };
  });
}
