"use client";

import { useEffect, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocFromServer,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { fbDb, isFirebaseConfigured } from "./firebase";
import {
  localBrukere,
  localCurrent,
  localFasit,
  localKamper,
  localPassord,
  localSpesialTips,
  localTips,
} from "./local-store";
import {
  Bruker,
  Fasit,
  Match,
  Prediction,
  SpesialTip,
} from "./types";
import { alleGruppekamper } from "./vm-data";

function bruker() {
  return isFirebaseConfigured();
}

export function useKamper(enabled = true): Match[] {
  const [kamper, setKamper] = useState<Match[]>([]);
  useEffect(() => {
    if (!enabled) return;
    if (bruker()) {
      const q = query(collection(fbDb(), "kamper"), orderBy("starttid", "asc"));
      return onSnapshot(q, (snap) => {
        setKamper(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Match));
      });
    }
    return localKamper.subscribe((k) =>
      setKamper([...k].sort((a, b) => a.starttid - b.starttid)),
    );
  }, [enabled]);
  return kamper;
}

export function useMineTips(uid: string | undefined): Record<string, Prediction> {
  const [tips, setTips] = useState<Record<string, Prediction>>({});
  useEffect(() => {
    if (!uid) {
      setTips({});
      return;
    }
    if (bruker()) {
      const q = query(collection(fbDb(), "tips"), where("uid", "==", uid));
      return onSnapshot(q, (snap) => {
        const m: Record<string, Prediction> = {};
        snap.docs.forEach((d) => {
          const p = d.data() as Prediction;
          m[p.matchId] = p;
        });
        setTips(m);
      });
    }
    return localTips.subscribe((alle) => {
      const m: Record<string, Prediction> = {};
      Object.values(alle).forEach((p) => {
        if (p.uid === uid) m[p.matchId] = p;
      });
      setTips(m);
    });
  }, [uid]);
  return tips;
}

export function useAlleTips(enabled = true): Prediction[] {
  const [tips, setTips] = useState<Prediction[]>([]);
  useEffect(() => {
    if (!enabled) return;
    if (bruker()) {
      return onSnapshot(collection(fbDb(), "tips"), (s) =>
        setTips(s.docs.map((d) => d.data() as Prediction)),
      );
    }
    return localTips.subscribe((alle) => setTips(Object.values(alle)));
  }, [enabled]);
  return tips;
}

/**
 * Henter alle tips for ÉN kamp (for "se alles tips" etter at kampen er låst).
 * Leser kun når matchId er satt (on-demand) — kall med null for å ikke lese.
 * Tipsene er frosne etter avspark, så de caches lokalt → billig ved gjentatt visning.
 */
export function useKampTips(matchId: string | null): Prediction[] {
  const [tips, setTips] = useState<Prediction[]>([]);
  useEffect(() => {
    if (!matchId) {
      setTips([]);
      return;
    }
    if (bruker()) {
      const q = query(
        collection(fbDb(), "tips"),
        where("matchId", "==", matchId),
      );
      return onSnapshot(q, (s) =>
        setTips(s.docs.map((d) => d.data() as Prediction)),
      );
    }
    return localTips.subscribe((alle) =>
      setTips(Object.values(alle).filter((t) => t.matchId === matchId)),
    );
  }, [matchId]);
  return tips;
}

/**
 * Henter alle kamptips for ÉN spiller (for spillerprofil i ledertavlen).
 * Leser kun når uid er satt (on-demand) — kall med null for å ikke lese.
 */
export function useSpillerTips(uid: string | null): Prediction[] {
  const [tips, setTips] = useState<Prediction[]>([]);
  useEffect(() => {
    if (!uid) {
      setTips([]);
      return;
    }
    if (bruker()) {
      const q = query(collection(fbDb(), "tips"), where("uid", "==", uid));
      return onSnapshot(q, (s) =>
        setTips(s.docs.map((d) => d.data() as Prediction)),
      );
    }
    return localTips.subscribe((alle) =>
      setTips(Object.values(alle).filter((t) => t.uid === uid)),
    );
  }, [uid]);
  return tips;
}

export function useBrukere(): Bruker[] {
  const [brukere, setBrukere] = useState<Bruker[]>([]);
  useEffect(() => {
    if (bruker()) {
      return onSnapshot(collection(fbDb(), "brukere"), (s) =>
        setBrukere(s.docs.map((d) => d.data() as Bruker)),
      );
    }
    return localBrukere.subscribe((b) => setBrukere(Object.values(b)));
  }, []);
  return brukere;
}

export function useMittSpesialTip(uid: string | undefined): SpesialTip | null {
  const [tip, setTip] = useState<SpesialTip | null>(null);
  useEffect(() => {
    if (!uid) {
      setTip(null);
      return;
    }
    if (bruker()) {
      return onSnapshot(doc(fbDb(), "spesialtips", uid), (s) =>
        setTip(s.exists() ? (s.data() as SpesialTip) : null),
      );
    }
    return localSpesialTips.subscribe((alle) => setTip(alle[uid] || null));
  }, [uid]);
  return tip;
}

export function useAlleSpesialTips(enabled = true): SpesialTip[] {
  const [tips, setTips] = useState<SpesialTip[]>([]);
  useEffect(() => {
    if (!enabled) return;
    if (bruker()) {
      return onSnapshot(collection(fbDb(), "spesialtips"), (s) =>
        setTips(s.docs.map((d) => d.data() as SpesialTip)),
      );
    }
    return localSpesialTips.subscribe((alle) => setTips(Object.values(alle)));
  }, [enabled]);
  return tips;
}

export type LedertavleRad = {
  uid: string;
  navn: string;
  avdeling: string;
  klubbRolle?: "trener" | "spiller" | "annet";
  poeng: number;
  kampPoeng: number;
  spesialPoeng: number;
  eksakte: number;
  utfall?: number;
  feil?: number;
  // Delt plassering ved forrige aggregering — brukes til ▲▼-bevegelse.
  plass?: number;
  forrigePlass?: number | null;
  // Antall siste ferdige kamper på rad med eksakt treff.
  streak?: number;
  // Siste opptil 5 tippede resultater, eldst → nyest: "E"/"U"/"B".
  form?: string[];
};
// Oppsummering av siste ferdigspilte kamp-dag (regnes i aggregeringsjobben).
export type SisteRunde = {
  dato: string;
  antallKamper: number;
  beste: { navn: string; poeng: number } | null;
  klatrer: { navn: string; plasser: number } | null;
  bom: { navn: string; antall: number } | null;
};
// Kumulativ kamp-poeng-historikk per kamp-dag → utviklingsgrafen leser dette
// ene dokumentet i stedet for alle tips (holder oss på gratis-kvoten).
export type Historikk = {
  punkter: { key: string; label: string }[];
  poeng: Record<string, number[]>;
};
export type AggregertLedertavle = {
  oppdatert: number;
  kamperSpilt: number;
  kamperTotalt: number;
  rader: LedertavleRad[];
  sisteRunde?: SisteRunde | null;
  historikk?: Historikk | null;
};

export function useAggregertLedertavle(): AggregertLedertavle | null {
  const [data, setData] = useState<AggregertLedertavle | null>(null);
  useEffect(() => {
    if (!bruker()) return;
    return onSnapshot(
      doc(fbDb(), "aggregert", "ledertavle"),
      (s) =>
        setData(s.exists() ? (s.data() as AggregertLedertavle) : null),
    );
  }, []);
  return data;
}

export function useFasit(enabled = true): Fasit {
  const [fasit, setFasit] = useState<Fasit>({
    gruppeVinner: {},
    gruppeToer: {},
    vmVinner: "",
    vmFinalist: "",
    toppscorer: "",
    toppassist: "",
    mestRødeKort: "",
    ronaldoVsMessi: "",
  });
  useEffect(() => {
    if (!enabled) return;
    if (bruker()) {
      return onSnapshot(doc(fbDb(), "fasit", "vm"), (s) => {
        if (s.exists()) setFasit(s.data() as Fasit);
      });
    }
    return localFasit.subscribe(setFasit);
  }, [enabled]);
  return fasit;
}

export async function lagreTip(p: Prediction) {
  if (bruker()) {
    const id = `${p.uid}_${p.matchId}`;
    const ref = doc(fbDb(), "tips", id);
    await setDoc(ref, p);
    // VIKTIG: med offline-cache (persistentLocalCache) fullfører setDoc så snart
    // tippet er skrevet til lokal IndexedDB — det sier INGENTING om at serveren
    // godtok det. En regel-avvisning (kampen låst) eller mistet nett gjør at
    // skrivingen aldri når serveren, men appen viser tippet som lagret.
    // Vi leser derfor tilbake fra serveren og kaster hvis tippet ikke ligger
    // der, så UI-et kan vise «ikke bekreftet» i stedet for å lyve.
    const server = await getDocFromServer(ref);
    if (!server.exists()) {
      throw new Error(
        "Tippet nådde ikke serveren — kampen kan være låst, eller du er uten nett.",
      );
    }
    return;
  }
  const id = `${p.uid}_${p.matchId}`;
  const alle = localTips.get();
  localTips.set({ ...alle, [id]: p });
}

export async function slettTip(matchId: string, uid: string) {
  const id = `${uid}_${matchId}`;
  if (bruker()) {
    await deleteDoc(doc(fbDb(), "tips", id));
    return;
  }
  const alle = { ...localTips.get() };
  delete alle[id];
  localTips.set(alle);
}

export async function lagreSpesialTip(t: SpesialTip) {
  if (bruker()) {
    await setDoc(doc(fbDb(), "spesialtips", t.uid), t);
    return;
  }
  const alle = localSpesialTips.get();
  localSpesialTips.set({ ...alle, [t.uid]: t });
}

export async function lagreFasit(f: Fasit) {
  if (bruker()) {
    await setDoc(doc(fbDb(), "fasit", "vm"), f);
    return;
  }
  localFasit.set(f);
}

/**
 * Skriver alle 72 VM-kamper med faste IDer (A1..L6) til Firestore eller
 * localStorage. Idempotent — kan kjøres flere ganger uten å lage duplikater,
 * men overskriver hvis admin har endret en kamp manuelt.
 */
/**
 * Setter resultat = null på alle kamper. Mindre destruktivt enn full
 * reseed — bevarer starttid, lag og runde, men tømmer fasit.
 */
export async function nullstillAlleResultater(): Promise<number> {
  if (bruker()) {
    const db = fbDb();
    const snap = await getDocs(collection(db, "kamper"));
    await Promise.all(
      snap.docs.map((d) =>
        updateDoc(d.ref, { resultat: null, manuelt: false }),
      ),
    );
    return snap.size;
  }
  const kamper = localKamper.get();
  localKamper.set(kamper.map((k) => ({ ...k, resultat: null, manuelt: false })));
  return kamper.length;
}

export async function seedAlleKamper(): Promise<number> {
  const kamper = alleGruppekamper();
  if (bruker()) {
    await Promise.all(
      kamper.map((k) => {
        const { id, ...data } = k;
        return setDoc(doc(fbDb(), "kamper", id), data);
      }),
    );
  } else {
    localKamper.set(kamper);
  }
  return kamper.length;
}

export async function leggTilKamp(k: Omit<Match, "id">) {
  if (bruker()) {
    await addDoc(collection(fbDb(), "kamper"), k);
    return;
  }
  const liste = localKamper.get();
  const id = `lokal-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  localKamper.set([...liste, { ...k, id }]);
}

/**
 * Setter eller endrer klubbrolle på en bruker.
 * Krever admin eller at brukeren oppdaterer egen rad.
 */
export async function oppdaterKlubbRolle(
  uid: string,
  klubbRolle: "trener" | "spiller" | "annet",
): Promise<void> {
  if (bruker()) {
    await updateDoc(doc(fbDb(), "brukere", uid), { klubbRolle });
    return;
  }
  const map = { ...localBrukere.get() };
  const b = map[uid];
  if (!b) return;
  map[uid] = { ...b, klubbRolle };
  localBrukere.set(map);
}

/**
 * Endrer navnet på en bruker. Krever admin eller eier.
 */
export async function oppdaterBrukerNavn(
  uid: string,
  navn: string,
): Promise<void> {
  if (bruker()) {
    await updateDoc(doc(fbDb(), "brukere", uid), { navn });
    return;
  }
  const map = { ...localBrukere.get() };
  const b = map[uid];
  if (!b) return;
  map[uid] = { ...b, navn };
  localBrukere.set(map);
}

/**
 * Fryser eller tiner en bruker. Frosne brukere kan se appen men ikke
 * lagre tipps eller spesialtipps (håndheves i firestore.rules + UI).
 */
export async function oppdaterBrukerFrosset(
  uid: string,
  frosset: boolean,
): Promise<void> {
  if (bruker()) {
    await updateDoc(doc(fbDb(), "brukere", uid), { frosset });
    return;
  }
  const map = { ...localBrukere.get() };
  const b = map[uid];
  if (!b) return;
  map[uid] = { ...b, frosset };
  localBrukere.set(map);
}

/**
 * Åpner spesialtips midlertidig for én bruker (admin). `tilTid` er epoch-ms;
 * sett 0 for å lukke igjen. Brukeren kan redigere spesialtips så lenge
 * spesialAapenTil > nå. Håndheves i firestore.rules + UI.
 */
export async function oppdaterSpesialAapenTil(
  uid: string,
  tilTid: number,
): Promise<void> {
  if (bruker()) {
    await updateDoc(doc(fbDb(), "brukere", uid), { spesialAapenTil: tilTid });
    return;
  }
  const map = { ...localBrukere.get() };
  const b = map[uid];
  if (!b) return;
  map[uid] = { ...b, spesialAapenTil: tilTid };
  localBrukere.set(map);
}

/**
 * Sletter en bruker komplett — brukerdoc, alle kamptipps og spesialtips.
 * Krever admin-rettigheter i Firestore.
 */
export async function slettBruker(uid: string): Promise<void> {
  if (bruker()) {
    const db = fbDb();
    // Slett alle kamptipps
    const tipsSnap = await getDocs(
      query(collection(db, "tips"), where("uid", "==", uid)),
    );
    await Promise.all(tipsSnap.docs.map((d) => deleteDoc(d.ref)));
    // Slett spesialtip
    await deleteDoc(doc(db, "spesialtips", uid)).catch(() => undefined);
    // Slett brukerdoc
    await deleteDoc(doc(db, "brukere", uid));
    return;
  }
  // Demo-modus
  const brukere = { ...localBrukere.get() };
  delete brukere[uid];
  localBrukere.set(brukere);

  const passord = { ...localPassord.get() };
  delete passord[uid];
  localPassord.set(passord);

  const tipsAlle = { ...localTips.get() };
  for (const key of Object.keys(tipsAlle)) {
    if (tipsAlle[key].uid === uid) delete tipsAlle[key];
  }
  localTips.set(tipsAlle);

  const spesial = { ...localSpesialTips.get() };
  delete spesial[uid];
  localSpesialTips.set(spesial);

  if (localCurrent.get() === uid) localCurrent.set(null);
}

export async function settResultat(
  matchId: string,
  hjemme: number,
  borte: number,
) {
  // Manuelt satt resultat = endelig (ferdig: true), så poeng teller med en gang.
  // manuelt: true låser resultatet mot auto-synken, slik at en manuelt tastet
  // 90-min-stilling (sluttspill m/ekstraomganger) ikke blir overskrevet igjen.
  if (bruker()) {
    await updateDoc(doc(fbDb(), "kamper", matchId), {
      resultat: { hjemme, borte },
      ferdig: true,
      manuelt: true,
    });
    return;
  }
  const liste = localKamper.get();
  localKamper.set(
    liste.map((k) =>
      k.id === matchId
        ? { ...k, resultat: { hjemme, borte }, ferdig: true, manuelt: true }
        : k,
    ),
  );
}
