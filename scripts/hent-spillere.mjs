// Henter alle VM 2026-spillere fra Wikipedia og lagrer som JSON.
// Bruk: node scripts/hent-spillere.mjs
import { writeFile } from "fs/promises";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const URL = "https://en.wikipedia.org/wiki/2026_FIFA_World_Cup_squads";

// Norsk navn → Wikipedia-id
const LAND_NORSK = {
  Czech_Republic: "Tsjekkia",
  Mexico: "Mexico",
  South_Africa: "Sør-Afrika",
  South_Korea: "Sør-Korea",
  Bosnia_and_Herzegovina: "Bosnia-Hercegovina",
  Canada: "Canada",
  Qatar: "Qatar",
  Switzerland: "Sveits",
  Brazil: "Brasil",
  Haiti: "Haiti",
  Morocco: "Marokko",
  Scotland: "Skottland",
  Australia: "Australia",
  Paraguay: "Paraguay",
  Turkey: "Tyrkia",
  United_States: "USA",
  "Cura%C3%A7ao": "Curaçao",
  "Curaçao": "Curaçao",
  Ecuador: "Ecuador",
  Germany: "Tyskland",
  "Ivory_Coast": "Elfenbenskysten",
  "C%C3%B4te_d%27Ivoire": "Elfenbenskysten",
  "Côte_d'Ivoire": "Elfenbenskysten",
  Japan: "Japan",
  Netherlands: "Nederland",
  Sweden: "Sverige",
  Tunisia: "Tunisia",
  Belgium: "Belgia",
  Egypt: "Egypt",
  Iran: "Iran",
  New_Zealand: "New Zealand",
  "Cape_Verde": "Kapp Verde",
  Saudi_Arabia: "Saudi-Arabia",
  Spain: "Spania",
  Uruguay: "Uruguay",
  France: "Frankrike",
  Iraq: "Irak",
  Norway: "Norge",
  Senegal: "Senegal",
  Algeria: "Algerie",
  Argentina: "Argentina",
  Austria: "Østerrike",
  Jordan: "Jordan",
  Colombia: "Colombia",
  DR_Congo: "DR Kongo",
  "Democratic_Republic_of_the_Congo": "DR Kongo",
  Portugal: "Portugal",
  Uzbekistan: "Usbekistan",
  Croatia: "Kroatia",
  England: "England",
  Ghana: "Ghana",
  Panama: "Panama",
};

console.log("Henter Wikipedia-side…");
const html = await (await fetch(URL)).text();

// Finn alle land-seksjoner. Hver starter med <h3 id="LANDNAVN"> og slutter ved neste <h3
const seksjonRegex = /<h3 id="([^"]+)">.*?<\/h3>([\s\S]*?)(?=<h3 id=|<h2 id=)/g;

const spillere = {};
let match;
let totalt = 0;

while ((match = seksjonRegex.exec(html)) !== null) {
  const wikiId = match[1];
  const norsk = LAND_NORSK[wikiId] || decodeURIComponent(wikiId).replace(/_/g, " ");
  if (!LAND_NORSK[wikiId]) continue; // skip avsnitt som ikke er lag (f.eks. references)
  const blokk = match[2];

  // Hver spiller-rad har posisjon (GK/DF/MF/FW) link og deretter spillernavn-link
  // Bruker tittel-attributten på <a>-taggen siden navnet kan inneholde HTML-entities
  const radRegex =
    />(GK|DF|MF|FW)<\/a>[\s\S]{0,300}?<a href="\/wiki\/[^"]+" title="([^"]+)"[^>]*>([^<]+)<\/a>/g;
  let rad;
  const lagSpillere = [];
  while ((rad = radRegex.exec(blokk)) !== null) {
    const navn = rad[3]
      .replace(/&amp;/g, "&")
      .replace(/&#039;/g, "'")
      .replace(/&quot;/g, '"');
    if (!lagSpillere.find((p) => p.navn === navn)) {
      lagSpillere.push({ navn, pos: rad[1] });
    }
  }
  if (lagSpillere.length > 0) {
    spillere[norsk] = lagSpillere;
    totalt += lagSpillere.length;
    console.log(`  ${norsk}: ${lagSpillere.length} spillere`);
  }
}

const utfil = join(__dirname, "..", "lib", "spillere.json");
await writeFile(utfil, JSON.stringify(spillere, null, 2));
console.log(`\n✓ Lagret ${totalt} spillere fra ${Object.keys(spillere).length} lag til ${utfil}`);
