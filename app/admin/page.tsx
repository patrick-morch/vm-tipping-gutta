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
  oppdaterKlubbRolle,
  nullstillAlleResultater,
  lagreFasit,
} from "@/lib/data";
import { GRUPPER } from "@/lib/vm-data";
import SpillerVelger from "@/components/SpillerVelger";
import type { KlubbRolle } from "@/lib/types";
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
const AGGREGER_WORKFLOW_URL =
  "https://github.com/patrick-morch/vm-tipping-gutta/actions/workflows/aggreger-poeng.yml";

function SyncSeksjon() {
  return (
    <section className="bg-surface border border-border rounded-2xl p-4 space-y-3">
      <div>
        <h2 className="font-semibold">Auto-jobber</h2>
        <p className="text-xs text-muted mt-0.5">
          To GitHub Actions kjører automatisk: <strong>sync</strong> henter nye
          resultater fra TheSportsDB hvert 10. min, og{" "}
          <strong>aggreger poeng</strong> regner ut ledertavlen kl 03 hver natt.
          Trykk knappene for å trigge dem manuelt.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <a
          href={SYNC_WORKFLOW_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-center h-10 px-3 rounded-xl bg-elevated border border-border hover:border-primary text-sm font-semibold transition"
        >
          Synk resultater →
        </a>
        <a
          href={AGGREGER_WORKFLOW_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-center h-10 px-3 rounded-xl bg-elevated border border-border hover:border-primary text-sm font-semibold transition"
        >
          Aggreger poeng →
        </a>
      </div>
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
  const [lagrer, setLagrer] = useState(false);
  const [klart, setKlart] = useState(false);

  useEffect(() => {
    setToppscorer(fasit.toppscorer || "");
    setToppassist(fasit.toppassist || "");
    setVmVinner(fasit.vmVinner || "");
  }, [fasit.toppscorer, fasit.toppassist, fasit.vmVinner]);

  async function lagre() {
    setLagrer(true);
    try {
      await lagreFasit({
        ...fasit,
        vmVinner: vmVinner.trim(),
        toppscorer: toppscorer.trim(),
        toppassist: toppassist.trim(),
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
    toppassist.trim() !== (fasit.toppassist || "");

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
        {sortert.map((b) => {
          const erDeg = b.uid === egenUid;
          return (
            <div
              key={b.uid}
              className="flex items-center justify-between gap-3 bg-elevated border border-border rounded-xl px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate flex items-center gap-2">
                  {b.navn}
                  {b.rolle === "admin" && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/15 text-primary font-bold">
                      ADMIN
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-muted truncate mb-1.5">
                  {b.epost}
                </div>
                <KlubbRolleVelger
                  uid={b.uid}
                  nåværende={b.klubbRolle}
                />
              </div>
              <button
                onClick={() => setSkalSlette(b)}
                disabled={erDeg}
                className="h-8 px-3 rounded-lg bg-danger/10 border border-danger/30 text-danger text-xs font-semibold hover:bg-danger/15 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                title={erDeg ? "Du kan ikke slette deg selv" : "Slett medlem"}
              >
                Slett
              </button>
            </div>
          );
        })}
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

function KlubbRolleVelger({
  uid,
  nåværende,
}: {
  uid: string;
  nåværende?: KlubbRolle;
}) {
  const [lagrer, setLagrer] = useState<KlubbRolle | null>(null);

  async function velg(r: KlubbRolle) {
    if (r === nåværende) return;
    setLagrer(r);
    try {
      await oppdaterKlubbRolle(uid, r);
    } finally {
      setLagrer(null);
    }
  }

  const valg: { v: KlubbRolle; ikon: string; label: string }[] = [
    { v: "trener", ikon: "🧥", label: "Trener" },
    { v: "spiller", ikon: "⚽", label: "Spiller" },
    { v: "annet", ikon: "👥", label: "Annet" },
  ];

  return (
    <div className="flex gap-1 flex-wrap">
      {valg.map((c) => {
        const valgt = nåværende === c.v;
        const lasterDenne = lagrer === c.v;
        return (
          <button
            key={c.v}
            onClick={() => velg(c.v)}
            disabled={Boolean(lagrer)}
            className={`h-6 px-2 rounded-md text-[10px] font-semibold uppercase tracking-wider transition flex items-center gap-1 ${
              valgt
                ? "bg-primary/15 text-primary border border-primary/30"
                : "bg-elevated border border-border text-muted hover:text-text hover:border-primary/30"
            } disabled:opacity-50`}
          >
            <span className="text-xs">{c.ikon}</span>
            {lasterDenne ? "…" : c.label}
          </button>
        );
      })}
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
