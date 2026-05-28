// Henter siste VM-resultater fra TheSportsDB og oppdaterer Firestore.
//
// Strategi:
// 1) Gruppespill: våre 72 kamper er forhåndsseedet (A1..L6). Matcher events
//    på lag-par og oppdaterer resultat.
// 2) Knockout: TheSportsDB legger inn matchups så fort FIFA bestemmer dem
//    etter gruppespillet. Vi oppretter nye kamper med id 'kn-<idEvent>' og
//    riktig runde-navn. Resultater fylles inn i samme sync.

import admin from "firebase-admin";
import { tilNorsk } from "./lib/lag-mapping.mjs";

const SPORTSDB_BASE = "https://www.thesportsdb.com/api/v1/json/3";
const LIGA_ID = "4429"; // FIFA World Cup

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

async function hentEvents() {
  const url = `${SPORTSDB_BASE}/eventsseason.php?id=${LIGA_ID}&s=2026`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`TheSportsDB svarte ${r.status}`);
  const data = await r.json();
  return data.events || [];
}

function tilNorske(event) {
  const h = tilNorsk(event.strHomeTeam);
  const b = tilNorsk(event.strAwayTeam);
  if (!h || !b) return null;
  const tid = new Date(event.strTimestamp + "Z").getTime();
  return {
    idEvent: event.idEvent,
    intRound: Number(event.intRound) || 0,
    hjemmelag: h,
    bortelag: b,
    starttid: tid,
    resultat:
      event.intHomeScore != null && event.intAwayScore != null
        ? {
            hjemme: Number(event.intHomeScore),
            borte: Number(event.intAwayScore),
          }
        : null,
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

  console.log("Henter VM-events fra TheSportsDB…");
  const events = await hentEvents();
  console.log(`Fant ${events.length} events`);

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

  for (const e of events) {
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
      if (
        eks &&
        eks.hjemme === skriv.hjemme &&
        eks.borte === skriv.borte
      )
        continue;

      await db.collection("kamper").doc(treff.id).update({ resultat: skriv });
      console.log(
        `  ✓ ${treff.id}: ${treff.kamp.hjemmelag} ${skriv.hjemme}-${skriv.borte} ${treff.kamp.bortelag}`,
      );
      oppdatertResultat += 1;
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
        });
        console.log(`  + ${id}: ${runde} ${norsk.hjemmelag} vs ${norsk.bortelag}`);
        opprettetKnockout += 1;
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
        if (
          norsk.resultat &&
          (!eks.resultat ||
            eks.resultat.hjemme !== norsk.resultat.hjemme ||
            eks.resultat.borte !== norsk.resultat.borte)
        ) {
          oppdateringer.resultat = norsk.resultat;
        }
        if (Object.keys(oppdateringer).length > 0) {
          await db.collection("kamper").doc(id).update(oppdateringer);
          console.log(
            `  ✓ ${id}: oppdatert (${Object.keys(oppdateringer).join(", ")})`,
          );
          oppdatertResultat += 1;
        }
      }
    }
  }

  // Etter alle oppdateringer: sjekk om finalen er ferdig og sett vmVinner
  // automatisk i fasit-dokumentet hvis ikke allerede satt.
  await oppdaterVmVinner(db);

  return { oppdatert: oppdatertResultat, opprettet: opprettetKnockout };
}

async function oppdaterVmVinner(db) {
  const finalerSnap = await db
    .collection("kamper")
    .where("runde", "==", "Finale")
    .get();

  if (finalerSnap.empty) return;

  // Det er normalt bare én Finale-kamp, men ta uansett en med resultat
  const finale = finalerSnap.docs
    .map((d) => d.data())
    .find((k) => k.resultat != null);

  if (!finale) return;

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
    return;
  }

  const fasitRef = db.collection("fasit").doc("vm");
  const eks = await fasitRef.get();
  const nåværende = eks.exists ? eks.data() : {};

  if (nåværende.vmVinner === vinner) return; // ingen endring

  await fasitRef.set({ ...nåværende, vmVinner: vinner }, { merge: true });
  console.log(`  ✓ Satt fasit.vmVinner = ${vinner}`);
}

const r = await syncResultater();
console.log(
  `\n✓ Sync ferdig. Oppdaterte ${r.oppdatert} kamper, opprettet ${r.opprettet} knockout-kamper.`,
);
