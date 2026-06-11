"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const STANDARD_MELDING = "Du er frosset — kan ikke endre tips.";

/**
 * Liten toast for når et felt ikke kan endres — enten fordi brukeren er
 * frosset, eller fordi tipsene/kampen er låst. Returnerer en `varsle(melding?)`
 * å trigge på pointer-events, og en `<Toast />` å rendre ett sted i layoutet.
 */
export function useFrosseToast() {
  const [vises, setVises] = useState(false);
  const [melding, setMelding] = useState(STANDARD_MELDING);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const varsle = useCallback((tekst: string = STANDARD_MELDING) => {
    setMelding(tekst);
    setVises(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setVises(false), 2400);
  }, []);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const toast = (
    <div
      className={`fixed left-1/2 -translate-x-1/2 bottom-24 z-50 px-4 py-2.5 rounded-2xl shadow-lg text-sm font-semibold flex items-center gap-2 transition-all duration-200 pointer-events-none ${
        vises ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
      }`}
      style={{
        backgroundColor: "rgb(var(--warning))",
        color: "rgb(var(--bg))",
      }}
      role="status"
      aria-live="polite"
    >
      <span>🔒</span>
      {melding}
    </div>
  );

  return { varsle, toast };
}
