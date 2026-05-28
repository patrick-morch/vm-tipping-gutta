"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { lagreSpesialTip, useMittSpesialTip } from "@/lib/data";
import {
  flagg,
  GRUPPER,
  POENG,
  SPESIAL_LÅS_TID,
  spesialErLåst,
} from "@/lib/vm-data";
import Skall from "@/components/Skall";
import Beskytt from "@/components/Beskytt";
import SpillerVelger from "@/components/SpillerVelger";

export default function SpesialSide() {
  return (
    <Beskytt>
      <Skall>
        <Spesial />
      </Skall>
    </Beskytt>
  );
}

const ALLE_LAG = GRUPPER.flatMap((g) => g.lag).sort();

function Spesial() {
  const { user } = useAuth();
  const lagret = useMittSpesialTip(user?.uid);
  const [vmVinner, setVmVinner] = useState("");
  const [toppscorer, setToppscorer] = useState("");
  const [toppassist, setToppassist] = useState("");
  const [låst, setLåst] = useState(() => spesialErLåst());
  const klar = useRef(false);

  useEffect(() => {
    const sjekk = () => setLåst(spesialErLåst());
    sjekk();
    const t = setInterval(sjekk, 30_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!lagret) {
      klar.current = true;
      return;
    }
    setVmVinner(lagret.vmVinner);
    setToppscorer(lagret.toppscorer);
    setToppassist(lagret.toppassist);
    klar.current = true;
  }, [lagret]);

  useEffect(() => {
    if (!user || !klar.current || låst) return;
    if (
      lagret &&
      lagret.vmVinner === vmVinner &&
      lagret.toppscorer === toppscorer &&
      lagret.toppassist === toppassist
    )
      return;
    if (!lagret && !vmVinner && !toppscorer && !toppassist) return;
    const t = setTimeout(() => {
      lagreSpesialTip({
        uid: user.uid,
        vmVinner,
        vmFinalist: lagret?.vmFinalist || "",
        toppscorer,
        toppassist,
        mestRødeKort: lagret?.mestRødeKort || "",
        lagretTid: Date.now(),
      });
    }, 600);
    return () => clearTimeout(t);
  }, [vmVinner, toppscorer, toppassist, user, lagret, låst]);

  const tippet = [vmVinner, toppscorer, toppassist].filter(Boolean).length;
  const låsTekst = new Date(SPESIAL_LÅS_TID).toLocaleString("nb-NO", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Spesialtips</h1>
          <p className="text-muted text-sm">
            {låst ? "Låst" : `Stenger ${låsTekst}`}
          </p>
        </div>
        <div className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full transition ${
                i < tippet ? "bg-primary" : "bg-border"
              }`}
            />
          ))}
        </div>
      </div>

      {låst && (
        <div className="bg-warning/10 border border-warning/30 text-warning text-sm rounded-2xl px-4 py-3 flex items-center gap-2">
          <span className="text-lg">🔒</span>
          Tipsene dine er låst.
        </div>
      )}

      <fieldset disabled={låst} className="space-y-4">
        <VmVinnerKort verdi={vmVinner} onVelg={setVmVinner} />
        <SpillerKort
          tittel="Toppscorer"
          undertittel="Gullstøvelen"
          ikon="⚽"
          poeng={POENG.toppscorer}
          tema="primary"
          verdi={toppscorer}
          onVelg={setToppscorer}
          posFilter={["FW", "MF"]}
        />
        <SpillerKort
          tittel="Toppassist"
          undertittel="Mesterspilleren"
          ikon="🎯"
          poeng={POENG.toppassist}
          tema="accent"
          verdi={toppassist}
          onVelg={setToppassist}
          posFilter={["FW", "MF", "DF"]}
        />
      </fieldset>
    </div>
  );
}

function VmVinnerKort({
  verdi,
  onVelg,
}: {
  verdi: string;
  onVelg: (v: string) => void;
}) {
  const [endrer, setEndrer] = useState(!verdi);

  useEffect(() => {
    if (verdi) setEndrer(false);
  }, [verdi]);

  return (
    <div className="relative overflow-hidden rounded-3xl border border-gold/40 bg-gradient-to-br from-gold/25 via-gold/8 to-transparent p-5">
      <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full bg-gold/20 blur-3xl pointer-events-none" />
      <div className="relative space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-[10px] text-gold uppercase tracking-[0.2em] font-bold mb-1">
              Hovedpremien
            </div>
            <h2 className="text-xl font-bold">Hvem vinner VM?</h2>
          </div>
          <span className="text-[10px] text-gold font-bold bg-gold/20 px-2.5 py-1 rounded-full whitespace-nowrap">
            25 POENG
          </span>
        </div>

        {verdi && !endrer ? (
          <div className="bg-bg/40 backdrop-blur border border-gold/30 rounded-2xl p-4 flex items-center gap-4">
            <div className="text-5xl drop-shadow-lg">🏆</div>
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <span className="text-4xl">{flagg(verdi)}</span>
              <div className="min-w-0">
                <div className="text-[10px] text-muted uppercase tracking-wider font-semibold">
                  Din vinner
                </div>
                <div className="text-base font-bold truncate">{verdi}</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setEndrer(true)}
              className="text-xs font-semibold text-muted hover:text-text bg-elevated px-3 py-1.5 rounded-lg border border-border"
            >
              Endre
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="text-center text-5xl py-3 drop-shadow-lg">🏆</div>
            <select
              value={verdi}
              onChange={(e) => onVelg(e.target.value)}
              className="w-full h-12 px-3 rounded-xl bg-bg/40 backdrop-blur border border-gold/30 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/30 font-semibold text-sm"
            >
              <option value="">Velg verdensmester…</option>
              {ALLE_LAG.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
    </div>
  );
}

function SpillerKort({
  tittel,
  undertittel,
  ikon,
  poeng,
  tema,
  verdi,
  onVelg,
  posFilter,
}: {
  tittel: string;
  undertittel: string;
  ikon: string;
  poeng: number;
  tema: "primary" | "accent";
  verdi: string;
  onVelg: (v: string) => void;
  posFilter?: ("GK" | "DF" | "MF" | "FW")[];
}) {
  const [endrer, setEndrer] = useState(!verdi);

  useEffect(() => {
    if (verdi) setEndrer(false);
  }, [verdi]);

  const fargeKlasse =
    tema === "primary"
      ? "border-primary/30 from-primary/15 to-transparent"
      : "border-accent/30 from-accent/15 to-transparent";
  const ikonBg = tema === "primary" ? "bg-primary/20" : "bg-accent/20";
  const tagFarge =
    tema === "primary"
      ? "text-primary bg-primary/15"
      : "text-accent bg-accent/15";

  return (
    <div
      className={`relative rounded-3xl border bg-gradient-to-br p-5 ${fargeKlasse}`}
    >
      <div className="relative space-y-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div
              className={`w-12 h-12 rounded-2xl ${ikonBg} flex items-center justify-center text-2xl`}
            >
              {ikon}
            </div>
            <div>
              <h3 className="text-lg font-bold leading-tight">{tittel}</h3>
              <p className="text-[11px] text-muted">{undertittel}</p>
            </div>
          </div>
          <span
            className={`text-[10px] font-bold ${tagFarge} px-2.5 py-1 rounded-full whitespace-nowrap`}
          >
            {poeng} POENG
          </span>
        </div>

        {verdi && !endrer ? (
          <div className="bg-bg/40 backdrop-blur border border-border rounded-2xl p-3 flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-full ${ikonBg} flex items-center justify-center text-lg flex-shrink-0`}
            >
              {ikon}
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-bold truncate">{verdi}</div>
              <div className="text-[10px] text-muted uppercase tracking-wider font-semibold">
                Din tipp
              </div>
            </div>
            <button
              type="button"
              onClick={() => setEndrer(true)}
              className="text-xs font-semibold text-muted hover:text-text bg-elevated px-3 py-1.5 rounded-lg border border-border"
            >
              Endre
            </button>
          </div>
        ) : (
          <SpillerVelger
            verdi={verdi}
            onVelg={onVelg}
            placeholder="Søk spiller eller lag…"
            posFilter={posFilter}
          />
        )}
      </div>
    </div>
  );
}
