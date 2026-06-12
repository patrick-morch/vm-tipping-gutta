// Mapper engelsk lag-navn fra TheSportsDB → norske lag-navn vi bruker.
// Speiler scripts/lib/lag-mapping.mjs (brukes av GitHub-synken); hold dem like.

export const LAG_TIL_NORSK: Record<string, string> = {
  // Gruppe A
  Mexico: "Mexico",
  "South Korea": "Sør-Korea",
  "South Africa": "Sør-Afrika",
  "Czech Republic": "Tsjekkia",
  // Gruppe B
  Canada: "Canada",
  Switzerland: "Sveits",
  Qatar: "Qatar",
  "Bosnia-Herzegovina": "Bosnia-Hercegovina",
  "Bosnia and Herzegovina": "Bosnia-Hercegovina",
  // Gruppe C
  Brazil: "Brasil",
  Morocco: "Marokko",
  Scotland: "Skottland",
  Haiti: "Haiti",
  // Gruppe D
  "United States": "USA",
  USA: "USA",
  Australia: "Australia",
  Paraguay: "Paraguay",
  Turkey: "Tyrkia",
  Türkiye: "Tyrkia",
  // Gruppe E
  Germany: "Tyskland",
  Ecuador: "Ecuador",
  "Ivory Coast": "Elfenbenskysten",
  "Côte d'Ivoire": "Elfenbenskysten",
  Curaçao: "Curaçao",
  // Gruppe F
  Netherlands: "Nederland",
  Japan: "Japan",
  Tunisia: "Tunisia",
  Sweden: "Sverige",
  // Gruppe G
  Belgium: "Belgia",
  Iran: "Iran",
  "IR Iran": "Iran",
  Egypt: "Egypt",
  "New Zealand": "New Zealand",
  // Gruppe H
  Spain: "Spania",
  Uruguay: "Uruguay",
  "Saudi Arabia": "Saudi-Arabia",
  "Cape Verde": "Kapp Verde",
  // Gruppe I
  France: "Frankrike",
  Senegal: "Senegal",
  Norway: "Norge",
  Iraq: "Irak",
  // Gruppe J
  Argentina: "Argentina",
  Austria: "Østerrike",
  Algeria: "Algerie",
  Jordan: "Jordan",
  // Gruppe K
  Portugal: "Portugal",
  Colombia: "Colombia",
  Uzbekistan: "Usbekistan",
  "Congo DR": "DR Kongo",
  "DR Congo": "DR Kongo",
  "Democratic Republic of the Congo": "DR Kongo",
  // Gruppe L
  England: "England",
  Croatia: "Kroatia",
  Panama: "Panama",
  Ghana: "Ghana",
};

export function tilNorsk(engelskNavn: string): string | null {
  return LAG_TIL_NORSK[engelskNavn] || null;
}
