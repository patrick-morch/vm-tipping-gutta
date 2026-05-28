"use client";

import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense } from "react";
import { useAuth } from "@/lib/auth-context";
import { useKamper, useMineTips } from "@/lib/data";
import { GRUPPER, NORGE, erTippbar, flagg, kortLagNavn } from "@/lib/vm-data";
import { beregnTabell, kamperMedMineTips } from "@/lib/standings";
import Skall from "@/components/Skall";
import Beskytt from "@/components/Beskytt";
import SideHeader from "@/components/SideHeader";

export default function SluttspillSide() {
  return (
    <Beskytt>
      <Skall>
        <Suspense fallback={<div className="text-muted text-sm">Laster…</div>}>
          <Sluttspill />
        </Suspense>
      </Skall>
    </Beskytt>
  );
}

function Sluttspill() {
  const search = useSearchParams();
  const router = useRouter();
  const fane = search.get("fane") === "knockout" ? "knockout" : "grupper";

  return (
    <div className="space-y-4">
      <SideHeader
        tittel="Sluttspill"
        undertittel={
          fane === "grupper"
            ? "Tipp resultater — tabellen oppdaterer seg"
            : "Knockout-runder fra 28. juni"
        }
      />

      <div className="grid grid-cols-2 gap-1.5 bg-surface border border-border rounded-2xl p-1.5">
        <button
          onClick={() => router.push("/sluttspill")}
          className={`h-10 rounded-xl text-sm font-semibold transition ${
            fane === "grupper"
              ? "bg-primary text-primaryFg"
              : "text-muted hover:text-text"
          }`}
        >
          Grupper
        </button>
        <button
          onClick={() => router.push("/sluttspill?fane=knockout")}
          className={`h-10 rounded-xl text-sm font-semibold transition ${
            fane === "knockout"
              ? "bg-primary text-primaryFg"
              : "text-muted hover:text-text"
          }`}
        >
          Knockout
        </button>
      </div>

      {fane === "grupper" ? <GrupperFane /> : <KnockoutFane />}
    </div>
  );
}

function GrupperFane() {
  const { user } = useAuth();
  const kamper = useKamper();
  const tips = useMineTips(user?.uid);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
      {GRUPPER.map((g) => {
        const gruppeKamper = kamper.filter(
          (k) => k.runde === `Gruppe ${g.id}`,
        );
        const predikert = beregnTabell(
          g.lag,
          kamperMedMineTips(gruppeKamper, tips),
        );
        const tippbare = gruppeKamper.filter(erTippbar);
        const tippet = tippbare.filter((k) => tips[k.id]).length;
        const totalTippbar = tippbare.length;
        const harNorge = g.lag.includes(NORGE);
        return (
          <Link
            key={g.id}
            href={`/sluttspill/${g.id}`}
            className={`bg-surface border rounded-2xl p-3 transition hover:border-primary ${
              harNorge ? "border-norge/40" : "border-border"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-elevated border border-border flex items-center justify-center text-xs font-bold">
                  {g.id}
                </div>
                <span className="font-semibold text-sm">Gruppe {g.id}</span>
                {harNorge && (
                  <span className="px-1.5 py-0.5 rounded-full bg-norge/15 text-norge text-[9px] font-bold">
                    NOR
                  </span>
                )}
              </div>
              <span className="text-[10px] text-muted">
                {tippet}/{totalTippbar} tippet
              </span>
            </div>
            <div className="space-y-1">
              {predikert.map((s) => (
                <div
                  key={s.lag}
                  className={`flex items-center justify-between text-xs ${
                    s.lag === NORGE ? "text-norge font-semibold" : ""
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`w-4 text-right font-bold ${
                        s.posisjon === 1
                          ? "text-success"
                          : s.posisjon === 2
                            ? "text-accent"
                            : s.posisjon === 3
                              ? "text-muted"
                              : "text-text/40"
                      }`}
                    >
                      {s.posisjon}
                    </span>
                    <span className="truncate">
                      <span className="mr-1">{flagg(s.lag)}</span>
                      {kortLagNavn(s.lag)}
                    </span>
                  </div>
                  <span className="font-mono text-muted">
                    {s.målFor}-{s.målMot} ·{" "}
                    <span className="text-text font-bold">{s.poeng}</span>
                  </span>
                </div>
              ))}
            </div>
          </Link>
        );
      })}
    </div>
  );
}

function KnockoutFane() {
  const SPOR = 16;
  const RAD_PX = 60;

  const runder = [
    { id: "32del", kort: "Sekstendedels", periode: "28. jun – 3. jul", kamper: 16 },
    { id: "16del", kort: "Åttendedels", periode: "4 – 7. jul", kamper: 8 },
    { id: "kvart", kort: "Kvartfinale", periode: "9 – 11. jul", kamper: 4 },
    { id: "semi", kort: "Semifinale", periode: "14 – 15. jul", kamper: 2 },
    { id: "finale", kort: "Finale", periode: "19. juli", kamper: 1 },
  ];

  return (
    <div className="space-y-3">
      <div className="relative bg-gradient-to-br from-surface via-surface to-elevated/30 border border-border rounded-3xl p-4 overflow-x-auto">
        {/* Subtle bakgrunnsmønster */}
        <div className="absolute inset-0 pointer-events-none opacity-30 [background-image:radial-gradient(circle_at_center,rgb(var(--primary)/0.08)_0,transparent_70%)]" />

        <div className="relative flex gap-3 min-w-max">
          {runder.map((r, ri) => {
            const radPerKamp = SPOR / r.kamper;
            return (
              <div key={r.id} className="flex-shrink-0 w-[156px]">
                <div className="mb-3 text-center">
                  <div className="text-[10px] font-bold text-muted uppercase tracking-[0.12em]">
                    {r.kort}
                  </div>
                  <div className="text-[9px] text-muted/70 mt-0.5">
                    {r.periode}
                  </div>
                </div>
                <div
                  className="grid"
                  style={{
                    gridTemplateRows: `repeat(${SPOR}, ${RAD_PX}px)`,
                  }}
                >
                  {Array.from({ length: r.kamper }).map((_, i) => {
                    const erFinale = ri === runder.length - 1;
                    return (
                      <div
                        key={i}
                        style={{
                          gridRow: `${i * radPerKamp + 1} / span ${radPerKamp}`,
                        }}
                        className="flex items-center px-1 relative"
                      >
                        {/* Connector-linje til neste runde */}
                        {ri < runder.length - 1 && (
                          <div className="absolute right-[-12px] top-1/2 w-3 h-px bg-border/60" />
                        )}
                        {/* Vertikal connector mellom pair-kamper */}
                        {ri > 0 && i % 2 === 0 && (
                          <div
                            className="absolute left-[-12px] w-px bg-border/60"
                            style={{
                              top: `${RAD_PX * (radPerKamp / 2) / 2 + 30}px`,
                              height: `${RAD_PX * radPerKamp / 2}px`,
                            }}
                          />
                        )}
                        {ri > 0 && (
                          <div className="absolute left-[-12px] top-1/2 w-3 h-px bg-border/60" />
                        )}
                        <KampKort fremhevet={erFinale} />
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Verdensmester-kolonne */}
          <div className="flex-shrink-0 w-[180px]">
            <div className="mb-3 text-center">
              <div className="text-[10px] font-bold text-gold uppercase tracking-[0.12em]">
                Verdensmester
              </div>
              <div className="text-[9px] text-gold/70 mt-0.5">19. juli</div>
            </div>
            <div
              className="grid"
              style={{
                gridTemplateRows: `repeat(${SPOR}, ${RAD_PX}px)`,
              }}
            >
              <div
                style={{ gridRow: `1 / span ${SPOR}` }}
                className="flex items-center px-1 relative"
              >
                <div className="absolute left-[-12px] top-1/2 w-3 h-px bg-gold/40" />
                <VinnerKort />
              </div>
            </div>
          </div>

          {/* Bronsefinale — off-bracket kolonne */}
          <BronseKolonne sporHøyde={SPOR * RAD_PX} />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div className="bg-surface border border-border rounded-2xl p-3 text-center text-xs text-muted">
          Kampene fylles automatisk inn etter 27. juni.
        </div>
        <Link
          href="/kamper"
          className="bg-surface border border-primary/30 rounded-2xl p-3 text-center text-xs text-primary font-semibold hover:bg-primary/5 transition"
        >
          Tipp neste kamper →
        </Link>
      </div>
    </div>
  );
}

function BronseKolonne({ sporHøyde }: { sporHøyde: number }) {
  const kamper = useKamper();
  const bronse = kamper.find((k) => k.runde === "Bronsefinale");

  return (
    <div className="flex-shrink-0 w-[150px]">
      <div className="mb-3 text-center">
        <div className="text-[10px] font-bold text-warning uppercase tracking-[0.12em]">
          Bronse
        </div>
        <div className="text-[9px] text-warning/70 mt-0.5">18. juli</div>
      </div>
      <div
        className="flex items-center justify-center"
        style={{ height: sporHøyde }}
      >
        <BronseKort kamp={bronse} />
      </div>
    </div>
  );
}

function BronseKort({
  kamp,
}: {
  kamp?: { hjemmelag: string; bortelag: string; resultat?: { hjemme: number; borte: number } | null };
}) {
  const lagH = kamp ? kortLagNavn(kamp.hjemmelag) : "TBD";
  const lagB = kamp ? kortLagNavn(kamp.bortelag) : "TBD";
  const fH = kamp ? flagg(kamp.hjemmelag) : "🏳";
  const fB = kamp ? flagg(kamp.bortelag) : "🏳";
  const scoreH = kamp?.resultat?.hjemme ?? "–";
  const scoreB = kamp?.resultat?.borte ?? "–";

  return (
    <div className="w-full bg-gradient-to-br from-warning/15 via-warning/5 to-transparent border border-warning/40 rounded-xl overflow-hidden shadow-[0_0_24px_rgb(var(--warning)/0.08)]">
      <div className="text-center pt-2 pb-1">
        <div className="text-2xl leading-none">🥉</div>
      </div>
      <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 border-t border-warning/15">
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <span className="text-sm flex-shrink-0">{fH}</span>
          <span className="text-[11px] text-muted truncate">{lagH}</span>
        </div>
        <span className="text-xs text-muted font-mono tabular-nums w-4 text-right">
          {scoreH}
        </span>
      </div>
      <div className="flex items-center justify-between gap-2 px-2.5 py-1.5">
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <span className="text-sm flex-shrink-0">{fB}</span>
          <span className="text-[11px] text-muted truncate">{lagB}</span>
        </div>
        <span className="text-xs text-muted font-mono tabular-nums w-4 text-right">
          {scoreB}
        </span>
      </div>
    </div>
  );
}

function KampKort({ fremhevet }: { fremhevet?: boolean }) {
  return (
    <div
      className={`w-full rounded-xl overflow-hidden transition-all ${
        fremhevet
          ? "bg-gradient-to-br from-gold/15 to-transparent border border-gold/30 shadow-[0_0_20px_rgb(var(--gold)/0.08)]"
          : "bg-elevated border border-border hover:border-primary/30"
      }`}
    >
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border/40">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="w-5 h-5 rounded-full bg-border/60 border border-border flex-shrink-0" />
          <span className="text-[11px] text-muted truncate">TBD</span>
        </div>
        <span className="text-xs text-muted font-mono tabular-nums w-4 text-right">
          –
        </span>
      </div>
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="w-5 h-5 rounded-full bg-border/60 border border-border flex-shrink-0" />
          <span className="text-[11px] text-muted truncate">TBD</span>
        </div>
        <span className="text-xs text-muted font-mono tabular-nums w-4 text-right">
          –
        </span>
      </div>
    </div>
  );
}

function VinnerKort() {
  return (
    <div className="relative w-full rounded-2xl overflow-hidden">
      {/* Glow */}
      <div className="absolute inset-0 bg-gradient-to-br from-gold/30 via-gold/10 to-transparent" />
      <div className="absolute -inset-4 bg-gold/10 blur-2xl pointer-events-none" />

      <div className="relative border-2 border-gold/50 rounded-2xl p-4 text-center bg-bg/40 backdrop-blur">
        <div className="text-4xl mb-2 drop-shadow-[0_2px_8px_rgb(var(--gold)/0.4)]">
          🏆
        </div>
        <div className="text-[9px] text-gold uppercase tracking-[0.15em] font-bold mb-1">
          Verdensmester
        </div>
        <div className="text-sm font-bold text-gold/80">TBD</div>
        <div className="mt-2 pt-2 border-t border-gold/20">
          <div className="text-[9px] text-gold/60 uppercase tracking-wider">
            Finale
          </div>
          <div className="text-[10px] text-muted">19. juli</div>
        </div>
      </div>
    </div>
  );
}
