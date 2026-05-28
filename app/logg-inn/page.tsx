"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

type Modus = "logg-inn" | "registrer";

export default function LoggInn() {
  const { loggInn, registrer, demoModus } = useAuth();
  const router = useRouter();
  const [modus, setModus] = useState<Modus>("logg-inn");
  const [epost, setEpost] = useState("");
  const [passord, setPassord] = useState("");
  const [bekreft, setBekreft] = useState("");
  const [navn, setNavn] = useState("");
  const [feil, setFeil] = useState<string | null>(null);
  const [laster, setLaster] = useState(false);

  async function sendInn(e: React.FormEvent) {
    e.preventDefault();
    setFeil(null);
    setLaster(true);
    try {
      if (modus === "logg-inn") {
        await loggInn(epost.trim(), passord);
        router.push("/kamper");
      } else {
        if (passord.length < 8) {
          throw new Error("Passord må være minst 8 tegn.");
        }
        if (passord !== bekreft) {
          throw new Error("Passordene er ikke like.");
        }
        if (navn.trim().length < 2) {
          throw new Error("Skriv inn fullt navn.");
        }
        await registrer(epost.trim(), passord, navn.trim());
        router.push("/kamper");
      }
    } catch (err: any) {
      const kode = err?.code || "";
      if (kode.includes("invalid-credential") || kode.includes("wrong-password"))
        setFeil("Feil e-post eller passord.");
      else if (kode.includes("email-already-in-use"))
        setFeil("E-posten er allerede registrert.");
      else if (kode.includes("invalid-email"))
        setFeil("Ugyldig e-postadresse.");
      else setFeil(err?.message || "Noe gikk galt. Prøv igjen.");
    } finally {
      setLaster(false);
    }
  }

  function byttModus(m: Modus) {
    setModus(m);
    setFeil(null);
    setBekreft("");
  }

  const tittel = modus === "logg-inn" ? "Logg inn" : "Opprett bruker";
  const bekreftFeil =
    modus === "registrer" && bekreft !== "" && bekreft !== passord;

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="text-center">
            <div className="text-xl font-bold leading-tight">VM-tipping</div>
            <div className="text-[11px] text-muted uppercase tracking-[0.15em] font-semibold">
              Gutta
            </div>
          </div>
        </div>

        {demoModus && (
          <div className="mb-4 text-xs text-warning bg-warning/10 border border-warning/30 rounded-xl px-3 py-2 text-center">
            Demo-modus — data lagres bare i nettleseren din
          </div>
        )}

        <div className="bg-surface border border-border rounded-2xl p-6">
          <h1 className="text-2xl font-semibold mb-1">{tittel}</h1>
          <p className="text-muted text-sm mb-6">
            {modus === "logg-inn"
              ? "Velkommen tilbake."
              : "Bli med på VM-tipping med gutta."}
          </p>

          <form onSubmit={sendInn} className="space-y-3">
            {modus === "registrer" && (
              <>
                <Felt
                  etikett="Fullt navn"
                  type="text"
                  verdi={navn}
                  onChange={setNavn}
                  autoComplete="name"
                  required
                />
              </>
            )}
            <Felt
              etikett="E-post"
              type="email"
              verdi={epost}
              onChange={setEpost}
              autoComplete="email"
              required
            />
            <PassordFelt
              etikett="Passord"
              verdi={passord}
              onChange={setPassord}
              autoComplete={
                modus === "registrer" ? "new-password" : "current-password"
              }
              hint={modus === "registrer" ? "Minst 8 tegn" : undefined}
            />
            {modus === "registrer" && (
              <PassordFelt
                etikett="Bekreft passord"
                verdi={bekreft}
                onChange={setBekreft}
                autoComplete="new-password"
                feil={bekreftFeil ? "Passordene er ikke like" : undefined}
              />
            )}

            {feil && (
              <div className="text-sm text-danger bg-danger/10 border border-danger/30 rounded-xl px-3 py-2">
                {feil}
              </div>
            )}

            <button
              type="submit"
              disabled={laster || bekreftFeil}
              className="w-full h-11 rounded-xl bg-primary text-primaryFg font-semibold hover:bg-primaryDark transition disabled:opacity-50 active:scale-[0.98]"
            >
              {laster
                ? "Vent…"
                : modus === "logg-inn"
                  ? "Logg inn"
                  : "Opprett bruker"}
            </button>
          </form>

          <div className="mt-5 text-sm text-muted text-center">
            {modus === "logg-inn" ? (
              <div>
                Ingen bruker?{" "}
                <button
                  onClick={() => byttModus("registrer")}
                  className="text-primary hover:underline"
                >
                  Opprett en
                </button>
              </div>
            ) : (
              <button
                onClick={() => byttModus("logg-inn")}
                className="hover:text-text"
              >
                Har du allerede bruker? Logg inn
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

type FeltProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange"
> & {
  etikett: string;
  verdi: string;
  onChange: (v: string) => void;
};

function Felt({ etikett, verdi, onChange, ...rest }: FeltProps) {
  return (
    <label className="block">
      <span className="text-xs text-muted mb-1 block">{etikett}</span>
      <input
        {...rest}
        value={verdi}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-11 px-3 rounded-xl bg-elevated border border-border focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition"
      />
    </label>
  );
}

function PassordFelt({
  etikett,
  verdi,
  onChange,
  hint,
  feil,
  autoComplete,
}: {
  etikett: string;
  verdi: string;
  onChange: (v: string) => void;
  hint?: string;
  feil?: string;
  autoComplete?: string;
}) {
  const [vis, setVis] = useState(false);
  return (
    <label className="block">
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-xs text-muted">{etikett}</span>
        {hint && !feil && (
          <span className="text-[10px] text-muted">{hint}</span>
        )}
        {feil && <span className="text-[10px] text-danger">{feil}</span>}
      </div>
      <div className="relative">
        <input
          type={vis ? "text" : "password"}
          value={verdi}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          required
          className={`w-full h-11 pl-3 pr-11 rounded-xl bg-elevated border focus:outline-none focus:ring-2 transition ${
            feil
              ? "border-danger/50 focus:border-danger focus:ring-danger/20"
              : "border-border focus:border-primary focus:ring-primary/20"
          }`}
        />
        <button
          type="button"
          onClick={() => setVis((v) => !v)}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg text-muted hover:text-text hover:bg-border/50 flex items-center justify-center transition"
          aria-label={vis ? "Skjul passord" : "Vis passord"}
          tabIndex={-1}
        >
          {vis ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
              <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
              <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
              <line x1="2" y1="2" x2="22" y2="22" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          )}
        </button>
      </div>
    </label>
  );
}
