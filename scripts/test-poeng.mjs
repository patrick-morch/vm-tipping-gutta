// Verifiserer poengsystemet ende-til-ende ved å kopiere aggregator-logikken
// og kjøre kjente scenarier mot forventede utfall.

const POENG = { vmVinner: 25, toppscorer: 15, toppassist: 10 };
const TIPPBARE_GRUPPE_LAG = new Set([
  "Mexico",
  "Tyskland",
  "Sveits",
  "Sverige",
  "Nederland",
  "Argentina",
  "Østerrike",
  "Brasil",
  "Skottland",
  "Belgia",
  "Portugal",
  "USA",
  "Spania",
  "Uruguay",
  "England",
  "Kroatia",
  "Frankrike",
  "Senegal",
  "Norge",
  "Irak",
]);

function erTippbar(kamp) {
  if (!kamp.runde?.startsWith("Gruppe")) return true;
  return (
    TIPPBARE_GRUPPE_LAG.has(kamp.hjemmelag) ||
    TIPPBARE_GRUPPE_LAG.has(kamp.bortelag)
  );
}

function beregnPoeng(tip, resultat, bonus = 1) {
  const eksakt = tip.hjemme === resultat.hjemme && tip.borte === resultat.borte;
  if (eksakt) return 3 * bonus;
  const ut = Math.sign(tip.hjemme - tip.borte);
  const ur = Math.sign(resultat.hjemme - resultat.borte);
  if (ut === ur) return 1 * bonus;
  return 0;
}

// Identisk med aggreger-poeng.mjs sin logikk
function aggreger({ brukere, kamper, tips, spesial, fasit }) {
  const kampMap = new Map(kamper.map((k) => [k.id, k]));
  const rader = new Map();
  for (const b of brukere) {
    rader.set(b.uid, {
      uid: b.uid,
      navn: b.navn,
      kampPoeng: 0,
      spesialPoeng: 0,
      eksakte: 0,
    });
  }
  for (const t of tips) {
    const rad = rader.get(t.uid);
    if (!rad) continue;
    const kamp = kampMap.get(t.matchId);
    if (!kamp || !kamp.resultat) continue;
    if (!erTippbar(kamp)) continue;
    const p = beregnPoeng(t, kamp.resultat, kamp.bonusFaktor || 1);
    rad.kampPoeng += p;
    if (p >= 3 * (kamp.bonusFaktor || 1)) rad.eksakte += 1;
  }
  for (const s of spesial) {
    const rad = rader.get(s.uid);
    if (!rad) continue;
    if (fasit.vmVinner && fasit.vmVinner === s.vmVinner)
      rad.spesialPoeng += POENG.vmVinner;
    if (
      fasit.toppscorer &&
      s.toppscorer?.trim().toLowerCase() ===
        fasit.toppscorer.trim().toLowerCase()
    )
      rad.spesialPoeng += POENG.toppscorer;
    if (
      fasit.toppassist &&
      s.toppassist?.trim().toLowerCase() ===
        fasit.toppassist.trim().toLowerCase()
    )
      rad.spesialPoeng += POENG.toppassist;
  }
  rader.forEach((r) => {
    r.poeng = r.kampPoeng + r.spesialPoeng;
  });
  return Array.from(rader.values());
}

// ─── Felles testdata ───
const KAMPER = [
  {
    id: "I2",
    runde: "Gruppe I",
    hjemmelag: "Norge",
    bortelag: "Irak",
    bonusFaktor: 2,
    resultat: { hjemme: 2, borte: 1 },
  },
  {
    id: "C1",
    runde: "Gruppe C",
    hjemmelag: "Marokko",
    bortelag: "Brasil",
    bonusFaktor: 1,
    resultat: { hjemme: 1, borte: 2 },
  },
  {
    id: "D2",
    runde: "Gruppe D",
    hjemmelag: "Tyrkia",
    bortelag: "Australia",
    bonusFaktor: 1,
    resultat: { hjemme: 1, borte: 0 },
  }, // Ikke tippbar
  {
    id: "L1",
    runde: "Gruppe L",
    hjemmelag: "Kroatia",
    bortelag: "England",
    bonusFaktor: 1,
    resultat: { hjemme: 0, borte: 2 },
  },
  {
    id: "kn-1",
    runde: "32-delsfinale",
    hjemmelag: "Frankrike",
    bortelag: "Norge",
    bonusFaktor: 2,
    resultat: { hjemme: 1, borte: 2 },
  }, // Knockout, alltid tippbar
  {
    id: "kn-2",
    runde: "Finale",
    hjemmelag: "Brasil",
    bortelag: "Argentina",
    bonusFaktor: 1,
    resultat: null,
  }, // Ikke spilt
];

const FASIT = {
  vmVinner: "Norge",
  toppscorer: "Erling Haaland",
  toppassist: "Martin Ødegaard",
};

// ─── Test-scenarier ───
const tests = [];
function test(navn, faktisk, forventet) {
  const ok = faktisk === forventet;
  tests.push({ navn, ok, faktisk, forventet });
  console.log(
    `  ${ok ? "✓" : "✗"} ${navn}: ${faktisk}${ok ? "" : ` (forventet ${forventet})`}`,
  );
  if (!ok) process.exitCode = 1;
}

const SCENARIER = [
  {
    bruker: "A",
    navn: "Eksakt Norge-kamp + utfall + feil + ikke-tippbar",
    tipps: [
      { matchId: "I2", hjemme: 2, borte: 1 }, // Eksakt, ×2 → 6p
      { matchId: "C1", hjemme: 0, borte: 3 }, // Riktig utfall (begge borte) → 1p
      { matchId: "L1", hjemme: 1, borte: 0 }, // Feil utfall (hjem vs borte) → 0p
      { matchId: "D2", hjemme: 1, borte: 0 }, // Eksakt på IKKE TIPPBAR → 0p
    ],
    spesial: null,
    forventet: {
      kampPoeng: 6 + 1 + 0 + 0,
      spesialPoeng: 0,
      eksakte: 1,
      poeng: 7,
    },
  },
  {
    bruker: "B",
    navn: "Knockout eksakt + spesial alle tre",
    tipps: [
      { matchId: "kn-1", hjemme: 1, borte: 2 }, // Knockout-eksakt med Norge ×2 → 6p
    ],
    spesial: {
      vmVinner: "Norge",
      toppscorer: "Erling Haaland",
      toppassist: "Martin Ødegaard",
    },
    forventet: {
      kampPoeng: 6,
      spesialPoeng: 25 + 15 + 10,
      eksakte: 1,
      poeng: 56,
    },
  },
  {
    bruker: "C",
    navn: "Bare feil spesial",
    tipps: [],
    spesial: {
      vmVinner: "Brasil",
      toppscorer: "Messi",
      toppassist: "Mbappé",
    },
    forventet: { kampPoeng: 0, spesialPoeng: 0, eksakte: 0, poeng: 0 },
  },
  {
    bruker: "D",
    navn: "Toppscorer case-insensitive match",
    tipps: [],
    spesial: {
      vmVinner: "",
      toppscorer: "  ERLING haaland ",
      toppassist: "",
    },
    forventet: { kampPoeng: 0, spesialPoeng: 15, eksakte: 0, poeng: 15 },
  },
  {
    bruker: "E",
    navn: "Riktig utfall ikke-Norge (×1)",
    tipps: [
      { matchId: "L1", hjemme: 0, borte: 3 }, // Borte vinner, fasit også borte → 1p
    ],
    spesial: null,
    forventet: { kampPoeng: 1, spesialPoeng: 0, eksakte: 0, poeng: 1 },
  },
  {
    bruker: "F",
    navn: "Tipp på kamp uten resultat",
    tipps: [
      { matchId: "kn-2", hjemme: 3, borte: 0 }, // Ingen fasit → 0p
    ],
    spesial: null,
    forventet: { kampPoeng: 0, spesialPoeng: 0, eksakte: 0, poeng: 0 },
  },
  {
    bruker: "G",
    navn: "Norge-utfall (×2)",
    tipps: [
      { matchId: "I2", hjemme: 1, borte: 0 }, // Norge vinner 1-0, fasit 2-1, utfall ok → 2p
    ],
    spesial: null,
    forventet: { kampPoeng: 2, spesialPoeng: 0, eksakte: 0, poeng: 2 },
  },
];

const brukere = SCENARIER.map((s) => ({ uid: s.bruker, navn: s.bruker }));
const tips = SCENARIER.flatMap((s) =>
  (s.tipps || []).map((t) => ({ ...t, uid: s.bruker })),
);
const spesial = SCENARIER.filter((s) => s.spesial).map((s) => ({
  ...s.spesial,
  uid: s.bruker,
}));

const rader = aggreger({ brukere, kamper: KAMPER, tips, spesial, fasit: FASIT });
const radMap = new Map(rader.map((r) => [r.uid, r]));

console.log("Poengberegning per bruker:\n");
for (const s of SCENARIER) {
  console.log(`Bruker ${s.bruker} — ${s.navn}`);
  const r = radMap.get(s.bruker);
  test(`kampPoeng`, r.kampPoeng, s.forventet.kampPoeng);
  test(`spesialPoeng`, r.spesialPoeng, s.forventet.spesialPoeng);
  test(`eksakte`, r.eksakte, s.forventet.eksakte);
  test(`poeng (total)`, r.poeng, s.forventet.poeng);
  console.log("");
}

const feil = tests.filter((t) => !t.ok).length;
console.log(
  `${feil === 0 ? "✓" : "✗"} ${tests.length - feil}/${tests.length} sjekker grønne`,
);
