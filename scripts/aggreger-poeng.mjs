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
  const [
    brukereSnap,
    kamperSnap,
    tipsSnap,
    spesialSnap,
    fasitSnap,
    forrigeSnap,
  ] = await Promise.all([
    db.collection("brukere").get(),
    db.collection("kamper").get(),
    db.collection("tips").get(),
    db.collection("spesialtips").get(),
    db.collection("fasit").doc("vm").get(),
    db.collection("aggregert").doc("ledertavle").get(),
  ]);

  // Forrige plassering per bruker → brukes til ▲▼-bevegelse på ledertavla.
  const forrigePlassMap = new Map();
  if (forrigeSnap.exists) {
    for (const r of forrigeSnap.data().rader || []) {
      if (typeof r.plass === "number") forrigePlassMap.set(r.uid, r.plass);
    }
  }

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

  // Ferdigspilte kamper i kronologisk rekkefølge (for streak + rundeoppsummering).
  const ferdige = Array.from(kampMap.entries())
    .map(([id, k]) => ({ id, ...k }))
    .filter((k) => k.resultat && k.ferdig !== false)
    .sort((a, b) => a.starttid - b.starttid);

  // Tips gruppert per kamp (gjenbrukes til streak og rundeoppsummering).
  const tipsPerKamp = new Map();
  for (const t of tips) {
    const arr = tipsPerKamp.get(t.matchId) || [];
    arr.push(t);
    tipsPerKamp.set(t.matchId, arr);
  }
  const tipFor = (uid, matchId) =>
    (tipsPerKamp.get(matchId) || []).find((t) => t.uid === uid) || null;

  // Streak = antall siste ferdige kamper på rad der brukeren traff eksakt.
  function beregnStreak(uid) {
    let s = 0;
    for (let i = ferdige.length - 1; i >= 0; i--) {
      const k = ferdige[i];
      const t = tipFor(uid, k.id);
      const bonus = k.bonusFaktor || 1;
      if (t && beregnPoeng(t, k.resultat, bonus) >= 3 * bonus) s += 1;
      else break;
    }
    return s;
  }

  // Form = de siste (opptil 5) tippede ferdige kampene, eldst → nyest.
  // "E" = eksakt, "U" = riktig utfall, "B" = bom.
  function beregnForm(uid) {
    const ut = [];
    for (let i = ferdige.length - 1; i >= 0 && ut.length < 5; i--) {
      const k = ferdige[i];
      const t = tipFor(uid, k.id);
      if (!t) continue;
      const bonus = k.bonusFaktor || 1;
      const p = beregnPoeng(t, k.resultat, bonus);
      ut.push(p >= 3 * bonus ? "E" : p >= 1 * bonus ? "U" : "B");
    }
    return ut.reverse();
  }

  const liste = Array.from(rader.values())
    .map((r) => ({ ...r, poeng: r.kampPoeng + r.spesialPoeng }))
    .sort((a, b) => b.poeng - a.poeng);

  // Delt plassering (19,16,16,13 → 1,2,2,4) + bevegelse + streak.
  let forrigePoeng = null;
  let forrigePlass = 0;
  liste.forEach((r, i) => {
    if (forrigePoeng === null || r.poeng !== forrigePoeng) {
      r.plass = i + 1;
      forrigePlass = i + 1;
      forrigePoeng = r.poeng;
    } else {
      r.plass = forrigePlass;
    }
    r.forrigePlass = forrigePlassMap.has(r.uid)
      ? forrigePlassMap.get(r.uid)
      : null;
    r.streak = beregnStreak(r.uid);
    r.form = beregnForm(r.uid);
  });

  // Rundeoppsummering: siste ferdigspilte kamp-DAG (Oslo-tid).
  const datoKey = (ms) =>
    new Date(ms).toLocaleDateString("sv-SE", { timeZone: "Europe/Oslo" });
  const datoTekst = (ms) =>
    new Date(ms).toLocaleDateString("nb-NO", {
      timeZone: "Europe/Oslo",
      day: "numeric",
      month: "long",
    });

  let sisteRunde = null;
  if (ferdige.length) {
    const sisteKey = ferdige.reduce((mx, k) => {
      const key = datoKey(k.starttid);
      return key > mx ? key : mx;
    }, "");
    const dagensKamper = ferdige.filter((k) => datoKey(k.starttid) === sisteKey);

    // Poeng og bom per bruker for dagens kamper.
    const dag = new Map();
    for (const k of dagensKamper) {
      const bonus = k.bonusFaktor || 1;
      for (const t of tipsPerKamp.get(k.id) || []) {
        const rad = rader.get(t.uid);
        if (!rad) continue;
        const p = beregnPoeng(t, k.resultat, bonus);
        const cur = dag.get(t.uid) || { navn: rad.navn, poeng: 0, bom: 0 };
        cur.poeng += p;
        if (p === 0) cur.bom += 1;
        dag.set(t.uid, cur);
      }
    }
    const dagListe = Array.from(dag.values());
    const beste = dagListe.length
      ? dagListe.reduce((a, b) => (b.poeng > a.poeng ? b : a))
      : null;
    const bom = dagListe.length
      ? dagListe.reduce((a, b) => (b.bom > a.bom ? b : a))
      : null;

    // Kveldens klatrer: størst positiv plass-bevegelse.
    let klatrer = null;
    for (const r of liste) {
      if (r.forrigePlass == null) continue;
      const diff = r.forrigePlass - r.plass;
      if (diff > 0 && (!klatrer || diff > klatrer.plasser))
        klatrer = { navn: r.navn, plasser: diff };
    }

    sisteRunde = {
      dato: datoTekst(dagensKamper[0].starttid),
      antallKamper: dagensKamper.length,
      beste: beste && beste.poeng > 0 ? { navn: beste.navn, poeng: beste.poeng } : null,
      klatrer,
      bom: bom && bom.bom > 0 ? { navn: bom.navn, antall: bom.bom } : null,
    };
  }

  // Historikk: kumulative kamp-poeng per kamp-dag, slik at utviklingsgrafen
  // kan lese ETT dokument i stedet for alle tips (gratis-kvote).
  const punkter = [];
  for (const k of ferdige) {
    const key = datoKey(k.starttid);
    const siste = punkter[punkter.length - 1];
    if (!siste || siste.key !== key)
      punkter.push({ key, label: datoTekst(k.starttid), kamper: [k] });
    else siste.kamper.push(k);
  }
  const løpende = new Map();
  const historikkPoeng = {};
  for (const b of brukere) {
    løpende.set(b.uid, 0);
    historikkPoeng[b.uid] = [];
  }
  for (const p of punkter) {
    for (const k of p.kamper) {
      const bonus = k.bonusFaktor || 1;
      for (const t of tipsPerKamp.get(k.id) || []) {
        if (!løpende.has(t.uid)) continue;
        løpende.set(t.uid, løpende.get(t.uid) + beregnPoeng(t, k.resultat, bonus));
      }
    }
    for (const b of brukere) historikkPoeng[b.uid].push(løpende.get(b.uid));
  }
  const historikk = {
    punkter: punkter.map((p) => ({ key: p.key, label: p.label })),
    poeng: historikkPoeng,
  };

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
      sisteRunde,
      historikk,
    });

  console.log(
    `\n✓ Skrev aggregert/ledertavle med ${liste.length} rader. Topp 3:`,
  );
  liste.slice(0, 3).forEach((r, i) =>
    console.log(`  ${i + 1}. ${r.navn} — ${r.poeng}p`),
  );
}

await aggreger();
