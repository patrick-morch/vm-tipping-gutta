"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile,
  User,
} from "firebase/auth";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { fbAuth, fbDb, isFirebaseConfigured } from "./firebase";
import {
  localBrukere,
  localCurrent,
  localPassord,
  seedDemo,
} from "./local-store";
import { Bruker } from "./types";

type AuthCtx = {
  user: { uid: string; email: string } | null;
  bruker: Bruker | null;
  laster: boolean;
  demoModus: boolean;
  loggInn: (epost: string, passord: string) => Promise<void>;
  registrer: (epost: string, passord: string, navn: string) => Promise<void>;
  loggUt: () => Promise<void>;
  gjørAdmin: () => void;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const fbActive = isFirebaseConfigured();
  const demoModus = !fbActive;
  const [user, setUser] = useState<{ uid: string; email: string } | null>(null);
  const [bruker, setBruker] = useState<Bruker | null>(null);
  const [laster, setLaster] = useState(true);

  useEffect(() => {
    if (fbActive) {
      let unsubBruker: (() => void) | null = null;
      const unsub = onAuthStateChanged(fbAuth(), (u: User | null) => {
        if (unsubBruker) {
          unsubBruker();
          unsubBruker = null;
        }
        if (u) {
          setUser({ uid: u.uid, email: u.email || "" });
          // Live-subscribe på egen brukerdoc — så endringer fra admin
          // (f.eks. frosset-flagg eller navn) slår inn umiddelbart uten
          // at brukeren må logge ut og inn.
          unsubBruker = onSnapshot(doc(fbDb(), "brukere", u.uid), (snap) => {
            if (snap.exists()) setBruker(snap.data() as Bruker);
            setLaster(false);
          });
        } else {
          setUser(null);
          setBruker(null);
          setLaster(false);
        }
      });
      return () => {
        if (unsubBruker) unsubBruker();
        unsub();
      };
    }

    // Demo-modus
    seedDemo();
    const unsubCurrent = localCurrent.subscribe((uid) => {
      if (!uid) {
        setUser(null);
        setBruker(null);
        setLaster(false);
        return;
      }
      const b = localBrukere.get()[uid];
      if (b) {
        setUser({ uid: b.uid, email: b.epost });
        setBruker(b);
      } else {
        setUser(null);
        setBruker(null);
      }
      setLaster(false);
    });
    const unsubBrukere = localBrukere.subscribe((map) => {
      const uid = localCurrent.get();
      if (uid && map[uid]) setBruker(map[uid]);
    });
    return () => {
      unsubCurrent();
      unsubBrukere();
    };
  }, [fbActive]);

  async function loggInn(epost: string, passord: string) {
    if (fbActive) {
      await signInWithEmailAndPassword(fbAuth(), epost, passord);
      return;
    }
    const norm = epost.trim().toLowerCase();
    const funnet = Object.values(localBrukere.get()).find(
      (b) => b.epost.toLowerCase() === norm,
    );
    if (!funnet) {
      const err: any = new Error("Bruker finnes ikke.");
      err.code = "auth/user-not-found";
      throw err;
    }
    const lagret = localPassord.get()[funnet.uid];
    if (lagret !== passord) {
      const err: any = new Error("Feil passord.");
      err.code = "auth/wrong-password";
      throw err;
    }
    localCurrent.set(funnet.uid);
  }

  async function registrer(epost: string, passord: string, navn: string) {
    if (fbActive) {
      const cred = await createUserWithEmailAndPassword(
        fbAuth(),
        epost,
        passord,
      );
      await updateProfile(cred.user, { displayName: navn });
      const ny: Bruker = {
        uid: cred.user.uid,
        epost,
        navn,
        rolle: "medlem",
        poeng: 0,
        opprettet: Date.now(),
      };
      await setDoc(doc(fbDb(), "brukere", cred.user.uid), ny);
      setBruker(ny);
      return;
    }
    const norm = epost.trim().toLowerCase();
    const finnes = Object.values(localBrukere.get()).find(
      (b) => b.epost.toLowerCase() === norm,
    );
    if (finnes) {
      const err: any = new Error("E-posten er allerede registrert.");
      err.code = "auth/email-already-in-use";
      throw err;
    }
    const uid = `lokal-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const ny: Bruker = {
      uid,
      epost,
      navn,
      rolle: Object.keys(localBrukere.get()).length === 0 ? "admin" : "medlem",
      poeng: 0,
      opprettet: Date.now(),
    };
    localBrukere.set({ ...localBrukere.get(), [uid]: ny });
    localPassord.set({ ...localPassord.get(), [uid]: passord });
    localCurrent.set(uid);
  }

  async function loggUt() {
    if (fbActive) {
      await signOut(fbAuth());
      return;
    }
    localCurrent.set(null);
  }

  function gjørAdmin() {
    if (fbActive || !user) return;
    const map = localBrukere.get();
    const b = map[user.uid];
    if (!b) return;
    localBrukere.set({ ...map, [user.uid]: { ...b, rolle: "admin" } });
  }

  return (
    <Ctx.Provider
      value={{
        user,
        bruker,
        laster,
        demoModus,
        loggInn,
        registrer,
        loggUt,
        gjørAdmin,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth må brukes inni AuthProvider");
  return ctx;
}
