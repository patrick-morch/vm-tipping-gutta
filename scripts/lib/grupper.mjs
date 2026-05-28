// Speilet av lib/vm-data.ts (ESM-versjon for Node-skripter)

export const GRUPPER = [
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

export function gruppeForLag(lag) {
  return GRUPPER.find((g) => g.lag.includes(lag))?.id;
}
