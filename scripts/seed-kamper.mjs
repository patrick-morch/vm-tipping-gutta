// One-shot: skriv alle 72 gruppekamper (A1..L6) til Firestore.
// Bruker Firebase CLI sin access-token mot REST-APIet — krever
// at du har kjørt `firebase login` lokalt.

import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const PROJECT_ID = "vm-tipping-gutta";
const CONFIG = join(
  homedir(),
  ".config/configstore/firebase-tools.json",
);

function token() {
  const raw = JSON.parse(readFileSync(CONFIG, "utf-8"));
  const t = raw.tokens;
  if (!t?.access_token) throw new Error("Mangler access_token i firebase-tools configstore");
  if (Date.now() > t.expires_at) throw new Error("Access-token utløpt — kjør 'firebase login' på nytt");
  return t.access_token;
}

const NORGE = "Norge";

const RÅKAMPER = [
  ["A", "06-11", "15:00", "Sør-Afrika", "Mexico"],
  ["A", "06-11", "22:00", "Tsjekkia", "Sør-Korea"],
  ["A", "06-18", "12:00", "Sør-Afrika", "Tsjekkia"],
  ["A", "06-18", "21:00", "Sør-Korea", "Mexico"],
  ["A", "06-24", "21:00", "Sør-Korea", "Sør-Afrika"],
  ["A", "06-24", "21:00", "Mexico", "Tsjekkia"],
  ["B", "06-12", "15:00", "Bosnia-Hercegovina", "Canada"],
  ["B", "06-13", "15:00", "Sveits", "Qatar"],
  ["B", "06-18", "15:00", "Bosnia-Hercegovina", "Sveits"],
  ["B", "06-18", "18:00", "Qatar", "Canada"],
  ["B", "06-24", "15:00", "Canada", "Sveits"],
  ["B", "06-24", "15:00", "Qatar", "Bosnia-Hercegovina"],
  ["C", "06-13", "18:00", "Marokko", "Brasil"],
  ["C", "06-13", "21:00", "Skottland", "Haiti"],
  ["C", "06-19", "18:00", "Marokko", "Skottland"],
  ["C", "06-19", "20:30", "Haiti", "Brasil"],
  ["C", "06-24", "18:00", "Brasil", "Skottland"],
  ["C", "06-24", "18:00", "Haiti", "Marokko"],
  ["D", "06-12", "21:00", "Paraguay", "USA"],
  ["D", "06-14", "00:00", "Tyrkia", "Australia"],
  ["D", "06-19", "15:00", "Australia", "USA"],
  ["D", "06-19", "23:00", "Paraguay", "Tyrkia"],
  ["D", "06-25", "22:00", "USA", "Tyrkia"],
  ["D", "06-25", "22:00", "Australia", "Paraguay"],
  ["E", "06-14", "13:00", "Curaçao", "Tyskland"],
  ["E", "06-14", "19:00", "Ecuador", "Elfenbenskysten"],
  ["E", "06-20", "16:00", "Elfenbenskysten", "Tyskland"],
  ["E", "06-20", "20:00", "Curaçao", "Ecuador"],
  ["E", "06-25", "16:00", "Tyskland", "Ecuador"],
  ["E", "06-25", "16:00", "Elfenbenskysten", "Curaçao"],
  ["F", "06-14", "16:00", "Japan", "Nederland"],
  ["F", "06-14", "22:00", "Tunisia", "Sverige"],
  ["F", "06-20", "13:00", "Sverige", "Nederland"],
  ["F", "06-21", "00:00", "Japan", "Tunisia"],
  ["F", "06-25", "19:00", "Nederland", "Tunisia"],
  ["F", "06-25", "19:00", "Sverige", "Japan"],
  ["G", "06-15", "15:00", "Egypt", "Belgia"],
  ["G", "06-15", "21:00", "New Zealand", "Iran"],
  ["G", "06-21", "15:00", "Iran", "Belgia"],
  ["G", "06-21", "21:00", "Egypt", "New Zealand"],
  ["G", "06-26", "23:00", "Belgia", "New Zealand"],
  ["G", "06-26", "23:00", "Iran", "Egypt"],
  ["H", "06-15", "12:00", "Kapp Verde", "Spania"],
  ["H", "06-15", "18:00", "Uruguay", "Saudi-Arabia"],
  ["H", "06-21", "12:00", "Saudi-Arabia", "Spania"],
  ["H", "06-21", "18:00", "Kapp Verde", "Uruguay"],
  ["H", "06-26", "20:00", "Spania", "Uruguay"],
  ["H", "06-26", "20:00", "Saudi-Arabia", "Kapp Verde"],
  ["I", "06-16", "15:00", "Senegal", "Frankrike"],
  ["I", "06-16", "18:00", "Norge", "Irak"],
  ["I", "06-22", "17:00", "Irak", "Frankrike"],
  ["I", "06-22", "20:00", "Senegal", "Norge"],
  ["I", "06-26", "15:00", "Frankrike", "Norge"],
  ["I", "06-26", "15:00", "Irak", "Senegal"],
  ["J", "06-17", "00:00", "Jordan", "Østerrike"],
  ["J", "06-16", "21:00", "Algerie", "Argentina"],
  ["J", "06-22", "13:00", "Østerrike", "Argentina"],
  ["J", "06-22", "23:00", "Algerie", "Jordan"],
  ["J", "06-27", "22:00", "Østerrike", "Algerie"],
  ["J", "06-27", "22:00", "Argentina", "Jordan"],
  ["K", "06-17", "13:00", "DR Kongo", "Portugal"],
  ["K", "06-17", "22:00", "Colombia", "Usbekistan"],
  ["K", "06-23", "13:00", "Usbekistan", "Portugal"],
  ["K", "06-23", "22:00", "DR Kongo", "Colombia"],
  ["K", "06-27", "19:30", "Portugal", "Colombia"],
  ["K", "06-27", "19:30", "Usbekistan", "DR Kongo"],
  ["L", "06-17", "16:00", "Kroatia", "England"],
  ["L", "06-17", "19:00", "Panama", "Ghana"],
  ["L", "06-23", "16:00", "Ghana", "England"],
  ["L", "06-23", "19:00", "Kroatia", "Panama"],
  ["L", "06-27", "17:00", "Ghana", "Kroatia"],
  ["L", "06-27", "17:00", "England", "Panama"],
];

function alleKamper() {
  const teller = new Map();
  return RÅKAMPER.map(([gruppe, dato, tid, hjem, bort]) => {
    const i = teller.get(gruppe) ?? 0;
    teller.set(gruppe, i + 1);
    const erNorge = hjem === NORGE || bort === NORGE;
    return {
      id: `${gruppe}${i + 1}`,
      hjemmelag: hjem,
      bortelag: bort,
      starttid: new Date(`2026-${dato}T${tid}:00-04:00`).getTime(),
      runde: `Gruppe ${gruppe}`,
      bonusFaktor: erNorge ? 2 : 1,
      resultat: null,
    };
  });
}

function toFirestoreFields(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === null) out[k] = { nullValue: null };
    else if (typeof v === "string") out[k] = { stringValue: v };
    else if (Number.isInteger(v)) out[k] = { integerValue: String(v) };
    else if (typeof v === "number") out[k] = { doubleValue: v };
    else throw new Error(`Ukjent type for ${k}: ${typeof v}`);
  }
  return out;
}

async function upsertKamp(accessToken, kamp) {
  const { id, ...data } = kamp;
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/kamper/${id}`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fields: toFirestoreFields(data) }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`${id}: ${res.status} ${t.slice(0, 200)}`);
  }
}

async function main() {
  const t = token();
  const kamper = alleKamper();
  let ok = 0;
  for (const k of kamper) {
    await upsertKamp(t, k);
    ok++;
    process.stdout.write(`\r${ok}/${kamper.length}  ${k.id} ${k.hjemmelag} vs ${k.bortelag}                    `);
  }
  console.log(`\nFerdig: ${ok} kamper skrevet til ${PROJECT_ID}`);
}

main().catch((e) => {
  console.error("\nFeil:", e.message);
  process.exit(1);
});
