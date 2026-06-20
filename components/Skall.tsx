"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useTema } from "@/lib/theme";
import { ReactNode } from "react";

export default function Skall({ children }: { children: ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const { bruker, loggUt, demoModus } = useAuth();
  const { tema, bytt } = useTema();

  const initialer = bruker?.navn
    ?.split(" ")
    .map((d) => d[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const nav = [
    { href: "/kamper", tittel: "Kamper", ikon: "⚽" },
    { href: "/sluttspill", tittel: "Bracket", ikon: "🏆" },
    { href: "/spesial", tittel: "Spesial", ikon: "⭐" },
    { href: "/ledertavle", tittel: "Tabell", ikon: "🏅" },
    { href: "/utvikling", tittel: "Graf", ikon: "📈" },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      {demoModus && (
        <div className="bg-warning/10 text-warning text-center text-xs py-1.5 border-b border-warning/20">
          Demo-modus — data lagres bare i nettleseren
        </div>
      )}
      <header className="sticky top-0 z-10 bg-bg/80 backdrop-blur-xl border-b border-border">
        <div className="max-w-[480px] md:max-w-2xl lg:max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <Link href="/kamper" className="flex items-center gap-2.5 flex-shrink-0">
            <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center text-base shadow-glow">
              ⚽
            </span>
            <span className="leading-none">
              <span className="block font-bold tracking-tight">VM-tipping</span>
              <span className="block text-[9px] uppercase tracking-[0.2em] font-bold text-muted mt-0.5">
                Gutta · 2026
              </span>
            </span>
          </Link>
          {/* Hoved-nav inne i headeren på desktop */}
          <nav className="hidden md:flex items-center gap-1 flex-1 justify-center">
            {nav.map((n) => {
              const aktiv = path === n.href;
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className={`h-9 px-3 rounded-full text-sm font-medium transition flex items-center gap-1.5 ${
                    aktiv
                      ? "bg-primary/15 text-primary shadow-[inset_0_0_0_1px_rgb(var(--primary)/0.3)]"
                      : "text-muted hover:text-text hover:bg-elevated"
                  }`}
                >
                  <span className="hidden lg:inline text-base leading-none">
                    {n.ikon}
                  </span>
                  <span>{n.tittel}</span>
                </Link>
              );
            })}
          </nav>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={bytt}
              className="w-9 h-9 rounded-full bg-elevated border border-border text-base hover:border-primary transition flex items-center justify-center"
              title="Bytt tema"
              aria-label="Bytt tema"
            >
              {tema === "mørk" ? "☀️" : "🌙"}
            </button>
            {bruker?.rolle === "admin" && (
              <Link
                href="/admin"
                className={`h-9 px-3 rounded-full border text-xs font-medium flex items-center transition ${
                  path === "/admin"
                    ? "bg-primary text-primaryFg border-primary"
                    : "bg-elevated border-border hover:border-primary"
                }`}
              >
                Admin
              </Link>
            )}
            <button
              onClick={async () => {
                await loggUt();
                router.push("/logg-inn");
              }}
              className="w-9 h-9 rounded-full bg-elevated border border-border text-sm font-semibold hover:border-primary transition"
              title="Logg ut"
            >
              {initialer || "?"}
            </button>
          </div>
        </div>
      </header>

      <main
        className={`anim-fade-up flex-1 w-full mx-auto px-4 py-4 pb-24 md:pb-10 ${
          path === "/sluttspill" || path === "/sluttspill/"
            ? "max-w-[480px] md:max-w-2xl lg:max-w-none lg:px-8"
            : "max-w-[480px] md:max-w-2xl lg:max-w-6xl"
        }`}
      >
        {children}
      </main>

      {/* Bunn-nav på mobil — skjules når hoved-nav vises i headeren */}
      <nav className="fixed bottom-0 left-0 right-0 bg-surface/85 backdrop-blur-xl border-t border-border md:hidden pb-[env(safe-area-inset-bottom)]">
        <div className="max-w-[480px] mx-auto grid grid-cols-5">
          {nav.map((n) => {
            const aktiv = path === n.href;
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={aktiv ? "page" : undefined}
                className={`pt-1.5 pb-2 flex flex-col items-center gap-1 text-[10px] font-medium transition active:scale-95 ${
                  aktiv ? "text-primary" : "text-muted hover:text-text"
                }`}
              >
                <span
                  className={`flex items-center justify-center w-11 h-7 rounded-full text-lg leading-none transition ${
                    aktiv
                      ? "bg-primary/15 shadow-[0_0_14px_rgb(var(--primary)/0.35)]"
                      : "bg-transparent"
                  }`}
                >
                  {n.ikon}
                </span>
                <span>{n.tittel}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
