// Engangs-fiks: retter starttid for de 25 gruppekampene som hadde feil dato
// (lagret med UTC-dato i stedet for ET-dato → én dag for sent for kamper med
// avspark kl 20:00 ET eller senere). Oppdaterer KUN starttid-feltet via
// Firestore updateMask, så resultat/lag/runde bevares urørt.
//
// Krever lokal `firebase login` (samme token-mekanisme som seed-kamper.mjs).
// Idempotent: kan kjøres flere ganger.

import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const PROJECT_ID = "vm-tipping-gutta";
const CONFIG = join(homedir(), ".config/configstore/firebase-tools.json");

function token() {
  const raw = JSON.parse(readFileSync(CONFIG, "utf-8"));
  const t = raw.tokens;
  if (!t?.access_token)
    throw new Error("Mangler access_token i firebase-tools configstore");
  if (Date.now() > t.expires_at)
    throw new Error("Access-token utløpt — kjør 'firebase login' på nytt");
  return t.access_token;
}

// [id, korrekt dato (ET), klokkeslett (ET)] — de 25 kampene som var feil.
const FIKSER = [
  ["A2", "06-11", "22:00"], // Tsjekkia–Sør-Korea
  ["A4", "06-18", "21:00"], // Sør-Korea–Mexico
  ["A5", "06-24", "21:00"], // Sør-Korea–Sør-Afrika
  ["A6", "06-24", "21:00"], // Mexico–Tsjekkia
  ["C2", "06-13", "21:00"], // Skottland–Haiti
  ["C4", "06-19", "20:30"], // Haiti–Brasil
  ["D1", "06-12", "21:00"], // Paraguay–USA
  ["D4", "06-19", "23:00"], // Paraguay–Tyrkia
  ["D5", "06-25", "22:00"], // USA–Tyrkia
  ["D6", "06-25", "22:00"], // Australia–Paraguay
  ["E4", "06-20", "20:00"], // Curaçao–Ecuador
  ["F2", "06-14", "22:00"], // Tunisia–Sverige
  ["G2", "06-15", "21:00"], // New Zealand–Iran
  ["G4", "06-21", "21:00"], // Egypt–New Zealand
  ["G5", "06-26", "23:00"], // Belgia–New Zealand
  ["G6", "06-26", "23:00"], // Iran–Egypt
  ["H5", "06-26", "20:00"], // Spania–Uruguay
  ["H6", "06-26", "20:00"], // Saudi-Arabia–Kapp Verde
  ["I4", "06-22", "20:00"], // Senegal–Norge
  ["J2", "06-16", "21:00"], // Algerie–Argentina
  ["J4", "06-22", "23:00"], // Algerie–Jordan
  ["J5", "06-27", "22:00"], // Østerrike–Algerie
  ["J6", "06-27", "22:00"], // Argentina–Jordan
  ["K2", "06-17", "22:00"], // Colombia–Usbekistan
  ["K4", "06-23", "22:00"], // DR Kongo–Colombia
];

async function oppdaterStarttid(accessToken, id, starttid) {
  const url =
    `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}` +
    `/databases/(default)/documents/kamper/${id}` +
    `?updateMask.fieldPaths=starttid`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      fields: { starttid: { integerValue: String(starttid) } },
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`${id}: ${res.status} ${t.slice(0, 200)}`);
  }
}

async function main() {
  const t = token();
  let ok = 0;
  for (const [id, dato, tid] of FIKSER) {
    const starttid = new Date(`2026-${dato}T${tid}:00-04:00`).getTime();
    await oppdaterStarttid(t, id, starttid);
    ok++;
    const norsk = new Date(starttid).toLocaleString("nb-NO", {
      timeZone: "Europe/Oslo",
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
    console.log(`  ✓ ${id} → ${dato} ${tid} ET  (${norsk} norsk)`);
  }
  console.log(`\nFerdig: rettet starttid for ${ok} kamper i ${PROJECT_ID}.`);
}

main().catch((e) => {
  console.error("\nFeil:", e.message);
  process.exit(1);
});
