// Henter siste VM-resultater fra TheSportsDB og oppdaterer Firestore.
//
// Strategi:
// 1) Gruppespill: våre 72 kamper er forhåndsseedet (A1..L6). Matcher events
//    på lag-par og oppdaterer resultat.
// 2) Knockout: TheSportsDB legger inn matchups så fort FIFA bestemmer dem
//    etter gruppespillet. Vi oppretter nye kamper med id 'kn-<idEvent>' og
//    riktig runde-navn. Resultater fylles inn i samme sync.

import { appendFileSync } from "node:fs";
import admin from "firebase-admin";
import { tilNorsk } from "./lib/lag-mapping.mjs";

const SPORTSDB_BASE = "https://www.thesportsdb.com/api/v1/json/3";
const LIGA_ID = "4429"; // FIFA World Cup

// Primærkilde: football-data.org (gratis nøkkel dekker VM). Har komplett
// kampliste + ekte resultater, i motsetning til TheSportsDB-gratis som bare
// har et fåtall kamper. Settes via FOOTBALL_DATA_TOKEN; mangler den faller vi
// tilbake på TheSportsDB.
const FOOTBALL_DATA_BASE = "https://api.football-data.org/v4";

// football-data sin "stage" → samme tall-runde som TheSportsDB sin intRound,
// slik at resten av løkka (knockout = round >= 4 + KNOCKOUT_RUNDE) funker likt.
const FD_STAGE_TIL_ROUND = {
  GROUP_STAGE: 1,
  LAST_32: 4,
  LAST_16: 5,
  QUARTER_FINALS: 6,
  SEMI_FINALS: 7,
  THIRD_PLACE: 8,
  FINAL: 9,
};

// football-data sin status → TheSportsDB-status som FERDIG_STATUS/IKKE_FERDIG
// allerede forstår.
const FD_STATUS_TIL_SPORTSDB = {
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

const TRE_TIMER_MS = 3 * 60 * 60 * 1000;

// Statuser fra TheSportsDB som betyr at kampen er ferdigspilt. Poeng skal
// først aggregeres ved full tid (ikke på live-score), så ledertavlen settes
// når resultatet er endelig. Live-scoren skrives uansett til kamp-kortene.
const FERDIG_STATUS = new Set([
  "MATCH FINISHED",
  "FINISHED",
  "FT",
  "FULL TIME",
  "AET",
  "AP",
  "PEN",
  "AFTER EXTRA TIME",
  "PENALTIES",
]);

// Statuser som eksplisitt betyr at kampen IKKE er ferdig (pågår, pause, utsatt).
const IKKE_FERDIG_STATUS = new Set([
  "NS", "NOT STARTED", "1H", "2H", "HT", "HALF TIME", "FIRST HALF",
  "SECOND HALF", "ET", "EXTRA TIME", "BT", "BREAK TIME", "P", "LIVE",
  "IN PLAY", "SUSP", "SUSPENDED", "POSTPONED", "PST", "ABANDONED",
  "ABD", "CANCELLED", "TBD",
]);

// Avgjør om en kamp er ferdigspilt. Primært via statusstrengen; hvis den er
// blank eller ukjent faller vi tilbake på tid: et resultat finnes OG det er
// gått > 3 t siden avspark (dekker 90' + ekstraomganger + straffer). Hindrer
// at en uventet statusstreng fra TheSportsDB fryser poengene for godt.
function erFerdig(status, starttid, harResultat) {
  const s = status ? String(status).trim().toUpperCase() : "";
  if (FERDIG_STATUS.has(s)) return true;
  if (IKKE_FERDIG_STATUS.has(s)) return false;
  if (harResultat && starttid && Date.now() - starttid > TRE_TIMER_MS)
    return true;
  return false;
}

// TheSportsDB-runder → norske rundenavn. Gruppespill (1-3) håndteres
// av eksisterende A1..L6, så bare knockout-runder mappes her.
// intRound for 32-team knockout-format (gjetning — justeres når data dukker opp):
//   4 = 32-delsfinale, 5 = 16-delsfinale, 6 = kvart, 7 = semi,
//   8 = bronsefinale, 9 = finale
const KNOCKOUT_RUNDE = {
  4: "32-delsfinale",
  5: "16-delsfinale",
  6: "Kvartfinale",
  7: "Semifinale",
  8: "Bronsefinale",
  9: "Finale",
};

function init() {
  if (admin.apps.length) return;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT mangler i miljøet.");
  let json;
  try {
    json = JSON.parse(raw);
  } catch {
    json = JSON.parse(Buffer.from(raw, "base64").toString("utf-8"));
  }
  admin.initializeApp({ credential: admin.credential.cert(json) });
}

async function hentEventsTheSportsDB() {
  const url = `${SPORTSDB_BASE}/eventsseason.php?id=${LIGA_ID}&s=2026`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`TheSportsDB svarte ${r.status}`);
  const data = await r.json();
  return data.events || [];
}

async function hentEventsFootballData(token) {
  const url = `${FOOTBALL_DATA_BASE}/competitions/WC/matches`;
  const r = await fetch(url, { headers: { "X-Auth-Token": token } });
  if (!r.ok) throw new Error(`football-data svarte ${r.status}`);
  const data = await r.json();
  const matches = data.matches || [];
  // Normaliser til samme felt-form som TheSportsDB-events, så tilNorske og
  // resten av løkka kan brukes uendret.
  return matches.map((m) => {
    const ft = m.score?.fullTime || {};
    return {
      idEvent: String(m.id),
      strHomeTeam: m.homeTeam?.name ?? "",
      strAwayTeam: m.awayTeam?.name ?? "",
      intHomeScore: ft.home ?? null,
      intAwayScore: ft.away ?? null,
      strStatus: FD_STATUS_TIL_SPORTSDB[m.status] || m.status || "",
      // tilNorske gjør new Date(strTimestamp + "Z"), så strip trailing Z her.
      strTimestamp: (m.utcDate || "").replace(/Z$/, ""),
      intRound: FD_STAGE_TIL_ROUND[m.stage] ?? 1,
    };
  });
}

// Henter events fra primærkilden (football-data hvis nøkkel finnes), med
// TheSportsDB som fallback hvis nøkkel mangler eller kallet feiler.
async function hentEvents() {
  const token = process.env.FOOTBALL_DATA_TOKEN;
  if (token) {
    try {
      const ev = await hentEventsFootballData(token);
      console.log(`Kilde: football-data.org — ${ev.length} kamper`);
      return ev;
    } catch (e) {
      console.log(
        `⚠ football-data feilet (${e.message}) — faller tilbake til TheSportsDB.`,
      );
    }
  }
  const ev = await hentEventsTheSportsDB();
  console.log(`Kilde: TheSportsDB — ${ev.length} events`);
  return ev;
}

function tilNorske(event) {
  const h = tilNorsk(event.strHomeTeam);
  const b = tilNorsk(event.strAwayTeam);
  if (!h || !b) return null;
  const tid = new Date(event.strTimestamp + "Z").getTime();
  const resultat =
    event.intHomeScore != null && event.intAwayScore != null
      ? {
          hjemme: Number(event.intHomeScore),
          borte: Number(event.intAwayScore),
        }
      : null;
  return {
    idEvent: event.idEvent,
    intRound: Number(event.intRound) || 0,
    hjemmelag: h,
    bortelag: b,
    starttid: tid,
    ferdig: erFerdig(event.strStatus, tid, resultat != null),
    resultat,
  };
}

function finnGruppeKampId(våreKamper, ekstern) {
  // Bare matche mot gruppekamper (A1..L6) på lag-par
  const treff = [];
  for (const [id, k] of Object.entries(våreKamper)) {
    if (!k.runde?.startsWith("Gruppe")) continue;
    const sammeLag =
      (k.hjemmelag === ekstern.hjemmelag &&
        k.bortelag === ekstern.bortelag) ||
      (k.hjemmelag === ekstern.bortelag &&
        k.bortelag === ekstern.hjemmelag);
    if (!sammeLag) continue;
    treff.push({ id, kamp: k, flippet: k.hjemmelag !== ekstern.hjemmelag });
  }
  if (treff.length === 0) return null;
  if (treff.length === 1) return treff[0];
  treff.sort(
    (a, b) =>
      Math.abs(a.kamp.starttid - ekstern.starttid) -
      Math.abs(b.kamp.starttid - ekstern.starttid),
  );
  return treff[0];
}

async function syncResultater() {
  init();
  const db = admin.firestore();

  console.log("Henter VM-events…");
  const events = await hentEvents();

  const snap = await db.collection("kamper").get();
  const våreKamper = Object.fromEntries(
    snap.docs.map((d) => [d.id, d.data()]),
  );
  console.log(`Vi har ${Object.keys(våreKamper).length} kamper i Firestore`);
  if (Object.keys(våreKamper).length === 0) {
    console.log("Ingen kamper — kjør 'Seed VM-kamper' i admin først.");
    return { oppdatert: 0, opprettet: 0 };
  }

  let oppdatertResultat = 0;
  let opprettetKnockout = 0;
  // Antall kamper som ble ferdigspilt (endelig resultat) denne kjøringen.
  // Bare disse skal trigge poeng-aggregering.
  let ferdigeKamper = 0;

  for (const e of events) {
    // Hopp stille over placeholder-kamper uten lag ennå (football-data legger
    // inn alle knockout-slots på forhånd med tomme lagnavn — TBD).
    if (!e.strHomeTeam?.trim() || !e.strAwayTeam?.trim()) continue;

    const norsk = tilNorske(e);
    if (!norsk) {
      console.log(`  ? Ukjent lag: ${e.strHomeTeam} vs ${e.strAwayTeam}`);
      continue;
    }

    const erKnockout = norsk.intRound >= 4;

    if (!erKnockout) {
      // === Gruppespill: oppdater eksisterende kamp ===
      const treff = finnGruppeKampId(våreKamper, norsk);
      if (!treff) {
        console.log(
          `  ? Ingen gruppe-match: ${norsk.hjemmelag} vs ${norsk.bortelag}`,
        );
        continue;
      }
      if (!norsk.resultat) continue;

      const skriv = treff.flippet
        ? { hjemme: norsk.resultat.borte, borte: norsk.resultat.hjemme }
        : norsk.resultat;
      const eks = treff.kamp.resultat;
      const resultatLikt =
        eks && eks.hjemme === skriv.hjemme && eks.borte === skriv.borte;
      // ferdig-flagget kan ha endret seg selv om scoren er lik (live → full
      // tid med samme stilling). Da må vi fortsatt skrive og trigge aggregering.
      const ferdigLikt = (treff.kamp.ferdig ?? null) === norsk.ferdig;
      if (resultatLikt && ferdigLikt) continue;

      const upd = { ferdig: norsk.ferdig };
      if (!resultatLikt) upd.resultat = skriv;
      await db.collection("kamper").doc(treff.id).update(upd);
      console.log(
        `  ✓ ${treff.id}: ${treff.kamp.hjemmelag} ${skriv.hjemme}-${skriv.borte} ${treff.kamp.bortelag}${norsk.ferdig ? " (ferdig)" : " (live)"}`,
      );
      oppdatertResultat += 1;
      // Trigg aggregering når kampen nettopp ble ferdig (eller fikk korrigert
      // sluttresultat). Live-oppdateringer trigger ikke poeng.
      if (norsk.ferdig) ferdigeKamper += 1;
    } else {
      // === Knockout: opprett kamp hvis den ikke finnes, ellers oppdater ===
      const id = `kn-${norsk.idEvent}`;
      const runde = KNOCKOUT_RUNDE[norsk.intRound] || `Runde ${norsk.intRound}`;
      const eks = våreKamper[id];

      if (!eks) {
        await db.collection("kamper").doc(id).set({
          hjemmelag: norsk.hjemmelag,
          bortelag: norsk.bortelag,
          starttid: norsk.starttid,
          runde,
          bonusFaktor:
            norsk.hjemmelag === "Norge" || norsk.bortelag === "Norge" ? 2 : 1,
          resultat: norsk.resultat,
          ferdig: norsk.ferdig,
        });
        console.log(`  + ${id}: ${runde} ${norsk.hjemmelag} vs ${norsk.bortelag}`);
        opprettetKnockout += 1;
        if (norsk.resultat && norsk.ferdig) ferdigeKamper += 1;
      } else {
        // Oppdater hvis matchups eller resultat har endret seg
        const oppdateringer = {};
        if (
          eks.hjemmelag !== norsk.hjemmelag ||
          eks.bortelag !== norsk.bortelag
        ) {
          oppdateringer.hjemmelag = norsk.hjemmelag;
          oppdateringer.bortelag = norsk.bortelag;
        }
        if (eks.starttid !== norsk.starttid) {
          oppdateringer.starttid = norsk.starttid;
        }
        const resultatEndret =
          norsk.resultat &&
          (!eks.resultat ||
            eks.resultat.hjemme !== norsk.resultat.hjemme ||
            eks.resultat.borte !== norsk.resultat.borte);
        if (resultatEndret) {
          oppdateringer.resultat = norsk.resultat;
        }
        // Skriv ferdig-flagget når det endrer seg (også når scoren er lik).
        if (norsk.resultat && (eks.ferdig ?? null) !== norsk.ferdig) {
          oppdateringer.ferdig = norsk.ferdig;
        }
        if (Object.keys(oppdateringer).length > 0) {
          await db.collection("kamper").doc(id).update(oppdateringer);
          console.log(
            `  ✓ ${id}: oppdatert (${Object.keys(oppdateringer).join(", ")})`,
          );
          oppdatertResultat += 1;
          if (
            (oppdateringer.resultat || oppdateringer.ferdig != null) &&
            norsk.ferdig
          )
            ferdigeKamper += 1;
        }
      }
    }
  }

  // Etter alle oppdateringer: sjekk om finalen er ferdig og sett vmVinner
  // automatisk i fasit-dokumentet hvis ikke allerede satt.
  const vmVinnerSatt = await oppdaterVmVinner(db);

  // Aggreger poeng kun når noe endelig har skjedd (kamp ferdigspilt eller
  // VM-vinner satt) — ikke på hver live-score. Holder Firestore-reads nede.
  const børAggregere = ferdigeKamper > 0 || vmVinnerSatt;

  return {
    oppdatert: oppdatertResultat,
    opprettet: opprettetKnockout,
    ferdige: ferdigeKamper,
    børAggregere,
  };
}

async function oppdaterVmVinner(db) {
  const finalerSnap = await db
    .collection("kamper")
    .where("runde", "==", "Finale")
    .get();

  if (finalerSnap.empty) return false;

  // Det er normalt bare én Finale-kamp, men ta uansett en med resultat
  const finale = finalerSnap.docs
    .map((d) => d.data())
    .find((k) => k.resultat != null);

  if (!finale) return false;

  const { hjemme, borte } = finale.resultat;
  let vinner = null;
  if (hjemme > borte) vinner = finale.hjemmelag;
  else if (borte > hjemme) vinner = finale.bortelag;
  // Uavgjort i finale → vent på straffespark-resultat (vi har ikke
  // data om det, så lar fasit stå tom til admin oppdaterer manuelt)

  if (!vinner) {
    console.log(
      "  ! Finale uavgjort etter sluttspill — venter på straffespark-data",
    );
    return false;
  }

  const fasitRef = db.collection("fasit").doc("vm");
  const eks = await fasitRef.get();
  const nåværende = eks.exists ? eks.data() : {};

  if (nåværende.vmVinner === vinner) return false; // ingen endring

  await fasitRef.set({ ...nåværende, vmVinner: vinner }, { merge: true });
  console.log(`  ✓ Satt fasit.vmVinner = ${vinner}`);
  return true;
}

const r = await syncResultater();
console.log(
  `\n✓ Sync ferdig. Oppdaterte ${r.oppdatert} kamper (${r.ferdige} ferdigspilt), opprettet ${r.opprettet} knockout-kamper.`,
);

// Signal til GitHub Actions om poeng skal aggregeres (kun ved full tid /
// VM-vinner). Aggregeringssteget i workflowen kjører bare når endret=true.
if (process.env.GITHUB_OUTPUT) {
  appendFileSync(
    process.env.GITHUB_OUTPUT,
    `endret=${r.børAggregere ? "true" : "false"}\n`,
  );
}
console.log(
  r.børAggregere
    ? "→ Trigger poeng-aggregering."
    : "→ Ingen ferdige kamper — hopper over aggregering.",
);
