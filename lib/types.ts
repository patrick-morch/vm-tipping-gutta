export type Match = {
  id: string;
  hjemmelag: string;
  bortelag: string;
  starttid: number;
  runde: string;
  bonusFaktor: number;
  resultat?: { hjemme: number; borte: number } | null;
  // true = ferdigspilt (poeng teller). false = live-stilling (venter på full
  // tid). undefined på eldre/manuelt satte kamper = behandles som endelig.
  ferdig?: boolean;
  // true = resultatet er satt manuelt av admin (typisk 90-min-stillingen for en
  // sluttspillkamp som gikk til ekstraomganger). Auto-synken skal da ALDRI
  // overskrive resultat/ferdig — uavhengig av datakilde (football-data gir bare
  // ekstraomgang-stillingen, og TheSportsDB-fallback mangler duration-feltet
  // som ellers ville beskyttet inntastingen).
  manuelt?: boolean;
};

export type Prediction = {
  matchId: string;
  uid: string;
  navn: string;
  hjemme: number;
  borte: number;
  lagretTid: number;
};

export type KlubbRolle = "trener" | "spiller" | "annet";

export type Bruker = {
  uid: string;
  epost: string;
  navn: string;
  avdeling?: string;
  klubbRolle?: KlubbRolle; // valgfri for eldre brukere uten denne
  rolle: "medlem" | "admin";
  poeng: number;
  opprettet: number;
  // Når true: bruker kan bla i appen men ikke lagre nye tipps eller endre
  // spesialtips. Settes/oppheves av admin.
  frosset?: boolean;
  // Epoch-ms: admin kan midlertidig åpne spesialtips for denne brukeren etter
  // den globale låsen. Brukeren kan redigere spesialtips så lenge
  // spesialAapenTil > nå. Auto-utløper (håndheves i firestore.rules + UI).
  spesialAapenTil?: number;
};

export type RonaldoVsMessi = "ronaldo" | "messi" | "likt" | "";

export type SpesialTip = {
  uid: string;
  vmVinner: string;
  vmFinalist: string;
  toppscorer: string;
  toppassist: string;
  mestRødeKort: string;
  ronaldoVsMessi: RonaldoVsMessi;
  lagretTid: number;
};

export type Fasit = {
  // satt av admin
  gruppeVinner: Record<string, string>; // { A: "Mexico", ... }
  gruppeToer: Record<string, string>;
  vmVinner: string;
  vmFinalist: string;
  toppscorer: string;
  toppassist: string;
  mestRødeKort: string;
  ronaldoVsMessi: RonaldoVsMessi;
};

export function beregnPoeng(
  tip: { hjemme: number; borte: number },
  resultat: { hjemme: number; borte: number },
  bonus: number = 1,
): number {
  const eksakt = tip.hjemme === resultat.hjemme && tip.borte === resultat.borte;
  if (eksakt) return 3 * bonus;
  const utfallTip = Math.sign(tip.hjemme - tip.borte);
  const utfallRes = Math.sign(resultat.hjemme - resultat.borte);
  if (utfallTip === utfallRes) return 1 * bonus;
  return 0;
}
