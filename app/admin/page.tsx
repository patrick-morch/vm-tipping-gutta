"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import {
  useKamper,
  useBrukere,
  useFasit,
  seedAlleKamper,
  slettBruker,
  oppdaterBrukerNavn,
  oppdaterBrukerFrosset,
  oppdaterSpesialAapenTil,
  nullstillAlleResultater,
  lagreFasit,
} from "@/lib/data";
import { synkResultaterKlient } from "@/lib/sync-klient";
import { GRUPPER } from "@/lib/vm-data";
import SpillerVelger from "@/components/SpillerVelger";
import type { RonaldoVsMessi } from "@/lib/types";
import { Bruker, Match } from "@/lib/types";
import Skall from "@/components/Skall";
import Beskytt from "@/components/Beskytt";

export default function AdminSide() {
  return (
    <Beskytt>
      <Skall>
        <Admin />
      </Skall>
    </Beskytt>
  );
}

function Admin() {
  const { bruker } = useAuth();
  const router = useRouter();
  const kamper = useKamper();
  const brukere = useBrukere();

  useEffect(() => {
    if (bruker && bruker.rolle !== "admin") router.replace("/kamper");
  }, [bruker, router]);

  if (!bruker || bruker.rolle !== "admin") {
    return <div className="text-muted text-sm">Sjekker tilgang…</div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Admin</h1>

      <SeedSeksjon kamper={kamper} />

      <SyncSeksjon />

      <FasitSeksjon />

      <MedlemmerSeksjon brukere={brukere} egenUid={bruker.uid} />
    </div>
  );
}

const SYNC_WORKFLOW_URL =
  "https://github.com/patrick-morch/vm-tipping-gutta/actions/workflows/sync-resultater.yml";

function SyncSeksjon() {
  const [lagrer, setLagrer] = useState(false);
  const [melding, setMelding] = useState<string | null>(null);
  const [feil, setFeil] = useState(false);

  async function synkNå() {
    setLagrer(true);
    setMelding(null);
    setFeil(false);
    try {
      const r = await synkResultaterKlient();
      setMelding(
        `✓ Ferdig — oppdaterte ${r.oppdatert} kamp${r.oppdatert === 1 ? "" : "er"} (${r.ferdige} ferdigspilt). Ledertavla er regnet på nytt.`,
      );
    } catch (e) {
      setFeil(true);
      setMelding(`Feil: ${e instanceof Error ? e.message : "ukjent feil"}`);
    } finally {
      setLagrer(false);
    }
  }

  return (
    <section className="bg-surface border border-border rounded-2xl p-4 space-y-3">
      <div>
        <h2 className="font-semibold">Synk &amp; poeng</h2>
        <p className="text-xs text-muted mt-0.5">
          Synken kjører automatisk så ofte GitHub tillater i kampvinduet. Trykk{" "}
          <strong>Synk nå</strong> for å hente siste resultater fra TheSportsDB
          og regne ut ledertavla med en gang.
        </p>
      </div>
      <button
        type="button"
        onClick={synkNå}
        disabled={lagrer}
        className="w-full h-11 rounded-xl bg-primary text-primaryFg font-semibold text-sm disabled:opacity-60 transition"
      >
        {lagrer ? "Synker…" : "🔄 Synk nå"}
      </button>
      {melding && (
        <div
          className={`text-xs rounded-xl px-3 py-2.5 border ${
            feil
              ? "bg-danger/10 border-danger/30 text-danger"
              : "bg-success/10 border-success/30 text-success"
          }`}
        >
          {melding}
        </div>
      )}
      <a
        href={SYNC_WORKFLOW_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="block text-center text-[11px] text-muted hover:text-text underline"
      >
        Se GitHub-synkloggen →
      </a>
    </section>
  );
}

function erEkteResultat(k: Match): boolean {
  return (
    k.resultat != null &&
    typeof k.resultat === "object" &&
    typeof k.resultat.hjemme === "number" &&
    typeof k.resultat.borte === "number"
  );
}

function SeedSeksjon({ kamper }: { kamper: Match[] }) {
  const [åpenTilbakestill, setÅpenTilbakestill] = useState(false);
  const [åpenNullstill, setÅpenNullstill] = useState(false);
  const [visDebug, setVisDebug] = useState(false);
  const tilstede = kamper.length;
  const trenger = 72;
  const ferdig = tilstede >= trenger;
  const trengerSeed = !ferdig;

  const medResultat = kamper.filter(erEkteResultat);
  const nå = Date.now();
  const fremtidigeMedResultat = medResultat.filter((k) => k.starttid > nå);

  return (
    <section
      className={`border rounded-2xl p-4 ${
        trengerSeed
          ? "bg-warning/5 border-warning/30"
          : "bg-success/5 border-success/30"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold flex items-center gap-2">
            {trengerSeed ? "⚠" : "✓"} VM-kamper i databasen
          </h2>
          <p className="text-xs text-muted mt-0.5">
            {tilstede}/{trenger} kamper · {medResultat.length} med resultat.
          </p>
          {fremtidigeMedResultat.length > 0 && (
            <p className="text-[11px] text-warning mt-1.5">
              ⚠ {fremtidigeMedResultat.length} kamper som ikke har startet
              ennå har resultat — sannsynligvis testdata.{" "}
              <button
                onClick={() => setVisDebug((v) => !v)}
                className="underline hover:text-text"
              >
                {visDebug ? "skjul" : "vis"}
              </button>
            </p>
          )}
          {!trengerSeed && fremtidigeMedResultat.length === 0 && (
            <p className="text-[11px] text-muted mt-1.5">
              Kampene styres av auto-sync. Bare bruk knappene hvis du må
              rydde manuelt.
            </p>
          )}
        </div>
        {trengerSeed && (
          <button
            onClick={() => setÅpenTilbakestill(true)}
            className="h-10 px-4 rounded-xl bg-primary text-primaryFg text-sm font-semibold hover:bg-primaryDark whitespace-nowrap"
          >
            Seed VM-kamper
          </button>
        )}
      </div>

      {visDebug && fremtidigeMedResultat.length > 0 && (
        <div className="mt-3 bg-elevated border border-border rounded-xl p-3 max-h-48 overflow-y-auto text-xs space-y-1 font-mono">
          {fremtidigeMedResultat.map((k) => (
            <div key={k.id} className="flex justify-between">
              <span>
                {k.id}: {k.hjemmelag} vs {k.bortelag}
              </span>
              <span className="text-warning">
                {k.resultat?.hjemme}–{k.resultat?.borte}
              </span>
            </div>
          ))}
        </div>
      )}

      {!trengerSeed && (
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => setÅpenNullstill(true)}
            disabled={medResultat.length === 0}
            className="flex-1 h-9 px-3 rounded-lg bg-warning/10 border border-warning/30 text-warning text-xs font-semibold hover:bg-warning/15 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Nullstill resultater
          </button>
          <button
            onClick={() => setÅpenTilbakestill(true)}
            className="flex-1 h-9 px-3 rounded-lg bg-danger/10 border border-danger/30 text-danger text-xs font-semibold hover:bg-danger/15"
          >
            Tilbakestill alt
          </button>
        </div>
      )}

      {åpenTilbakestill && (
        <TilbakestillModal
          harResultater={medResultat.length}
          onAvbryt={() => setÅpenTilbakestill(false)}
        />
      )}
      {åpenNullstill && (
        <NullstillModal
          antall={medResultat.length}
          onAvbryt={() => setÅpenNullstill(false)}
        />
      )}
    </section>
  );
}

function NullstillModal({
  antall,
  onAvbryt,
}: {
  antall: number;
  onAvbryt: () => void;
}) {
  const [bekreft, setBekreft] = useState("");
  const [laster, setLaster] = useState(false);
  const [feil, setFeil] = useState<string | null>(null);
  const KODEORD = "NULLSTILL";
  const kanKjøre = bekreft.trim() === KODEORD;

  async function utfør() {
    if (!kanKjøre) return;
    setLaster(true);
    setFeil(null);
    try {
      await nullstillAlleResultater();
      onAvbryt();
    } catch (e: any) {
      setFeil(e?.message || "Nullstilling feilet.");
      setLaster(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center px-4"
      onClick={onAvbryt}
    >
      <div
        className="bg-surface border border-border rounded-2xl p-5 w-full max-w-sm space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <div className="text-3xl mb-2">🧹</div>
          <h3 className="text-lg font-semibold">Nullstill alle resultater?</h3>
          <p className="text-sm text-muted mt-1">
            Sletter <span className="text-warning font-semibold">{antall}</span>{" "}
            kampresultat. Lag, datoer og runder beholdes. Auto-sync vil legge
            inn resultater igjen etterhvert som kamper spilles.
          </p>
        </div>

        <div>
          <label className="block text-xs text-muted mb-1.5">
            Skriv{" "}
            <span className="text-text font-bold tracking-wide">{KODEORD}</span>{" "}
            for å bekrefte:
          </label>
          <input
            type="text"
            value={bekreft}
            onChange={(e) => setBekreft(e.target.value)}
            autoFocus
            placeholder={KODEORD}
            className="w-full h-11 px-3 rounded-xl bg-elevated border border-border focus:border-warning focus:outline-none focus:ring-2 focus:ring-warning/20 font-mono tracking-wide"
          />
        </div>

        {feil && (
          <div className="text-sm text-danger bg-danger/10 border border-danger/30 rounded-xl px-3 py-2">
            {feil}
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={onAvbryt}
            disabled={laster}
            className="flex-1 h-11 rounded-xl border border-border bg-elevated text-sm font-semibold hover:border-primary transition disabled:opacity-50"
          >
            Avbryt
          </button>
          <button
            onClick={utfør}
            disabled={!kanKjøre || laster}
            className="flex-1 h-11 rounded-xl bg-warning text-white text-sm font-semibold hover:bg-warning/90 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {laster ? "Nullstiller…" : "Nullstill resultater"}
          </button>
        </div>
      </div>
    </div>
  );
}

function TilbakestillModal({
  harResultater,
  onAvbryt,
}: {
  harResultater: number;
  onAvbryt: () => void;
}) {
  const [bekreft, setBekreft] = useState("");
  const [laster, setLaster] = useState(false);
  const [feil, setFeil] = useState<string | null>(null);
  const KODEORD = "TILBAKESTILL";
  const kanKjøre = bekreft.trim() === KODEORD;

  async function utfør() {
    if (!kanKjøre) return;
    setLaster(true);
    setFeil(null);
    try {
      await seedAlleKamper();
      onAvbryt();
    } catch (e: any) {
      setFeil(e?.message || "Tilbakestilling feilet.");
      setLaster(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center px-4"
      onClick={onAvbryt}
    >
      <div
        className="bg-surface border border-border rounded-2xl p-5 w-full max-w-sm space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <div className="text-3xl mb-2">⚠️</div>
          <h3 className="text-lg font-semibold">Tilbakestill alle kamper?</h3>
          <p className="text-sm text-muted mt-1">
            Alle 72 kampene skrives på nytt med ren tilstand. Dato, klokkeslett
            og lag tilbakestilles til den hardkodede VM 2026-tabellen.
          </p>
        </div>

        <div className="bg-danger/10 border border-danger/30 rounded-xl p-3 text-sm space-y-2">
          <div className="text-danger font-semibold">Dette overskrives:</div>
          <ul className="text-xs text-muted space-y-0.5 ml-4 list-disc">
            <li>
              {harResultater > 0 ? (
                <>
                  <span className="text-danger font-semibold">
                    {harResultater} kampresultat
                  </span>{" "}
                  blir slettet
                </>
              ) : (
                "Ingen resultater er satt — de blir uansett satt til tomt"
              )}
            </li>
            <li>Eventuelle manuelle datojusteringer går tapt</li>
            <li>Auto-sync vil legge inn resultater på nytt etterhvert</li>
          </ul>
        </div>

        <div>
          <label className="block text-xs text-muted mb-1.5">
            Skriv{" "}
            <span className="text-text font-bold tracking-wide">{KODEORD}</span>{" "}
            for å bekrefte:
          </label>
          <input
            type="text"
            value={bekreft}
            onChange={(e) => setBekreft(e.target.value)}
            autoFocus
            placeholder={KODEORD}
            className="w-full h-11 px-3 rounded-xl bg-elevated border border-border focus:border-danger focus:outline-none focus:ring-2 focus:ring-danger/20 font-mono tracking-wide"
          />
        </div>

        {feil && (
          <div className="text-sm text-danger bg-danger/10 border border-danger/30 rounded-xl px-3 py-2">
            {feil}
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={onAvbryt}
            disabled={laster}
            className="flex-1 h-11 rounded-xl border border-border bg-elevated text-sm font-semibold hover:border-primary transition disabled:opacity-50"
          >
            Avbryt
          </button>
          <button
            onClick={utfør}
            disabled={!kanKjøre || laster}
            className="flex-1 h-11 rounded-xl bg-danger text-white text-sm font-semibold hover:bg-danger/90 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {laster ? "Tilbakestiller…" : "Tilbakestill permanent"}
          </button>
        </div>
      </div>
    </div>
  );
}

function FasitSeksjon() {
  const fasit = useFasit();
  const [toppscorer, setToppscorer] = useState("");
  const [toppassist, setToppassist] = useState("");
  const [vmVinner, setVmVinner] = useState("");
  const [ronaldoVsMessi, setRonaldoVsMessi] = useState<RonaldoVsMessi>("");
  const [lagrer, setLagrer] = useState(false);
  const [klart, setKlart] = useState(false);

  useEffect(() => {
    setToppscorer(fasit.toppscorer || "");
    setToppassist(fasit.toppassist || "");
    setVmVinner(fasit.vmVinner || "");
    setRonaldoVsMessi(fasit.ronaldoVsMessi || "");
  }, [
    fasit.toppscorer,
    fasit.toppassist,
    fasit.vmVinner,
    fasit.ronaldoVsMessi,
  ]);

  async function lagre() {
    setLagrer(true);
    try {
      await lagreFasit({
        ...fasit,
        vmVinner: vmVinner.trim(),
        toppscorer: toppscorer.trim(),
        toppassist: toppassist.trim(),
        ronaldoVsMessi,
      });
      setKlart(true);
      setTimeout(() => setKlart(false), 1800);
    } finally {
      setLagrer(false);
    }
  }

  const endret =
    vmVinner.trim() !== (fasit.vmVinner || "") ||
    toppscorer.trim() !== (fasit.toppscorer || "") ||
    toppassist.trim() !== (fasit.toppassist || "") ||
    ronaldoVsMessi !== (fasit.ronaldoVsMessi || "");

  const alleLag = GRUPPER.flatMap((g) => g.lag).sort();

  return (
    <section className="bg-surface border border-border rounded-2xl p-4 space-y-4">
      <div>
        <h2 className="font-semibold">Fasit</h2>
        <p className="text-xs text-muted mt-0.5">
          Settes når VM er ferdig. VM-vinner oppdateres automatisk når
          finalen er spilt; toppscorer og toppassist må du legge inn selv.
        </p>
      </div>

      <div className="space-y-3">
        <div>
          <label className="block text-xs text-muted mb-1.5">
            🏆 VM-vinner{" "}
            <span className="text-[10px] text-success">(auto fra finalen)</span>
          </label>
          <select
            value={vmVinner}
            onChange={(e) => setVmVinner(e.target.value)}
            className="w-full h-11 px-3 rounded-xl bg-elevated border border-border focus:border-primary focus:outline-none"
          >
            <option value="">Ikke satt ennå</option>
            {alleLag.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs text-muted mb-1.5">
            ⚽ Toppscorer
          </label>
          <SpillerVelger
            verdi={toppscorer}
            onVelg={setToppscorer}
            placeholder="Søk spiller…"
            posFilter={["FW", "MF"]}
          />
        </div>

        <div>
          <label className="block text-xs text-muted mb-1.5">
            🎯 Toppassist
          </label>
          <SpillerVelger
            verdi={toppassist}
            onVelg={setToppassist}
            placeholder="Søk spiller…"
            posFilter={["FW", "MF", "DF"]}
          />
        </div>

        <div>
          <label className="block text-xs text-muted mb-1.5">
            🐐 Ronaldo eller Messi (flest mål i VM)
          </label>
          <div className="grid grid-cols-3 gap-1.5">
            {(
              [
                { v: "", l: "Ikke satt" },
                { v: "ronaldo", l: "Ronaldo" },
                { v: "likt", l: "Likt" },
                { v: "messi", l: "Messi" },
              ] as { v: RonaldoVsMessi; l: string }[]
            )
              .filter((o) => o.v !== "")
              .map((o) => (
                <button
                  key={o.v}
                  type="button"
                  onClick={() => setRonaldoVsMessi(o.v)}
                  className={`h-10 rounded-xl text-xs font-semibold transition ${
                    ronaldoVsMessi === o.v
                      ? "bg-primary text-primaryFg border border-primary"
                      : "bg-elevated border border-border hover:border-primary/50"
                  }`}
                >
                  {o.l}
                </button>
              ))}
          </div>
          {ronaldoVsMessi && (
            <button
              type="button"
              onClick={() => setRonaldoVsMessi("")}
              className="mt-1.5 text-[10px] text-muted hover:text-text underline"
            >
              Nullstill
            </button>
          )}
        </div>
      </div>

      <button
        onClick={lagre}
        disabled={!endret || lagrer}
        className={`w-full h-11 rounded-xl text-sm font-semibold transition ${
          klart
            ? "bg-success text-white"
            : "bg-primary text-primaryFg hover:bg-primaryDark disabled:opacity-40 disabled:cursor-not-allowed"
        }`}
      >
        {klart ? "✓ Lagret" : lagrer ? "Lagrer…" : "Lagre fasit"}
      </button>

      <p className="text-[10px] text-muted">
        Etter lagring må aggregator-jobben kjøre for at poeng skal fordeles.
        Klikk &quot;Aggreger poeng&quot; over for å trigge den manuelt.
      </p>
    </section>
  );
}

function MedlemmerSeksjon({
  brukere,
  egenUid,
}: {
  brukere: Bruker[];
  egenUid: string;
}) {
  const [skalSlette, setSkalSlette] = useState<Bruker | null>(null);
  const sortert = [...brukere].sort((a, b) =>
    a.navn.localeCompare(b.navn, "nb"),
  );

  return (
    <section className="bg-surface border border-border rounded-2xl p-4 space-y-3">
      <div>
        <h2 className="font-semibold">Medlemmer ({brukere.length})</h2>
        <p className="text-xs text-muted">
          Sletting fjerner brukeren, alle tipps og spesialtips. Brukeren
          forsvinner fra ledertavlen. Handlingen kan ikke angres.
        </p>
      </div>
      <div className="space-y-1.5">
        {sortert.map((b) => (
          <MedlemRad key={b.uid} bruker={b} egenUid={egenUid} onSlett={setSkalSlette} />
        ))}
      </div>

      {skalSlette && (
        <SlettModal
          bruker={skalSlette}
          onAvbryt={() => setSkalSlette(null)}
          onSlett={async () => {
            await slettBruker(skalSlette.uid);
            setSkalSlette(null);
          }}
        />
      )}
    </section>
  );
}

function MedlemRad({
  bruker,
  egenUid,
  onSlett,
}: {
  bruker: Bruker;
  egenUid: string;
  onSlett: (b: Bruker) => void;
}) {
  const erDeg = bruker.uid === egenUid;
  const [redigerer, setRedigerer] = useState(false);
  const [navn, setNavn] = useState(bruker.navn);
  const [lagrer, setLagrer] = useState(false);
  const [frostLagrer, setFrostLagrer] = useState(false);
  const [spesialLagrer, setSpesialLagrer] = useState(false);

  const spesialÅpenTil = bruker.spesialAapenTil ?? 0;
  const spesialÅpen = spesialÅpenTil > Date.now();
  const spesialMinIgjen = Math.max(
    0,
    Math.ceil((spesialÅpenTil - Date.now()) / 60000),
  );

  useEffect(() => {
    if (!redigerer) setNavn(bruker.navn);
  }, [bruker.navn, redigerer]);

  async function lagreNavn() {
    const nyttNavn = navn.trim();
    if (!nyttNavn || nyttNavn === bruker.navn) {
      setRedigerer(false);
      setNavn(bruker.navn);
      return;
    }
    setLagrer(true);
    try {
      await oppdaterBrukerNavn(bruker.uid, nyttNavn);
      setRedigerer(false);
    } finally {
      setLagrer(false);
    }
  }

  async function toggleFrosset() {
    setFrostLagrer(true);
    try {
      await oppdaterBrukerFrosset(bruker.uid, !bruker.frosset);
    } finally {
      setFrostLagrer(false);
    }
  }

  async function toggleSpesial() {
    setSpesialLagrer(true);
    try {
      const ny = spesialÅpen ? 0 : Date.now() + 30 * 60 * 1000;
      await oppdaterSpesialAapenTil(bruker.uid, ny);
    } finally {
      setSpesialLagrer(false);
    }
  }

  return (
    <div
      className={`flex items-start justify-between gap-3 border rounded-xl px-3 py-2 ${
        bruker.frosset
          ? "bg-warning/5 border-warning/30"
          : "bg-elevated border-border"
      }`}
    >
      <div className="min-w-0 flex-1 space-y-1.5">
        {redigerer ? (
          <div className="flex items-center gap-1.5">
            <input
              value={navn}
              onChange={(e) => setNavn(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") lagreNavn();
                if (e.key === "Escape") {
                  setRedigerer(false);
                  setNavn(bruker.navn);
                }
              }}
              autoFocus
              className="flex-1 h-8 px-2 text-sm rounded-lg bg-bg border border-border focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20"
            />
            <button
              type="button"
              onClick={lagreNavn}
              disabled={lagrer || !navn.trim()}
              className="h-8 px-2.5 rounded-lg bg-primary text-primaryFg text-xs font-semibold disabled:opacity-50"
            >
              {lagrer ? "…" : "Lagre"}
            </button>
            <button
              type="button"
              onClick={() => {
                setRedigerer(false);
                setNavn(bruker.navn);
              }}
              className="h-8 px-2 text-muted hover:text-text text-xs"
            >
              Avbryt
            </button>
          </div>
        ) : (
          <div className="text-sm font-medium truncate flex items-center gap-2">
            <span>{bruker.navn}</span>
            <button
              type="button"
              onClick={() => setRedigerer(true)}
              className="text-[10px] text-muted hover:text-text underline"
            >
              Endre
            </button>
            {bruker.rolle === "admin" && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/15 text-primary font-bold">
                ADMIN
              </span>
            )}
            {bruker.frosset && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-warning/20 text-warning font-bold">
                FROSSET
              </span>
            )}
            {spesialÅpen && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-success/20 text-success font-bold">
                SPESIAL ÅPEN {spesialMinIgjen}m
              </span>
            )}
          </div>
        )}
        <div className="text-[11px] text-muted truncate">{bruker.epost}</div>
      </div>
      <div className="flex flex-col gap-1.5 items-end">
        <button
          onClick={toggleFrosset}
          disabled={erDeg || frostLagrer}
          className={`h-8 px-3 rounded-lg border text-xs font-semibold whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed ${
            bruker.frosset
              ? "bg-warning/15 border-warning/40 text-warning hover:bg-warning/20"
              : "bg-elevated border-border hover:border-warning/50 text-muted hover:text-text"
          }`}
          title={
            erDeg
              ? "Du kan ikke fryse deg selv"
              : bruker.frosset
                ? "Tin opp brukeren"
                : "Frys: kan se men ikke tippe"
          }
        >
          {frostLagrer ? "…" : bruker.frosset ? "Tin opp" : "Frys"}
        </button>
        <button
          onClick={toggleSpesial}
          disabled={spesialLagrer}
          className={`h-8 px-3 rounded-lg border text-xs font-semibold whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed ${
            spesialÅpen
              ? "bg-success/15 border-success/40 text-success hover:bg-success/20"
              : "bg-elevated border-border hover:border-success/50 text-muted hover:text-text"
          }`}
          title={
            spesialÅpen
              ? "Lukk spesialtips igjen for denne brukeren"
              : "Åpne spesialtips midlertidig (30 min) for denne brukeren"
          }
        >
          {spesialLagrer
            ? "…"
            : spesialÅpen
              ? "Lukk spesial"
              : "Åpne spesial 30m"}
        </button>
        <button
          onClick={() => onSlett(bruker)}
          disabled={erDeg}
          className="h-8 px-3 rounded-lg bg-danger/10 border border-danger/30 text-danger text-xs font-semibold hover:bg-danger/15 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
          title={erDeg ? "Du kan ikke slette deg selv" : "Slett medlem"}
        >
          Slett
        </button>
      </div>
    </div>
  );
}


function SlettModal({
  bruker,
  onAvbryt,
  onSlett,
}: {
  bruker: Bruker;
  onAvbryt: () => void;
  onSlett: () => Promise<void>;
}) {
  const [bekreftTekst, setBekreftTekst] = useState("");
  const [sletter, setSletter] = useState(false);
  const [feil, setFeil] = useState<string | null>(null);
  const kanSlette = bekreftTekst.trim() === bruker.navn.trim();

  async function utfør() {
    if (!kanSlette) return;
    setSletter(true);
    setFeil(null);
    try {
      await onSlett();
    } catch (e: any) {
      setFeil(e?.message || "Sletting feilet. Prøv igjen.");
      setSletter(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center px-4"
      onClick={onAvbryt}
    >
      <div
        className="bg-surface border border-border rounded-2xl p-5 w-full max-w-sm space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <div className="text-3xl mb-2">⚠️</div>
          <h3 className="text-lg font-semibold">Slett {bruker.navn}?</h3>
          <p className="text-sm text-muted mt-1">
            Dette sletter brukeren og alle deres tipps permanent. Handlingen
            kan ikke angres.
          </p>
        </div>

        <div className="bg-danger/10 border border-danger/30 rounded-xl p-3 text-sm space-y-2">
          <div className="text-danger font-semibold">Dette slettes:</div>
          <ul className="text-xs text-muted space-y-0.5 ml-4 list-disc">
            <li>Brukerprofil ({bruker.epost})</li>
            <li>Alle kamp-tipps</li>
            <li>Spesialtips</li>
            <li>Plassering på ledertavlen</li>
          </ul>
        </div>

        <div>
          <label className="block text-xs text-muted mb-1.5">
            Skriv{" "}
            <span className="text-text font-semibold">{bruker.navn}</span> for
            å bekrefte:
          </label>
          <input
            type="text"
            value={bekreftTekst}
            onChange={(e) => setBekreftTekst(e.target.value)}
            autoFocus
            placeholder={bruker.navn}
            className="w-full h-11 px-3 rounded-xl bg-elevated border border-border focus:border-danger focus:outline-none focus:ring-2 focus:ring-danger/20"
          />
        </div>

        {feil && (
          <div className="text-sm text-danger bg-danger/10 border border-danger/30 rounded-xl px-3 py-2">
            {feil}
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={onAvbryt}
            disabled={sletter}
            className="flex-1 h-11 rounded-xl border border-border bg-elevated text-sm font-semibold hover:border-primary transition disabled:opacity-50"
          >
            Avbryt
          </button>
          <button
            onClick={utfør}
            disabled={!kanSlette || sletter}
            className="flex-1 h-11 rounded-xl bg-danger text-white text-sm font-semibold hover:bg-danger/90 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {sletter ? "Sletter…" : "Slett permanent"}
          </button>
        </div>
      </div>
    </div>
  );
}
