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
  ronaldoVsMessi: 5,
};

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
      utfall: 0,
      feil: 0,
    });
  }

  // Kamp-poeng — bare FERDIGSPILTE kamper teller. `ferdig === false` betyr at
  // resultatet er en live-stilling (en annen kamp ble nettopp ferdig og trigget
  // aggregering); da venter vi til full tid. Eldre/manuelt satte kamper uten
  // ferdig-felt regnes som endelige så lenge de har et resultat.
  for (const t of tips) {
    const rad = rader.get(t.uid);
    if (!rad) continue;
    const kamp = kampMap.get(t.matchId);
    if (!kamp || !kamp.resultat) continue;
    if (kamp.ferdig === false) continue;
    const bonus = kamp.bonusFaktor || 1;
    const p = beregnPoeng(t, kamp.resultat, bonus);
    rad.kampPoeng += p;
    if (p >= 3 * bonus) rad.eksakte += 1;
    else if (p >= 1 * bonus) rad.utfall += 1;
    else rad.feil += 1;
  }

  // Spesial-poeng (samme fire bets som i appen)
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
    if (
      fasit.ronaldoVsMessi &&
      s.ronaldoVsMessi &&
      s.ronaldoVsMessi === fasit.ronaldoVsMessi
    )
      rad.spesialPoeng += POENG.ronaldoVsMessi;
  }

  const liste = Array.from(rader.values())
    .map((r) => ({ ...r, poeng: r.kampPoeng + r.spesialPoeng }))
    .sort((a, b) => b.poeng - a.poeng);

  await db
    .collection("aggregert")
    .doc("ledertavle")
    .set({
      oppdatert: Date.now(),
      kamperSpilt: Array.from(kampMap.values()).filter(
        (k) => k.resultat && k.ferdig !== false,
      ).length,
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
