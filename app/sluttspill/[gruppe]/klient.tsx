"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useFrosseToast } from "@/components/FrosseToast";
import {
  useKamper,
  useMineTips,
  lagreTip,
  slettTip,
} from "@/lib/data";
import {
  GRUPPER,
  NORGE,
  erNorgeKamp,
  erTippbar,
  flagg,
  kampErLåst,
  kortLagNavn,
} from "@/lib/vm-data";
import { beregnTabell, kamperMedMineTips } from "@/lib/standings";
import { beregnPoeng } from "@/lib/types";
import { Match, Prediction } from "@/lib/types";
import Skall from "@/components/Skall";
import Beskytt from "@/components/Beskytt";
import AlleTipsForKamp from "@/components/AlleTipsForKamp";

export default function GruppeDetaljSide() {
  return (
    <Beskytt>
      <Skall>
        <GruppeDetalj />
      </Skall>
    </Beskytt>
  );
}

function GruppeDetalj() {
  const params = useParams();
  const router = useRouter();
  const gruppeId = String(params.gruppe).toUpperCase();
  const gruppe = GRUPPER.find((g) => g.id === gruppeId);
  const { user, bruker } = useAuth();
  const alleKamper = useKamper();
  const tips = useMineTips(user?.uid);

  if (!gruppe) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => router.push("/sluttspill")}
          className="text-sm text-muted hover:text-text"
        >
          ← Tilbake
        </button>
        <div className="bg-surface border border-border rounded-2xl p-6 text-center text-muted text-sm">
          Fant ingen gruppe {gruppeId}.
        </div>
      </div>
    );
  }

  const kamper = alleKamper
    .filter((k) => k.runde === `Gruppe ${gruppe.id}`)
    .sort((a, b) => a.starttid - b.starttid);

  // Min predikerte tabell (basert på mine tipps; for kamper jeg ikke har
  // tippet faller vi tilbake på faktisk resultat om finnes)
  const predikertTabell = beregnTabell(
    gruppe.lag,
    kamperMedMineTips(kamper, tips),
  );

  // Faktisk tabell (kun reelle resultater)
  const faktiskTabell = beregnTabell(gruppe.lag, kamper);
  const harFakta = kamper.some((k) => k.resultat);

  const harNorge = gruppe.lag.includes(NORGE);

  const frosset = bruker?.frosset === true;
  const { varsle, toast } = useFrosseToast();

  async function lagre(matchId: string, h: number, b: number) {
    if (!user || !bruker || !gruppe || frosset) return;
    await lagreTip({
      matchId,
      uid: user.uid,
      navn: bruker.navn,
      hjemme: h,
      borte: b,
      lagretTid: Date.now(),
    });
  }

  async function slett(matchId: string) {
    if (!user || frosset) return;
    await slettTip(matchId, user.uid);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push("/sluttspill")}
          className="w-9 h-9 rounded-full bg-elevated border border-border flex items-center justify-center text-sm hover:border-primary transition"
          aria-label="Tilbake"
        >
          ←
        </button>
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            Gruppe {gruppe.id}
            {harNorge && (
              <span className="px-2 py-0.5 rounded-full bg-norge/15 text-norge text-[10px] font-bold">
                NORGE
              </span>
            )}
          </h1>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <TabellKort
          tittel="Min tabell"
          undertittel="Basert på dine tipps"
          tabell={predikertTabell}
          farge="primary"
        />
        <TabellKort
          tittel="Faktisk tabell"
          undertittel={harFakta ? "Reelle resultater" : "Ingen kamper spilt ennå"}
          tabell={faktiskTabell}
          farge="muted"
          dimmet={!harFakta}
        />
      </div>

      {frosset && (
        <div className="bg-warning/10 border border-warning/30 text-warning text-sm rounded-2xl px-4 py-3 flex items-center gap-2">
          <span className="text-lg">❄️</span>
          Du er frosset av admin. Du kan se kampene, men ikke tippe.
        </div>
      )}

      <div
        className="space-y-3"
        onPointerDownCapture={
          frosset
            ? (e) => {
                const t = e.target as HTMLElement;
                if (t.tagName === "INPUT" || t.closest("input")) {
                  e.preventDefault();
                  e.stopPropagation();
                  varsle();
                }
              }
            : undefined
        }
      >
        <h2 className="font-semibold text-sm uppercase tracking-wider text-muted">
          Kamper
        </h2>
        {kamper.map((kamp) => (
          <KampRad
            key={kamp.id}
            kamp={kamp}
            tip={tips[kamp.id]}
            frosset={frosset}
            onLagre={(h, b) => lagre(kamp.id, h, b)}
            onSlett={() => slett(kamp.id)}
          />
        ))}
      </div>

      {toast}
    </div>
  );
}

function TabellKort({
  tittel,
  undertittel,
  tabell,
  farge,
  dimmet,
}: {
  tittel: string;
  undertittel: string;
  tabell: ReturnType<typeof beregnTabell>;
  farge: "primary" | "muted";
  dimmet?: boolean;
}) {
  return (
    <div
      className={`bg-surface border rounded-2xl overflow-hidden ${
        farge === "primary" ? "border-primary/30" : "border-border"
      } ${dimmet ? "opacity-60" : ""}`}
    >
      <div className="px-3 py-2 border-b border-border">
        <div className="text-sm font-semibold">{tittel}</div>
        <div className="text-[10px] text-muted">{undertittel}</div>
      </div>
      <div className="px-1 py-1">
        {tabell.map((s) => (
          <div
            key={s.lag}
            className={`grid grid-cols-[20px_1fr_30px_36px] gap-1 px-2 py-1.5 items-center text-xs ${
              s.lag === NORGE ? "text-norge font-semibold" : ""
            }`}
          >
            <span
              className={`text-right font-bold ${
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
            <span className="text-right text-[10px] font-mono text-muted">
              {s.målFor}-{s.målMot}
            </span>
            <span className="text-right font-bold">{s.poeng}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function KampRad({
  kamp,
  tip,
  frosset,
  onLagre,
  onSlett,
}: {
  kamp: Match;
  tip?: Prediction;
  frosset?: boolean;
  onLagre: (h: number, b: number) => Promise<void>;
  onSlett: () => Promise<void>;
}) {
  const [hjem, setHjem] = useState(tip ? String(tip.hjemme) : "");
  const [bort, setBort] = useState(tip ? String(tip.borte) : "");
  useEffect(() => {
    if (tip) {
      setHjem(String(tip.hjemme));
      setBort(String(tip.borte));
    } else {
      setHjem("");
      setBort("");
    }
  }, [tip]);

  const låst = kampErLåst(kamp);
  const tippbar = erTippbar(kamp);
  const disabled = låst || !tippbar || Boolean(frosset);
  const gyldig =
    hjem !== "" && bort !== "" && Number(hjem) >= 0 && Number(bort) >= 0;
  const tom = hjem === "" && bort === "";
  const erNorge = erNorgeKamp(kamp);
  const uendret =
    tip && gyldig && Number(hjem) === tip.hjemme && Number(bort) === tip.borte;

  useEffect(() => {
    if (disabled || uendret) return;
    if (gyldig) {
      const t = setTimeout(() => onLagre(Number(hjem), Number(bort)), 500);
      return () => clearTimeout(t);
    }
    if (tom && tip) {
      const t = setTimeout(() => onSlett(), 500);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hjem, bort, gyldig, tom, uendret, disabled, Boolean(tip)]);

  const dato = new Date(kamp.starttid);
  const datoStr = dato.toLocaleDateString("nb-NO", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
  const klokke = dato.toLocaleTimeString("nb-NO", {
    hour: "2-digit",
    minute: "2-digit",
  });

  // Sammenligning med fasit
  let status: {
    tekst: string;
    farge: "success" | "accent" | "danger" | "muted";
    poeng: number;
  } | null = null;
  if (kamp.resultat) {
    if (!tip) {
      status = { tekst: "Ingen tipp", farge: "muted", poeng: 0 };
    } else {
      const p = beregnPoeng(tip, kamp.resultat, kamp.bonusFaktor || 1);
      if (p >= 3) {
        status = {
          tekst: `Eksakt! +${p}p`,
          farge: "success",
          poeng: p,
        };
      } else if (p >= 1) {
        status = {
          tekst: `Riktig utfall +${p}p`,
          farge: "accent",
          poeng: p,
        };
      } else {
        status = { tekst: "Feil tipp", farge: "danger", poeng: 0 };
      }
    }
  }

  return (
    <div
      className={`relative bg-surface border rounded-2xl p-3 ${
        !tippbar
          ? "border-border/40 opacity-60"
          : erNorge
            ? "border-norge/40"
            : "border-border"
      }`}
    >
      <div className="flex items-center justify-between text-[11px] text-muted mb-2">
        <div className="flex items-center gap-2">
          <span>
            {datoStr} · {klokke}
          </span>
          {kamp.bonusFaktor > 1 && tippbar && (
            <span className="px-1.5 py-0.5 rounded-full bg-norge/15 text-norge font-bold text-[9px]">
              ×{kamp.bonusFaktor}
            </span>
          )}
        </div>
        {!tippbar ? (
          <span className="text-[9px] uppercase tracking-wider font-bold text-muted/70 bg-elevated border border-border rounded px-1.5 py-0.5">
            Ikke valgt
          </span>
        ) : (
          låst &&
          !kamp.resultat && (
            <span className="text-warning font-semibold">Låst</span>
          )
        )}
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <div className="text-right font-medium text-sm min-w-0 truncate">
          <span>{kortLagNavn(kamp.hjemmelag)}</span>{" "}
          <span className="text-base">{flagg(kamp.hjemmelag)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <ScoreIn verdi={hjem} onChange={setHjem} låst={disabled} />
          <span className="text-muted text-xs">–</span>
          <ScoreIn verdi={bort} onChange={setBort} låst={disabled} />
        </div>
        <div className="text-left font-medium text-sm min-w-0 truncate">
          <span className="text-base">{flagg(kamp.bortelag)}</span>{" "}
          <span>{kortLagNavn(kamp.bortelag)}</span>
        </div>
      </div>
      {kamp.resultat && (
        <div className="mt-2 pt-2 border-t border-border space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted">Fasit:</span>
            <span className="font-bold tabular-nums">
              {kamp.resultat.hjemme} – {kamp.resultat.borte}
            </span>
          </div>
          {status && (
            <div
              className={`text-xs font-semibold ${
                status.farge === "success"
                  ? "text-success"
                  : status.farge === "accent"
                    ? "text-accent"
                    : status.farge === "danger"
                      ? "text-danger"
                      : "text-muted"
              }`}
            >
              {status.tekst}
            </div>
          )}
        </div>
      )}
      {låst && <AlleTipsForKamp kamp={kamp} />}
    </div>
  );
}

function ScoreIn({
  verdi,
  onChange,
  låst,
}: {
  verdi: string;
  onChange: (v: string) => void;
  låst: boolean;
}) {
  return (
    <input
      type="number"
      inputMode="numeric"
      min={0}
      max={20}
      disabled={låst}
      value={verdi}
      onChange={(e) =>
        onChange(e.target.value.replace(/[^0-9]/g, "").slice(0, 2))
      }
      className="w-11 h-10 text-center text-lg font-bold rounded-lg bg-elevated border border-border focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
    />
  );
}
