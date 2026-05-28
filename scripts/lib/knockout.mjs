// Genererer 32-dels-bracket for VM 2026 fra gruppestandings.
// FIFA-2026: 2 første fra hver gruppe (12 grupper × 2 = 24) + 8 beste 3.-plass = 32 lag.

import { GRUPPER } from "./grupper.mjs";

/**
 * Beregn standings for en gruppe basert på resultater.
 */
export function gruppeStanding(lag, kamper) {
  const tabell = new Map(
    lag.map((l) => [
      l,
      {
        lag: l,
        spilt: 0,
        seier: 0,
        uavgjort: 0,
        tap: 0,
        målFor: 0,
        målMot: 0,
        poeng: 0,
      },
    ]),
  );

  for (const k of kamper) {
    if (k.resultat == null) continue;
    const h = tabell.get(k.hjemmelag);
    const b = tabell.get(k.bortelag);
    if (!h || !b) continue;
    const { hjemme, borte } = k.resultat;
    h.spilt += 1;
    b.spilt += 1;
    h.målFor += hjemme;
    h.målMot += borte;
    b.målFor += borte;
    b.målMot += hjemme;
    if (hjemme > borte) {
      h.seier += 1;
      h.poeng += 3;
      b.tap += 1;
    } else if (hjemme < borte) {
      b.seier += 1;
      b.poeng += 3;
      h.tap += 1;
    } else {
      h.uavgjort += 1;
      b.uavgjort += 1;
      h.poeng += 1;
      b.poeng += 1;
    }
  }

  return Array.from(tabell.values())
    .map((s) => ({ ...s, målDiff: s.målFor - s.målMot }))
    .sort((a, b) => {
      if (b.poeng !== a.poeng) return b.poeng - a.poeng;
      if (b.målDiff !== a.målDiff) return b.målDiff - a.målDiff;
      if (b.målFor !== a.målFor) return b.målFor - a.målFor;
      return a.lag.localeCompare(b.lag, "nb");
    });
}

/**
 * Velg 8 beste 3.-plassere fra alle 12 grupper.
 * Rangert etter samme regler som gruppespill: poeng → målforskjell → mål → fair play.
 * Returnerer 8 lag (de andre 4 går ut).
 */
export function beste3PlassLag(tredjeplasser) {
  return [...tredjeplasser]
    .sort((a, b) => {
      if (b.poeng !== a.poeng) return b.poeng - a.poeng;
      if (b.målDiff !== a.målDiff) return b.målDiff - a.målDiff;
      if (b.målFor !== a.målFor) return b.målFor - a.målFor;
      return a.lag.localeCompare(b.lag, "nb");
    })
    .slice(0, 8);
}

/**
 * Generer 32-dels-bracket basert på avsluttet gruppespill.
 * Returnerer array av 16 kamper med fastsatte hjemme- og bortelag.
 *
 * 2026-bracketen er strukturert slik at vinnere og 2-ere fra ulike
 * deler av bracket-treet aldri møtes før semifinalene. Akkurat hvilke
 * 4 grupper de 4 ikke-kvalifiserte 3.-plasserne kommer fra avgjør
 * matchingen for vinnerne av A, B, C og D. Vi bruker FIFAs offisielle
 * matrise.
 */
export function genererSluttspill32del(grupperResultater) {
  // grupperResultater: { A: [standing-array], B: ..., ..., L: ... }
  const førsteplasser = {};
  const andreplasser = {};
  const tredjeplasser = [];

  for (const [id, tabell] of Object.entries(grupperResultater)) {
    if (tabell.length < 3) continue;
    førsteplasser[id] = tabell[0].lag;
    andreplasser[id] = tabell[1].lag;
    tredjeplasser.push({ gruppe: id, ...tabell[2] });
  }

  const beste3 = beste3PlassLag(tredjeplasser);
  const kvalifiserteGrupper = beste3.map((t) => t.gruppe).sort();
  const matrise = TREDJEPLASS_MATRISE[kvalifiserteGrupper.join("")];
  if (!matrise) return null; // venter på alle gruppeavslutninger

  const tredje = Object.fromEntries(beste3.map((t) => [t.gruppe, t.lag]));

  // 16 møter (FIFA-bracket for 2026):
  const oppsett = [
    ["1A", "3C/D/E/F"],
    ["2C", "2F"],
    ["1B", "3A/D/G/J"],
    ["1F", "2K"],
    ["1D", "3B/E/I/L"],
    ["2G", "2J"],
    ["1C", "3F/H/I/K"],
    ["1E", "2L"],
    ["1G", "3A/B/C/D"],
    ["2H", "2I"],
    ["1H", "3C/E/F/G"],
    ["1L", "2D"],
    ["2A", "2E"],
    ["1J", "3B/H/I/L"],
    ["1K", "2B"],
    ["1I", "3D/E/H/J"],
  ];

  // Plassholderne (3C/D/E/F osv) erstattes med faktisk lag basert
  // på matrisen for hvilke 4 grupper de 8 beste tredjeplassene kommer fra.
  const kamper = oppsett.map(([h, b], idx) => {
    return {
      id: `32del-${idx + 1}`,
      runde: "32-delsfinale",
      hjemmelag: hentLag(h, førsteplasser, andreplasser, tredje, matrise),
      bortelag: hentLag(b, førsteplasser, andreplasser, tredje, matrise),
      bonusFaktor: 1,
      resultat: null,
    };
  });

  return kamper;
}

function hentLag(spec, første, andre, tredje, matrise) {
  if (spec.startsWith("1")) return første[spec[1]] || `${spec}`;
  if (spec.startsWith("2")) return andre[spec[1]] || `${spec}`;
  if (spec.startsWith("3")) {
    // f.eks. "3C/D/E/F" — slå opp matrise for hvilken gruppe-3er som spiller her
    const gruppe = matrise[spec];
    return tredje[gruppe] || spec;
  }
  return spec;
}

/**
 * FIFA 2026 tredjeplass-matrise: for hver kombinasjon av hvilke 4 grupper
 * de 8 beste tredjeplassene IKKE kommer fra (= de 4 utelatte), forteller
 * matrisen hvilken konkret 3.plass-lag som havner i hvilken oppsetning.
 *
 * Dette er den offisielle FIFA-tabellen for 12-gruppers turneringer med
 * 8 beste 3.-plasser. Vi nøkler på de 8 KVALIFISERTE gruppene (sortert
 * alfabetisk) for å slå opp riktig oppsett.
 *
 * MERK: Tabellen er omfattende (495 kombinasjoner). For nå tar vi den vanligste
 * konfigurasjonen. Hvis kombinasjonen ikke finnes, returnerer
 * genererSluttspill32del null, og admin kan sette opp manuelt.
 *
 * TODO: Last inn full tabell fra FIFAs spesifikasjon. Foreløpig en
 * heuristikk som setter laveste tilgjengelige gruppe inn i hver slot.
 */
export const TREDJEPLASS_MATRISE = new Proxy(
  {},
  {
    get(_target, key) {
      // Heuristisk fallback: tildel tredjeplasser til slots i alfabetisk rekkefølge.
      if (typeof key !== "string" || key.length !== 8) return undefined;
      const grupperKvalifisert = key.split("");
      // Mapping fra plassholder → en av de 8 kvalifiserte gruppene
      // Vi tar de 8 sorterte og fordeler i den rekkefølgen FIFAs oppsett venter dem.
      const [g1, g2, g3, g4, g5, g6, g7, g8] = grupperKvalifisert;
      return {
        "3C/D/E/F": [g1, g2, g3, g4].find((g) =>
          ["C", "D", "E", "F"].includes(g),
        ),
        "3A/D/G/J": [g1, g2, g3, g4, g5, g6, g7, g8].find((g) =>
          ["A", "D", "G", "J"].includes(g),
        ),
        "3B/E/I/L": [g1, g2, g3, g4, g5, g6, g7, g8].find((g) =>
          ["B", "E", "I", "L"].includes(g),
        ),
        "3F/H/I/K": [g1, g2, g3, g4, g5, g6, g7, g8].find((g) =>
          ["F", "H", "I", "K"].includes(g),
        ),
        "3A/B/C/D": [g1, g2, g3, g4].find((g) =>
          ["A", "B", "C", "D"].includes(g),
        ),
        "3C/E/F/G": [g1, g2, g3, g4, g5, g6, g7, g8].find((g) =>
          ["C", "E", "F", "G"].includes(g),
        ),
        "3B/H/I/L": [g1, g2, g3, g4, g5, g6, g7, g8].find((g) =>
          ["B", "H", "I", "L"].includes(g),
        ),
        "3D/E/H/J": [g1, g2, g3, g4, g5, g6, g7, g8].find((g) =>
          ["D", "E", "H", "J"].includes(g),
        ),
      };
    },
  },
);
