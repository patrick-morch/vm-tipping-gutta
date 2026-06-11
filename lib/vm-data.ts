import { Match } from "./types";

export type Gruppe = {
  id: string;
  lag: string[];
};

export const GRUPPER: Gruppe[] = [
  { id: "A", lag: ["Mexico", "Sør-Korea", "Sør-Afrika", "Tsjekkia"] },
  { id: "B", lag: ["Canada", "Sveits", "Qatar", "Bosnia-Hercegovina"] },
  { id: "C", lag: ["Brasil", "Marokko", "Skottland", "Haiti"] },
  { id: "D", lag: ["USA", "Australia", "Paraguay", "Tyrkia"] },
  { id: "E", lag: ["Tyskland", "Ecuador", "Elfenbenskysten", "Curaçao"] },
  { id: "F", lag: ["Nederland", "Japan", "Tunisia", "Sverige"] },
  { id: "G", lag: ["Belgia", "Iran", "Egypt", "New Zealand"] },
  { id: "H", lag: ["Spania", "Uruguay", "Saudi-Arabia", "Kapp Verde"] },
  { id: "I", lag: ["Frankrike", "Senegal", "Norge", "Irak"] },
  { id: "J", lag: ["Argentina", "Østerrike", "Algerie", "Jordan"] },
  { id: "K", lag: ["Portugal", "Colombia", "Usbekistan", "DR Kongo"] },
  { id: "L", lag: ["England", "Kroatia", "Panama", "Ghana"] },
];

export const NORGE = "Norge";

export function erNorgeKamp(k: { hjemmelag: string; bortelag: string }) {
  return k.hjemmelag === NORGE || k.bortelag === NORGE;
}

// Forkortelser for lag med veldig lange navn (brukes i kort-layouter
// der plass er trang). Interne lookups bruker det fulle navnet.
const KORT_LAGNAVN: Record<string, string> = {
  "Bosnia-Hercegovina": "Bosnia",
};

export function kortLagNavn(navn: string): string {
  return KORT_LAGNAVN[navn] || navn;
}

// Unicode flagg-emoji per lag. England og Skottland bruker
// regional indicator subdivision sequences som faller tilbake til
// 🏴 hvis enheten ikke støtter dem (eldre Windows, noen Androider).
const FLAGG: Record<string, string> = {
  Mexico: "🇲🇽",
  "Sør-Korea": "🇰🇷",
  "Sør-Afrika": "🇿🇦",
  Tsjekkia: "🇨🇿",
  Canada: "🇨🇦",
  Sveits: "🇨🇭",
  Qatar: "🇶🇦",
  "Bosnia-Hercegovina": "🇧🇦",
  Brasil: "🇧🇷",
  Marokko: "🇲🇦",
  Skottland: "🏴󠁧󠁢󠁳󠁣󠁴󠁿",
  Haiti: "🇭🇹",
  USA: "🇺🇸",
  Australia: "🇦🇺",
  Paraguay: "🇵🇾",
  Tyrkia: "🇹🇷",
  Tyskland: "🇩🇪",
  Ecuador: "🇪🇨",
  Elfenbenskysten: "🇨🇮",
  Curaçao: "🇨🇼",
  Nederland: "🇳🇱",
  Japan: "🇯🇵",
  Tunisia: "🇹🇳",
  Sverige: "🇸🇪",
  Belgia: "🇧🇪",
  Iran: "🇮🇷",
  Egypt: "🇪🇬",
  "New Zealand": "🇳🇿",
  Spania: "🇪🇸",
  Uruguay: "🇺🇾",
  "Saudi-Arabia": "🇸🇦",
  "Kapp Verde": "🇨🇻",
  Frankrike: "🇫🇷",
  Senegal: "🇸🇳",
  Norge: "🇳🇴",
  Irak: "🇮🇶",
  Argentina: "🇦🇷",
  Østerrike: "🇦🇹",
  Algerie: "🇩🇿",
  Jordan: "🇯🇴",
  Portugal: "🇵🇹",
  Colombia: "🇨🇴",
  Usbekistan: "🇺🇿",
  "DR Kongo": "🇨🇩",
  England: "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
  Kroatia: "🇭🇷",
  Panama: "🇵🇦",
  Ghana: "🇬🇭",
};

export function flagg(lag: string): string {
  return FLAGG[lag] || "🏳";
}

export function erTippbar(_kamp: {
  runde: string;
  hjemmelag: string;
  bortelag: string;
}): boolean {
  return true;
}

// Alle 72 gruppekamper. Tider er Eastern Time (UTC-4, sommertid).
// Format: [gruppe, "MM-DD", "HH:MM (24t ET)", hjem, bort]
type RåKamp = [string, string, string, string, string];

const RÅKAMPER: RåKamp[] = [
  // Gruppe A
  ["A", "06-11", "15:00", "Sør-Afrika", "Mexico"],
  ["A", "06-12", "22:00", "Tsjekkia", "Sør-Korea"],
  ["A", "06-18", "12:00", "Sør-Afrika", "Tsjekkia"],
  ["A", "06-19", "21:00", "Sør-Korea", "Mexico"],
  ["A", "06-25", "21:00", "Sør-Korea", "Sør-Afrika"],
  ["A", "06-25", "21:00", "Mexico", "Tsjekkia"],
  // Gruppe B
  ["B", "06-12", "15:00", "Bosnia-Hercegovina", "Canada"],
  ["B", "06-13", "15:00", "Sveits", "Qatar"],
  ["B", "06-18", "15:00", "Bosnia-Hercegovina", "Sveits"],
  ["B", "06-18", "18:00", "Qatar", "Canada"],
  ["B", "06-24", "15:00", "Canada", "Sveits"],
  ["B", "06-24", "15:00", "Qatar", "Bosnia-Hercegovina"],
  // Gruppe C
  ["C", "06-13", "18:00", "Marokko", "Brasil"],
  ["C", "06-14", "21:00", "Skottland", "Haiti"],
  ["C", "06-19", "18:00", "Marokko", "Skottland"],
  ["C", "06-20", "20:30", "Haiti", "Brasil"],
  ["C", "06-24", "18:00", "Brasil", "Skottland"],
  ["C", "06-24", "18:00", "Haiti", "Marokko"],
  // Gruppe D
  ["D", "06-13", "21:00", "Paraguay", "USA"],
  ["D", "06-14", "00:00", "Tyrkia", "Australia"],
  ["D", "06-19", "15:00", "Australia", "USA"],
  ["D", "06-20", "23:00", "Paraguay", "Tyrkia"],
  ["D", "06-26", "22:00", "USA", "Tyrkia"],
  ["D", "06-26", "22:00", "Australia", "Paraguay"],
  // Gruppe E
  ["E", "06-14", "13:00", "Curaçao", "Tyskland"],
  ["E", "06-14", "19:00", "Ecuador", "Elfenbenskysten"],
  ["E", "06-20", "16:00", "Elfenbenskysten", "Tyskland"],
  ["E", "06-21", "20:00", "Curaçao", "Ecuador"],
  ["E", "06-25", "16:00", "Tyskland", "Ecuador"],
  ["E", "06-25", "16:00", "Elfenbenskysten", "Curaçao"],
  // Gruppe F
  ["F", "06-14", "16:00", "Japan", "Nederland"],
  ["F", "06-15", "22:00", "Tunisia", "Sverige"],
  ["F", "06-20", "13:00", "Sverige", "Nederland"],
  ["F", "06-21", "00:00", "Japan", "Tunisia"],
  ["F", "06-25", "19:00", "Nederland", "Tunisia"],
  ["F", "06-25", "19:00", "Sverige", "Japan"],
  // Gruppe G
  ["G", "06-15", "15:00", "Egypt", "Belgia"],
  ["G", "06-16", "21:00", "New Zealand", "Iran"],
  ["G", "06-21", "15:00", "Iran", "Belgia"],
  ["G", "06-22", "21:00", "Egypt", "New Zealand"],
  ["G", "06-27", "23:00", "Belgia", "New Zealand"],
  ["G", "06-27", "23:00", "Iran", "Egypt"],
  // Gruppe H
  ["H", "06-15", "12:00", "Kapp Verde", "Spania"],
  ["H", "06-15", "18:00", "Uruguay", "Saudi-Arabia"],
  ["H", "06-21", "12:00", "Saudi-Arabia", "Spania"],
  ["H", "06-21", "18:00", "Kapp Verde", "Uruguay"],
  ["H", "06-27", "20:00", "Spania", "Uruguay"],
  ["H", "06-27", "20:00", "Saudi-Arabia", "Kapp Verde"],
  // Gruppe I (Norge — alle kamper med ×2 bonus)
  ["I", "06-16", "15:00", "Senegal", "Frankrike"],
  ["I", "06-16", "18:00", "Norge", "Irak"],
  ["I", "06-22", "17:00", "Irak", "Frankrike"],
  ["I", "06-23", "20:00", "Senegal", "Norge"],
  ["I", "06-26", "15:00", "Frankrike", "Norge"],
  ["I", "06-26", "15:00", "Irak", "Senegal"],
  // Gruppe J
  ["J", "06-17", "00:00", "Jordan", "Østerrike"],
  ["J", "06-17", "21:00", "Algerie", "Argentina"],
  ["J", "06-22", "13:00", "Østerrike", "Argentina"],
  ["J", "06-23", "23:00", "Algerie", "Jordan"],
  ["J", "06-28", "22:00", "Østerrike", "Algerie"],
  ["J", "06-28", "22:00", "Argentina", "Jordan"],
  // Gruppe K
  ["K", "06-17", "13:00", "DR Kongo", "Portugal"],
  ["K", "06-18", "22:00", "Colombia", "Usbekistan"],
  ["K", "06-23", "13:00", "Usbekistan", "Portugal"],
  ["K", "06-24", "22:00", "DR Kongo", "Colombia"],
  ["K", "06-27", "19:30", "Portugal", "Colombia"],
  ["K", "06-27", "19:30", "Usbekistan", "DR Kongo"],
  // Gruppe L
  ["L", "06-17", "16:00", "Kroatia", "England"],
  ["L", "06-17", "19:00", "Panama", "Ghana"],
  ["L", "06-23", "16:00", "Ghana", "England"],
  ["L", "06-23", "19:00", "Kroatia", "Panama"],
  ["L", "06-27", "17:00", "Ghana", "Kroatia"],
  ["L", "06-27", "17:00", "England", "Panama"],
];

function lagId(gruppe: string, indexIGruppe: number) {
  return `${gruppe}${indexIGruppe + 1}`;
}

export function alleGruppekamper(): Match[] {
  const teller = new Map<string, number>();
  return RÅKAMPER.map((r) => {
    const [gruppe, dato, tid, hjem, bort] = r;
    const i = teller.get(gruppe) ?? 0;
    teller.set(gruppe, i + 1);
    const erNorge = hjem === NORGE || bort === NORGE;
    return {
      id: lagId(gruppe, i),
      hjemmelag: hjem,
      bortelag: bort,
      starttid: new Date(`2026-${dato}T${tid}:00-04:00`).getTime(),
      runde: `Gruppe ${gruppe}`,
      bonusFaktor: erNorge ? 2 : 1,
      resultat: null,
    };
  });
}

// Spesialtips låses når første VM-kamp starter (avspark, 11. juni norsk tid).
const SPESIAL_LÅS_FØR_MS = 0;

export const SPESIAL_LÅS_TID = (() => {
  const kamper = alleGruppekamper();
  return Math.min(...kamper.map((k) => k.starttid)) - SPESIAL_LÅS_FØR_MS;
})();

// Tipping på en kamp låses i det kampen starter (avspark).
export function kampErLåst(kamp: { starttid: number }, nå = Date.now()): boolean {
  return nå >= kamp.starttid;
}

export function spesialErLåst(nå = Date.now()): boolean {
  return nå >= SPESIAL_LÅS_TID;
}

export const SLUTTSPILL_RUNDER = [
  { id: "32del", navn: "32-delsfinale", antall: 16 },
  { id: "16del", navn: "16-delsfinale", antall: 8 },
  { id: "kvart", navn: "Kvartfinale", antall: 4 },
  { id: "semi", navn: "Semifinale", antall: 2 },
  { id: "bronse", navn: "Bronsefinale", antall: 1 },
  { id: "finale", navn: "Finale", antall: 1 },
];

export const POENG = {
  eksakt: 3,
  utfall: 1,
  gruppeVinner: 5,
  gruppeToer: 3,
  vmVinner: 25,
  vmFinalist: 10,
  toppscorer: 15,
  toppassist: 10,
  mestRødeKort: 5,
  ronaldoVsMessi: 5,
};
