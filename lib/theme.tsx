"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";

type Tema = "lys" | "mørk";

type Ctx = {
  tema: Tema;
  settTema: (t: Tema) => void;
  bytt: () => void;
};

const ThemeCtx = createContext<Ctx | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [tema, setTema] = useState<Tema>("mørk");
  const [klar, setKlar] = useState(false);

  useEffect(() => {
    const lagret = localStorage.getItem("vmt.tema") as Tema | null;
    if (lagret === "lys" || lagret === "mørk") {
      setTema(lagret);
    } else {
      const mørk = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
      setTema(mørk ? "mørk" : "lys");
    }
    setKlar(true);
  }, []);

  useEffect(() => {
    if (!klar) return;
    document.documentElement.dataset.theme = tema === "mørk" ? "dark" : "light";
    localStorage.setItem("vmt.tema", tema);
  }, [tema, klar]);

  return (
    <ThemeCtx.Provider
      value={{
        tema,
        settTema: setTema,
        bytt: () => setTema((t) => (t === "mørk" ? "lys" : "mørk")),
      }}
    >
      {children}
    </ThemeCtx.Provider>
  );
}

export function useTema() {
  const ctx = useContext(ThemeCtx);
  if (!ctx) throw new Error("useTema må brukes inni ThemeProvider");
  return ctx;
}
