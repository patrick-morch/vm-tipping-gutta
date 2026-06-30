// Klient-side resultat-synk for admin-knappen "Synk nå". Henter resultater,
// skriver til kamper, og bygger ledertavla på nytt — alt fra nettleseren med
// admins skrivetilgang. Speiler logikken i scripts/sync-resultater.mjs +
// scripts/aggreger-poeng.mjs.
//
// Datakilde: football-data.org (alle 104 VM-kamper + ekte resultater) som
// primær, TheSportsDB som fallback. NB: football-data tillater bare CORS fra
// http://localhost — så fra produksjon (web.app) blokkeres kallet og vi faller
// tilbake til TheSportsDB. Full kraft når admin kjører appen lokalt; i prod
// gjør GitHub-synken hver time uansett den riktige jobben.

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
const FOOTBALL_DATA = "https://api.football-data.org/v4";
// Settes i .env.local (gitignored). Mangler den → kun TheSportsDB-fallback.
const FD_TOKEN = process.env.NEXT_PUBLIC_FOOTBALL_DATA_TOKEN;
const TRE_TIMER = 3 * 60 * 60 * 1000;

// football-data "stage" → samme tall-runde som TheSportsDB intRound.
const FD_STAGE_TIL_ROUND: Record<string, number> = {
  GROUP_STAGE: 1,
  LAST_32: 4,
  LAST_16: 5,
  QUARTER_FINALS: 6,
  SEMI_FINALS: 7,
  THIRD_PLACE: 8,
  FINAL: 9,
};
const FD_STATUS_TIL_SPORTSDB: Record<string, string> = {
  FINISHED: "FINISHED",
  AWARDED: "FINISHED",
  IN_PLAY: "IN PLAY",
  PAUSED: "HT",
  SCHEDULED: "NS",
  TIMED: "NS",
  SUSPENDED: "SUSPENDED",
  POSTPONED: "POSTPONED",
  CANCELLED: "CANCELLED",
};

type Event = Record<string, string>;

// Normaliserer football-data-kamper til samme felt-form som TheSportsDB-events,
// så resten av løkka kan brukes uendret.
function fraFootballData(matches: Record<string, unknown>[]): Event[] {
  return matches.map((m) => {
    const sc = m.score as
      | { fullTime?: { home?: number; away?: number }; duration?: string }
      | undefined;
    const score = sc?.fullTime;
    const home = m.homeTeam as { name?: string } | undefined;
    const away = m.awayTeam as { name?: string } | undefined;
    return {
      idEvent: String(m.id ?? ""),
      strHomeTeam: home?.name ?? "",
      strAwayTeam: away?.name ?? "",
      intHomeScore: score?.home != null ? String(score.home) : "",
      intAwayScore: score?.away != null ? String(score.away) : "",
      strStatus:
        FD_STATUS_TIL_SPORTSDB[m.status as string] || (m.status as string) || "",
      // erFerdig/Date bruker strTimestamp + "Z", så strip trailing Z.
      strTimestamp: String(m.utcDate ?? "").replace(/Z$/, ""),
      intRound: String(FD_STAGE_TIL_ROUND[m.stage as string] ?? 1),
      // "REGULAR" / "EXTRA_TIME" / "PENALTY_SHOOTOUT" — vi better kun på 90 min.
      duration: sc?.duration ?? "",
    };
  });
}

// Henter events fra football-data hvis token finnes og CORS slipper gjennom
// (localhost), ellers TheSportsDB. Kaster aldri — faller alltid tilbake.
async function hentEvents(): Promise<Event[]> {
  if (FD_TOKEN) {
    try {
      const r = await fetch(`${FOOTBALL_DATA}/competitions/WC/matches`, {
        headers: { "X-Auth-Token": FD_TOKEN },
      });
      if (r.ok) {
        const d = await r.json();
        return fraFootballData(d.matches || []);
      }
    } catch {
      // CORS-blokkert (prod) e.l. → fall tilbake til TheSportsDB under.
    }
  }
  const res = await fetch(`${SPORTSDB}/eventsseason.php?id=${LIGA}&s=2026`);
  if (!res.ok) throw new Error(`TheSportsDB svarte ${res.status}`);
  const data = await res.json();
  return data.events || [];
}

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
  const events = await hentEvents();

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
    // Hopp over placeholder-knockout uten lag ennå (tomme lagnavn).
    if (!e.strHomeTeam?.trim() || !e.strAwayTeam?.trim()) continue;
    const h = tilNorsk(e.strHomeTeam);
    const b = tilNorsk(e.strAwayTeam);
    if (!h || !b) continue;
    const tid = new Date(e.strTimestamp + "Z").getTime();
    // Tom streng (football-data uten score) OG null (TheSportsDB) = ingen score.
    const harScore =
      e.intHomeScore != null &&
      e.intHomeScore !== "" &&
      e.intAwayScore != null &&
      e.intAwayScore !== "";
    const resultat: Skår | null = harScore
      ? { hjemme: Number(e.intHomeScore), borte: Number(e.intAwayScore) }
      : null;
    const ferdig = erFerdig(e.strStatus, tid, resultat != null);
    const intRound = Number(e.intRound) || 0;

    if (intRound < 4) {
      const treff = finnGruppeKamp(kamper, h, b, tid);
      if (!treff || !resultat) continue;
      // Manuelt satt resultat er låst — ikke overskriv.
      if ((endret.get(treff.kamp.id) || treff.kamp).manuelt) continue;
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
      // Vi better kun på 90-min-stillingen. Gikk cup-kampen til ekstraomganger/
      // straffer gir kilden bare stillingen etter ET, så da skriver vi IKKE
      // resultatet — 90-min-stillingen legges inn manuelt og blir stående.
      // Et manuelt satt resultat (eks.manuelt) er alltid låst, uavhengig av
      // duration — TheSportsDB-fallback mangler duration og ville ellers
      // overskrevet inntastingen. Lag/tid synkes fortsatt.
      const skrivResultat =
        e.duration !== "EXTRA_TIME" &&
        e.duration !== "PENALTY_SHOOTOUT" &&
        !(eks && eks.manuelt);
      if (!eks) {
        await opprett({
          id,
          hjemmelag: h,
          bortelag: b,
          starttid: tid,
          runde,
          bonusFaktor: h === "Norge" || b === "Norge" ? 2 : 1,
          resultat: skrivResultat ? resultat : null,
          ferdig: skrivResultat ? ferdig : false,
        });
        oppdatert++;
        if (skrivResultat && resultat && ferdig) ferdige++;
      } else {
        const upd: Partial<Match> = {};
        if (eks.hjemmelag !== h || eks.bortelag !== b) {
          upd.hjemmelag = h;
          upd.bortelag = b;
        }
        if (eks.starttid !== tid) upd.starttid = tid;
        const resEndret =
          skrivResultat &&
          resultat &&
          (!eks.resultat ||
            eks.resultat.hjemme !== resultat.hjemme ||
            eks.resultat.borte !== resultat.borte);
        if (resEndret) upd.resultat = resultat;
        if (skrivResultat && resultat && (eks.ferdig ?? null) !== ferdig)
          upd.ferdig = ferdig;
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
  const [brukereSnap, kamperSnap, tipsSnap, spesialSnap, fasitSnap, forrigeSnap] =
    await Promise.all([
      getDocs(collection(db, "brukere")),
      getDocs(collection(db, "kamper")),
      getDocs(collection(db, "tips")),
      getDocs(collection(db, "spesialtips")),
      getDoc(doc(db, "fasit", "vm")),
      getDoc(doc(db, "aggregert", "ledertavle")),
    ]);
  const brukere = brukereSnap.docs.map((d) => d.data() as Bruker);
  const kampMap = new Map(
    kamperSnap.docs.map((d) => [d.id, d.data() as Match]),
  );
  const tips = tipsSnap.docs.map((d) => d.data() as Prediction);
  const spesial = spesialSnap.docs.map((d) => d.data() as SpesialTip);
  const fasit = (fasitSnap.exists() ? fasitSnap.data() : {}) as Fasit;

  // Forrige plassering per bruker → ▲▼-bevegelse på ledertavla.
  const forrigePlassMap = new Map<string, number>();
  if (forrigeSnap.exists()) {
    for (const r of (forrigeSnap.data()?.rader || []) as Array<
      Record<string, unknown>
    >) {
      if (typeof r.plass === "number")
        forrigePlassMap.set(r.uid as string, r.plass);
    }
  }

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
  // Ferdigspilte kamper kronologisk (for streak, form, runde og historikk).
  const ferdige = Array.from(kampMap.entries())
    .map(([id, k]) => ({ ...k, id }))
    .filter((k) => k.resultat && k.ferdig !== false)
    .sort((a, b) => a.starttid - b.starttid);

  // Tips gruppert per kamp (gjenbrukes flere steder).
  const tipsPerKamp = new Map<string, Prediction[]>();
  for (const t of tips) {
    const arr = tipsPerKamp.get(t.matchId) || [];
    arr.push(t);
    tipsPerKamp.set(t.matchId, arr);
  }
  const tipFor = (uid: string, matchId: string) =>
    (tipsPerKamp.get(matchId) || []).find((t) => t.uid === uid) || null;

  // Streak = antall siste ferdige kamper på rad med eksakt treff.
  function beregnStreak(uid: string): number {
    let s = 0;
    for (let i = ferdige.length - 1; i >= 0; i--) {
      const k = ferdige[i];
      const t = tipFor(uid, k.id);
      const bonus = k.bonusFaktor || 1;
      if (t && k.resultat && beregnPoeng(t, k.resultat, bonus) >= 3 * bonus)
        s += 1;
      else break;
    }
    return s;
  }

  // Form = de siste (opptil 5) tippede ferdige kampene, eldst → nyest.
  function beregnForm(uid: string): string[] {
    const ut: string[] = [];
    for (let i = ferdige.length - 1; i >= 0 && ut.length < 5; i--) {
      const k = ferdige[i];
      const t = tipFor(uid, k.id);
      if (!t || !k.resultat) continue;
      const bonus = k.bonusFaktor || 1;
      const p = beregnPoeng(t, k.resultat, bonus);
      ut.push(p >= 3 * bonus ? "E" : p >= 1 * bonus ? "U" : "B");
    }
    return ut.reverse();
  }

  const liste = Array.from(rader.values())
    .map(
      (r): Record<string, unknown> => ({
        ...r,
        poeng: (r.kampPoeng as number) + (r.spesialPoeng as number),
      }),
    )
    .sort((a, b) => (b.poeng as number) - (a.poeng as number));

  // Delt plassering (19,16,16,13 → 1,2,2,4) + bevegelse + streak + form.
  let forrigePoeng: number | null = null;
  let forrigePlassNr = 0;
  liste.forEach((r, i) => {
    const poeng = r.poeng as number;
    if (forrigePoeng === null || poeng !== forrigePoeng) {
      r.plass = i + 1;
      forrigePlassNr = i + 1;
      forrigePoeng = poeng;
    } else {
      r.plass = forrigePlassNr;
    }
    const uid = r.uid as string;
    r.forrigePlass = forrigePlassMap.has(uid)
      ? forrigePlassMap.get(uid)
      : null;
    r.streak = beregnStreak(uid);
    r.form = beregnForm(uid);
  });

  // Rundeoppsummering: siste ferdigspilte kamp-DAG (Oslo-tid).
  const datoKey = (ms: number) =>
    new Date(ms).toLocaleDateString("sv-SE", { timeZone: "Europe/Oslo" });
  const datoTekst = (ms: number) =>
    new Date(ms).toLocaleDateString("nb-NO", {
      timeZone: "Europe/Oslo",
      day: "numeric",
      month: "long",
    });

  let sisteRunde: Record<string, unknown> | null = null;
  if (ferdige.length) {
    const sisteKey = ferdige.reduce((mx, k) => {
      const key = datoKey(k.starttid);
      return key > mx ? key : mx;
    }, "");
    const dagensKamper = ferdige.filter((k) => datoKey(k.starttid) === sisteKey);

    const dag = new Map<
      string,
      { navn: string; poeng: number; bom: number }
    >();
    for (const k of dagensKamper) {
      const bonus = k.bonusFaktor || 1;
      for (const t of tipsPerKamp.get(k.id) || []) {
        const rad = rader.get(t.uid);
        if (!rad || !k.resultat) continue;
        const p = beregnPoeng(t, k.resultat, bonus);
        const cur = dag.get(t.uid) || {
          navn: rad.navn as string,
          poeng: 0,
          bom: 0,
        };
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

    let klatrer: { navn: string; plasser: number } | null = null;
    for (const r of liste) {
      const fp = r.forrigePlass as number | null;
      if (fp == null) continue;
      const diff = fp - (r.plass as number);
      if (diff > 0 && (!klatrer || diff > klatrer.plasser))
        klatrer = { navn: r.navn as string, plasser: diff };
    }

    sisteRunde = {
      dato: datoTekst(dagensKamper[0].starttid),
      antallKamper: dagensKamper.length,
      beste:
        beste && beste.poeng > 0
          ? { navn: beste.navn, poeng: beste.poeng }
          : null,
      klatrer,
      bom: bom && bom.bom > 0 ? { navn: bom.navn, antall: bom.bom } : null,
    };
  }

  // Historikk: kumulative kamp-poeng per kamp-dag (utviklingsgrafen leser
  // dette ene dokumentet i stedet for alle tips).
  const punkter: { key: string; label: string; kamper: typeof ferdige }[] = [];
  for (const k of ferdige) {
    const key = datoKey(k.starttid);
    const siste = punkter[punkter.length - 1];
    if (!siste || siste.key !== key)
      punkter.push({ key, label: datoTekst(k.starttid), kamper: [k] });
    else siste.kamper.push(k);
  }
  const løpende = new Map<string, number>();
  const historikkPoeng: Record<string, number[]> = {};
  for (const b of brukere) {
    løpende.set(b.uid, 0);
    historikkPoeng[b.uid] = [];
  }
  for (const p of punkter) {
    for (const k of p.kamper) {
      const bonus = k.bonusFaktor || 1;
      for (const t of tipsPerKamp.get(k.id) || []) {
        if (!løpende.has(t.uid) || !k.resultat) continue;
        løpende.set(
          t.uid,
          (løpende.get(t.uid) || 0) + beregnPoeng(t, k.resultat, bonus),
        );
      }
    }
    for (const b of brukere) historikkPoeng[b.uid].push(løpende.get(b.uid) || 0);
  }
  const historikk = {
    punkter: punkter.map((p) => ({ key: p.key, label: p.label })),
    poeng: historikkPoeng,
  };

  await setDoc(doc(db, "aggregert", "ledertavle"), {
    oppdatert: Date.now(),
    kamperSpilt: Array.from(kampMap.values()).filter(
      (k) => k.resultat && k.ferdig !== false,
    ).length,
    kamperTotalt: kampMap.size,
    rader: liste,
    sisteRunde,
    historikk,
  });
}
