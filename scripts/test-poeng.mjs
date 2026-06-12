// Verifiserer poengsystemet ende-til-ende ved å kopiere aggregator-logikken
// og kjøre kjente scenarier mot forventede utfall.
//
// Speiler scripts/aggreger-poeng.mjs: alle lag er tippbare (ingen kuratorliste),
// fire spesial-bets (vmVinner, toppscorer, toppassist, ronaldoVsMessi), og
// teller eksakte/utfall/feil per bruker.

const POENG = { vmVinner: 25, toppscorer: 15, toppassist: 10, ronaldoVsMessi: 5 };

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
      utfall: 0,
      feil: 0,
    });
  }
  for (const t of tips) {
    const rad = rader.get(t.uid);
    if (!rad) continue;
    const kamp = kampMap.get(t.matchId);
    if (!kamp || !kamp.resultat) continue;
    if (kamp.ferdig === false) continue; // live-stilling teller ikke
    const bonus = kamp.bonusFaktor || 1;
    const p = beregnPoeng(t, kamp.resultat, bonus);
    rad.kampPoeng += p;
    if (p >= 3 * bonus) rad.eksakte += 1;
    else if (p >= 1 * bonus) rad.utfall += 1;
    else rad.feil += 1;
  }
  const norm = (s) => s.trim().toLowerCase();
  for (const s of spesial) {
    const rad = rader.get(s.uid);
    if (!rad) continue;
    if (fasit.vmVinner && fasit.vmVinner === s.vmVinner)
      rad.spesialPoeng += POENG.vmVinner;
    if (fasit.toppscorer && s.toppscorer && norm(s.toppscorer) === norm(fasit.toppscorer))
      rad.spesialPoeng += POENG.toppscorer;
    if (fasit.toppassist && s.toppassist && norm(s.toppassist) === norm(fasit.toppassist))
      rad.spesialPoeng += POENG.toppassist;
    if (fasit.ronaldoVsMessi && s.ronaldoVsMessi && s.ronaldoVsMessi === fasit.ronaldoVsMessi)
      rad.spesialPoeng += POENG.ronaldoVsMessi;
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
  }, // Alle lag er nå tippbare
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
  }, // Knockout
  {
    id: "kn-2",
    runde: "Finale",
    hjemmelag: "Brasil",
    bortelag: "Argentina",
    bonusFaktor: 1,
    resultat: null,
  }, // Ikke spilt
  {
    id: "LV1",
    runde: "Gruppe B",
    hjemmelag: "Sveits",
    bortelag: "Qatar",
    bonusFaktor: 1,
    resultat: { hjemme: 1, borte: 0 },
    ferdig: false,
  }, // Live-stilling — skal IKKE gi poeng
];

const FASIT = {
  vmVinner: "Norge",
  toppscorer: "Erling Haaland",
  toppassist: "Martin Ødegaard",
  ronaldoVsMessi: "messi",
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
    navn: "Eksakt Norge-kamp + utfall + feil + eksakt (alle teller nå)",
    tipps: [
      { matchId: "I2", hjemme: 2, borte: 1 }, // Eksakt, ×2 → 6p (eksakt)
      { matchId: "C1", hjemme: 0, borte: 3 }, // Riktig utfall (begge borte) → 1p (utfall)
      { matchId: "L1", hjemme: 1, borte: 0 }, // Feil utfall → 0p (feil)
      { matchId: "D2", hjemme: 1, borte: 0 }, // Eksakt, ×1 → 3p (eksakt)
    ],
    spesial: null,
    forventet: {
      kampPoeng: 6 + 1 + 0 + 3,
      spesialPoeng: 0,
      eksakte: 2,
      utfall: 1,
      feil: 1,
      poeng: 10,
    },
  },
  {
    bruker: "B",
    navn: "Knockout eksakt + spesial tre treff",
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
      utfall: 0,
      feil: 0,
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
    forventet: { kampPoeng: 0, spesialPoeng: 0, eksakte: 0, utfall: 0, feil: 0, poeng: 0 },
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
    forventet: { kampPoeng: 0, spesialPoeng: 15, eksakte: 0, utfall: 0, feil: 0, poeng: 15 },
  },
  {
    bruker: "E",
    navn: "Riktig utfall ikke-Norge (×1)",
    tipps: [
      { matchId: "L1", hjemme: 0, borte: 3 }, // Borte vinner, fasit også borte → 1p
    ],
    spesial: null,
    forventet: { kampPoeng: 1, spesialPoeng: 0, eksakte: 0, utfall: 1, feil: 0, poeng: 1 },
  },
  {
    bruker: "F",
    navn: "Tipp på kamp uten resultat",
    tipps: [
      { matchId: "kn-2", hjemme: 3, borte: 0 }, // Ingen fasit → 0p
    ],
    spesial: null,
    forventet: { kampPoeng: 0, spesialPoeng: 0, eksakte: 0, utfall: 0, feil: 0, poeng: 0 },
  },
  {
    bruker: "G",
    navn: "Norge-utfall (×2)",
    tipps: [
      { matchId: "I2", hjemme: 1, borte: 0 }, // Norge vinner 1-0, fasit 2-1, utfall ok → 2p
    ],
    spesial: null,
    forventet: { kampPoeng: 2, spesialPoeng: 0, eksakte: 0, utfall: 1, feil: 0, poeng: 2 },
  },
  {
    bruker: "H",
    navn: "Ronaldo vs Messi-treff",
    tipps: [],
    spesial: { ronaldoVsMessi: "messi" },
    forventet: { kampPoeng: 0, spesialPoeng: 5, eksakte: 0, utfall: 0, feil: 0, poeng: 5 },
  },
  {
    bruker: "I",
    navn: "Eksakt på live-kamp (ferdig:false) gir 0 til full tid",
    tipps: [
      { matchId: "LV1", hjemme: 1, borte: 0 }, // eksakt, men ferdig:false → 0p
    ],
    spesial: null,
    forventet: { kampPoeng: 0, spesialPoeng: 0, eksakte: 0, utfall: 0, feil: 0, poeng: 0 },
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
  test(`utfall`, r.utfall, s.forventet.utfall);
  test(`feil`, r.feil, s.forventet.feil);
  test(`poeng (total)`, r.poeng, s.forventet.poeng);
  console.log("");
}

const feil = tests.filter((t) => !t.ok).length;
console.log(
  `${feil === 0 ? "✓" : "✗"} ${tests.length - feil}/${tests.length} sjekker grønne`,
);
