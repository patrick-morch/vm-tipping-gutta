export type Match = {
  id: string;
  hjemmelag: string;
  bortelag: string;
  starttid: number;
  runde: string;
  bonusFaktor: number;
  resultat?: { hjemme: number; borte: number } | null;
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
