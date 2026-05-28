"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Liten toast for frosne brukere som prøver å skrive inn tipps.
 * Returnerer en `varsle()`-funksjon å trigge på pointer-events, og
 * en `<Toast />` å rendre ett sted i layoutet.
 */
export function useFrosseToast() {
  const [vises, setVises] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const varsle = useCallback(() => {
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
      <span>❄️</span>
      Du er frosset — kan ikke endre tips.
    </div>
  );

  return { varsle, toast };
}
