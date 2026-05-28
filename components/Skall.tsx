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
    { href: "/poeng", tittel: "Poeng", ikon: "📖" },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      {demoModus && (
        <div className="bg-warning/10 text-warning text-center text-xs py-1.5 border-b border-warning/20">
          Demo-modus — data lagres bare i nettleseren
        </div>
      )}
      <header className="sticky top-0 z-10 bg-bg/85 backdrop-blur border-b border-border">
        <div className="max-w-[480px] mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/kamper" className="flex items-center gap-2">
            <span className="font-semibold">VM-tipping</span>
          </Link>
          <div className="flex items-center gap-2">
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
        className={`flex-1 w-full mx-auto px-4 py-4 pb-24 ${
          path === "/sluttspill" || path === "/sluttspill/"
            ? "max-w-[480px] lg:max-w-6xl"
            : "max-w-[480px]"
        }`}
      >
        {children}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-surface border-t border-border">
        <div className="max-w-[480px] mx-auto grid grid-cols-5">
          {nav.map((n) => {
            const aktiv = path === n.href;
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`py-2.5 text-center text-[10px] font-medium transition flex flex-col items-center gap-0.5 ${
                  aktiv ? "text-primary" : "text-muted hover:text-text"
                }`}
              >
                <span className="text-lg leading-none">{n.ikon}</span>
                <span>{n.tittel}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
