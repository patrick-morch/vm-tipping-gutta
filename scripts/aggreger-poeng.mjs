// Aggregerer poeng for alle brukere og skriver til 'aggregert/ledertavle'.
// Kjøres én gang i døgnet via GitHub Actions, og kan trigges manuelt fra admin.
//
// Hensikt: ledertavlen leser ett dokument (1 read) i stedet for alle tipps
// (~30K reads). Holder oss innenfor Firestore Spark-tieren.

import admin from "firebase-admin";

const POENG = {
  vmVinner: 25,
  toppscorer: 15,
  toppassist: 10,
};

// Speil av lib/vm-data.ts TIPPBARE_GRUPPE_LAG. Tipps på gruppekamper
// utenfor denne lista (og utenfor Gruppe I) gir 0 poeng, så folk som
// tilfeldigvis tippet på Australia-Tyrkia før kuratorlista ble lagt
// til ikke får urettferdig fordel.
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
  if (!kamp.runde?.startsWith("Gruppe")) return true; // knockout = alle
  return (
    TIPPBARE_GRUPPE_LAG.has(kamp.hjemmelag) ||
    TIPPBARE_GRUPPE_LAG.has(kamp.bortelag)
  );
}

function init() {
  if (admin.apps.length) return;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT mangler.");
  let json;
  try {
    json = JSON.parse(raw);
  } catch {
    json = JSON.parse(Buffer.from(raw, "base64").toString("utf-8"));
  }
  admin.initializeApp({ credential: admin.credential.cert(json) });
}

function beregnPoeng(tip, resultat, bonus = 1) {
  const eksakt = tip.hjemme === resultat.hjemme && tip.borte === resultat.borte;
  if (eksakt) return 3 * bonus;
  const ut = Math.sign(tip.hjemme - tip.borte);
  const ur = Math.sign(resultat.hjemme - resultat.borte);
  if (ut === ur) return 1 * bonus;
  return 0;
}

async function aggreger() {
  init();
  const db = admin.firestore();

  console.log("Leser data…");
  const [brukereSnap, kamperSnap, tipsSnap, spesialSnap, fasitSnap] =
    await Promise.all([
      db.collection("brukere").get(),
      db.collection("kamper").get(),
      db.collection("tips").get(),
      db.collection("spesialtips").get(),
      db.collection("fasit").doc("vm").get(),
    ]);

  const brukere = brukereSnap.docs.map((d) => d.data());
  const kampMap = new Map(
    kamperSnap.docs.map((d) => [d.id, d.data()]),
  );
  const tips = tipsSnap.docs.map((d) => d.data());
  const spesial = spesialSnap.docs.map((d) => d.data());
  const fasit = fasitSnap.exists ? fasitSnap.data() : {};

  console.log(
    `  ${brukere.length} brukere · ${kampMap.size} kamper · ${tips.length} tipps · ${spesial.length} spesialtipps`,
  );

  const rader = new Map();
  for (const b of brukere) {
    rader.set(b.uid, {
      uid: b.uid,
      navn: b.navn,
      avdeling: b.avdeling || "",
      klubbRolle: b.klubbRolle || null,
      poeng: 0,
      kampPoeng: 0,
      spesialPoeng: 0,
      eksakte: 0,
    });
  }

  // Kamp-poeng (bare tippbare kamper teller — kuraterte gruppekamper
  // + alle knockout)
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

  // Spesial-poeng
  for (const s of spesial) {
    const rad = rader.get(s.uid);
    if (!rad) continue;
    if (fasit.vmVinner && fasit.vmVinner === s.vmVinner)
      rad.spesialPoeng += POENG.vmVinner;
    if (
      fasit.toppscorer &&
      s.toppscorer.trim().toLowerCase() ===
        fasit.toppscorer.trim().toLowerCase()
    )
      rad.spesialPoeng += POENG.toppscorer;
    if (
      fasit.toppassist &&
      s.toppassist.trim().toLowerCase() ===
        fasit.toppassist.trim().toLowerCase()
    )
      rad.spesialPoeng += POENG.toppassist;
  }

  const liste = Array.from(rader.values())
    .map((r) => ({ ...r, poeng: r.kampPoeng + r.spesialPoeng }))
    .sort((a, b) => b.poeng - a.poeng);

  await db
    .collection("aggregert")
    .doc("ledertavle")
    .set({
      oppdatert: Date.now(),
      kamperSpilt: Array.from(kampMap.values()).filter((k) => k.resultat).length,
      kamperTotalt: kampMap.size,
      rader: liste,
    });

  console.log(
    `\n✓ Skrev aggregert/ledertavle med ${liste.length} rader. Topp 3:`,
  );
  liste.slice(0, 3).forEach((r, i) =>
    console.log(`  ${i + 1}. ${r.navn} — ${r.poeng}p`),
  );
}

await aggreger();
