// Klient-side resultat-synk for admin-knappen "Synk nå". Henter resultater fra
// TheSportsDB (CORS er åpent), skriver til kamper, og bygger ledertavla på nytt
// — alt fra nettleseren med admins skrivetilgang. Speiler logikken i
// scripts/sync-resultater.mjs + scripts/aggreger-poeng.mjs.

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { fbDb, isFirebaseConfigured } from "./firebase";
import { localKamper } from "./local-store";
import { tilNorsk } from "./lag-mapping";
import { POENG } from "./vm-data";
import {
  beregnPoeng,
  type Bruker,
  type Fasit,
  type Match,
  type Prediction,
  type SpesialTip,
} from "./types";

const SPORTSDB = "https://www.thesportsdb.com/api/v1/json/3";
const LIGA = "4429";
const TRE_TIMER = 3 * 60 * 60 * 1000;

const FERDIG_STATUS = new Set([
  "MATCH FINISHED", "FINISHED", "FT", "FULL TIME", "AET", "AP", "PEN",
  "AFTER EXTRA TIME", "PENALTIES",
]);
const IKKE_FERDIG_STATUS = new Set([
  "NS", "NOT STARTED", "1H", "2H", "HT", "HALF TIME", "FIRST HALF",
  "SECOND HALF", "ET", "EXTRA TIME", "BT", "BREAK TIME", "P", "LIVE",
  "IN PLAY", "SUSP", "SUSPENDED", "POSTPONED", "PST", "ABANDONED",
  "ABD", "CANCELLED", "TBD",
]);
const KNOCKOUT_RUNDE: Record<number, string> = {
  4: "32-delsfinale", 5: "16-delsfinale", 6: "Kvartfinale",
  7: "Semifinale", 8: "Bronsefinale", 9: "Finale",
};

function erFerdig(status: string, starttid: number, harResultat: boolean) {
  const s = status ? String(status).trim().toUpperCase() : "";
  if (FERDIG_STATUS.has(s)) return true;
  if (IKKE_FERDIG_STATUS.has(s)) return false;
  if (harResultat && starttid && Date.now() - starttid > TRE_TIMER) return true;
  return false;
}

type Skår = { hjemme: number; borte: number };

function finnGruppeKamp(kamper: Match[], h: string, b: string, tid: number) {
  const treff = kamper
    .filter(
      (k) =>
        k.runde?.startsWith("Gruppe") &&
        ((k.hjemmelag === h && k.bortelag === b) ||
          (k.hjemmelag === b && k.bortelag === h)),
    )
    .map((k) => ({ kamp: k, flippet: k.hjemmelag !== h }));
  if (treff.length === 0) return null;
  if (treff.length === 1) return treff[0];
  treff.sort(
    (a, b2) =>
      Math.abs(a.kamp.starttid - tid) - Math.abs(b2.kamp.starttid - tid),
  );
  return treff[0];
}

export async function synkResultaterKlient(): Promise<{
  oppdatert: number;
  ferdige: number;
}> {
  const res = await fetch(`${SPORTSDB}/eventsseason.php?id=${LIGA}&s=2026`);
  if (!res.ok) throw new Error(`TheSportsDB svarte ${res.status}`);
  const data = await res.json();
  const events: Record<string, string>[] = data.events || [];

  const fb = isFirebaseConfigured();
  let kamper: Match[];
  if (fb) {
    const snap = await getDocs(collection(fbDb(), "kamper"));
    kamper = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Match);
  } else {
    kamper = [...localKamper.get()];
  }
  const kampById = new Map(kamper.map((k) => [k.id, k]));

  let oppdatert = 0;
  let ferdige = 0;
  // For demo: samle endringer og skriv localKamper én gang til slutt.
  const endret = new Map<string, Match>();
  const skriv = async (id: string, upd: Partial<Match>) => {
    if (fb) {
      await updateDoc(doc(fbDb(), "kamper", id), upd);
    } else {
      const k = endret.get(id) || kampById.get(id)!;
      endret.set(id, { ...k, ...upd });
    }
  };
  const opprett = async (k: Match) => {
    if (fb) {
      const { id, ...rest } = k;
      await setDoc(doc(fbDb(), "kamper", id), rest);
    } else {
      endret.set(k.id, k);
      kampById.set(k.id, k);
      kamper.push(k);
    }
  };

  for (const e of events) {
    const h = tilNorsk(e.strHomeTeam);
    const b = tilNorsk(e.strAwayTeam);
    if (!h || !b) continue;
    const tid = new Date(e.strTimestamp + "Z").getTime();
    const resultat: Skår | null =
      e.intHomeScore != null && e.intAwayScore != null
        ? { hjemme: Number(e.intHomeScore), borte: Number(e.intAwayScore) }
        : null;
    const ferdig = erFerdig(e.strStatus, tid, resultat != null);
    const intRound = Number(e.intRound) || 0;

    if (intRound < 4) {
      const treff = finnGruppeKamp(kamper, h, b, tid);
      if (!treff || !resultat) continue;
      const skår = treff.flippet
        ? { hjemme: resultat.borte, borte: resultat.hjemme }
        : resultat;
      const eks = (endret.get(treff.kamp.id) || treff.kamp).resultat;
      const resultatLikt =
        eks && eks.hjemme === skår.hjemme && eks.borte === skår.borte;
      const ferdigLikt =
        ((endret.get(treff.kamp.id) || treff.kamp).ferdig ?? null) === ferdig;
      if (resultatLikt && ferdigLikt) continue;
      const upd: Partial<Match> = { ferdig };
      if (!resultatLikt) upd.resultat = skår;
      await skriv(treff.kamp.id, upd);
      oppdatert++;
      if (ferdig) ferdige++;
    } else {
      const id = `kn-${e.idEvent}`;
      const eks = kampById.get(id);
      const runde = KNOCKOUT_RUNDE[intRound] || `Runde ${intRound}`;
      if (!eks) {
        await opprett({
          id,
          hjemmelag: h,
          bortelag: b,
          starttid: tid,
          runde,
          bonusFaktor: h === "Norge" || b === "Norge" ? 2 : 1,
          resultat,
          ferdig,
        });
        oppdatert++;
        if (resultat && ferdig) ferdige++;
      } else {
        const upd: Partial<Match> = {};
        if (eks.hjemmelag !== h || eks.bortelag !== b) {
          upd.hjemmelag = h;
          upd.bortelag = b;
        }
        if (eks.starttid !== tid) upd.starttid = tid;
        const resEndret =
          resultat &&
          (!eks.resultat ||
            eks.resultat.hjemme !== resultat.hjemme ||
            eks.resultat.borte !== resultat.borte);
        if (resEndret) upd.resultat = resultat;
        if (resultat && (eks.ferdig ?? null) !== ferdig) upd.ferdig = ferdig;
        if (Object.keys(upd).length > 0) {
          await skriv(id, upd);
          oppdatert++;
          if ((resEndret || upd.ferdig != null) && ferdig) ferdige++;
        }
      }
    }
  }

  if (!fb && endret.size > 0) {
    const oppdaterte = kamper.map((k) => endret.get(k.id) || k);
    localKamper.set(oppdaterte);
  }

  // I produksjon: bygg ledertavla på nytt. I demo regner ledertavla live, så
  // det trengs ikke.
  if (fb) await aggregerKlient();

  return { oppdatert, ferdige };
}

export async function aggregerKlient() {
  // Kun i produksjon — i demo regner ledertavla live fra localStorage.
  if (!isFirebaseConfigured()) return;
  const db = fbDb();
  const [brukereSnap, kamperSnap, tipsSnap, spesialSnap, fasitSnap] =
    await Promise.all([
      getDocs(collection(db, "brukere")),
      getDocs(collection(db, "kamper")),
      getDocs(collection(db, "tips")),
      getDocs(collection(db, "spesialtips")),
      getDoc(doc(db, "fasit", "vm")),
    ]);
  const brukere = brukereSnap.docs.map((d) => d.data() as Bruker);
  const kampMap = new Map(
    kamperSnap.docs.map((d) => [d.id, d.data() as Match]),
  );
  const tips = tipsSnap.docs.map((d) => d.data() as Prediction);
  const spesial = spesialSnap.docs.map((d) => d.data() as SpesialTip);
  const fasit = (fasitSnap.exists() ? fasitSnap.data() : {}) as Fasit;

  const rader = new Map<string, Record<string, unknown>>();
  for (const bk of brukere) {
    rader.set(bk.uid, {
      uid: bk.uid,
      navn: bk.navn,
      avdeling: bk.avdeling || "",
      klubbRolle: bk.klubbRolle || null,
      poeng: 0,
      kampPoeng: 0,
      spesialPoeng: 0,
      eksakte: 0,
      utfall: 0,
      feil: 0,
    });
  }
  for (const t of tips) {
    const rad = rader.get(t.uid) as Record<string, number> | undefined;
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
  const norm = (s: string) => s.trim().toLowerCase();
  for (const s of spesial) {
    const rad = rader.get(s.uid) as Record<string, number> | undefined;
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
  const liste = Array.from(rader.values())
    .map((r) => ({
      ...r,
      poeng: (r.kampPoeng as number) + (r.spesialPoeng as number),
    }))
    .sort((a, b) => (b.poeng as number) - (a.poeng as number));

  await setDoc(doc(db, "aggregert", "ledertavle"), {
    oppdatert: Date.now(),
    kamperSpilt: Array.from(kampMap.values()).filter(
      (k) => k.resultat && k.ferdig !== false,
    ).length,
    kamperTotalt: kampMap.size,
    rader: liste,
  });
}
