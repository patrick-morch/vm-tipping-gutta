"use client";

import Skall from "@/components/Skall";
import Beskytt from "@/components/Beskytt";
import SideHeader from "@/components/SideHeader";

export default function PoengSide() {
  return (
    <Beskytt>
      <Skall>
        <Poeng />
      </Skall>
    </Beskytt>
  );
}

function Poeng() {
  return (
    <div className="space-y-5">
      <SideHeader
        tittel="Poeng & regler"
        undertittel="Sånn samler du poeng. Kort og konsist."
      />

      <Kort tema="success">
        <KortHeader ikon="⚽" tag="KAMPRESULTAT" tema="success">
          Tipp hver kamp
        </KortHeader>
        <div className="space-y-2">
          <Rad
            poeng={3}
            tema="success"
            tittel="Eksakt resultat"
            beskrivelse="Tippet 2-1 og det ble 2-1."
          />
          <Rad
            poeng={1}
            tema="accent"
            tittel="Riktig utfall"
            beskrivelse="Tippet hjemmeseier og det ble hjemmeseier."
          />
          <Rad
            poeng={0}
            tema="muted"
            tittel="Feil tipp"
            beskrivelse="Tippet hjemme, det ble borte. Ingen poeng."
          />
        </div>
      </Kort>

      <Kort tema="norge">
        <KortHeader ikon="🇳🇴" tag="BONUS" tema="norge">
          Norge-kamper teller dobbelt
        </KortHeader>
        <div className="grid grid-cols-2 gap-2">
          <Boks tema="norge" stor="6p" liten="Eksakt Norge-kamp" />
          <Boks tema="norge" stor="2p" liten="Riktig utfall Norge" />
        </div>
        <p className="text-xs text-muted mt-2">
          Alle 3 gruppekamper og videre hvis Norge når sluttspillet.
        </p>
      </Kort>

      <Kort tema="gold">
        <KortHeader ikon="🏆" tag="SPESIAL" tema="gold">
          De store spørsmålene
        </KortHeader>
        <div className="space-y-2">
          <Rad
            poeng={25}
            tema="gold"
            tittel="Hvem vinner VM?"
            beskrivelse="Det største enkelt-tippet i hele spillet."
          />
          <Rad
            poeng={15}
            tema="primary"
            tittel="Toppscorer (Gullstøvelen)"
            beskrivelse="Spilleren med flest mål gjennom turneringen."
          />
          <Rad
            poeng={10}
            tema="accent"
            tittel="Toppassist"
            beskrivelse="Spilleren med flest målgivende pasninger."
          />
        </div>
      </Kort>

      <Kort tema="warning">
        <KortHeader ikon="🔒" tag="FRISTER" tema="warning">
          Når tipset låses
        </KortHeader>
        <div className="space-y-2 text-sm">
          <div className="flex items-start gap-3">
            <span className="text-warning mt-0.5">•</span>
            <div>
              <div className="font-semibold">Kampresultat</div>
              <div className="text-muted text-xs">
                Låses 1 time før kickoff for hver kamp.
              </div>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-warning mt-0.5">•</span>
            <div>
              <div className="font-semibold">Spesialtips</div>
              <div className="text-muted text-xs">
                Låses 11. juni kl 20:00 (1 time før første VM-kamp).
              </div>
            </div>
          </div>
        </div>
      </Kort>

      <Kort tema="accent">
        <KortHeader ikon="📊" tag="EKSEMPEL" tema="accent">
          Hvordan det ser ut
        </KortHeader>
        <div className="space-y-3">
          <div className="bg-elevated border border-border rounded-xl p-3">
            <div className="text-[10px] text-muted uppercase tracking-wider mb-1">
              Norge – Irak (×2)
            </div>
            <div className="flex items-center justify-between text-sm">
              <span>Du tippet:</span>
              <span className="font-bold">2 – 1</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted">Fasit:</span>
              <span className="font-bold">2 – 1</span>
            </div>
            <div className="flex items-center justify-between mt-2 pt-2 border-t border-border">
              <span className="text-success font-semibold text-sm">
                Eksakt × Norge-bonus
              </span>
              <span className="font-bold text-success text-lg">+6p</span>
            </div>
          </div>
          <div className="bg-elevated border border-border rounded-xl p-3">
            <div className="text-[10px] text-muted uppercase tracking-wider mb-1">
              Frankrike – Senegal
            </div>
            <div className="flex items-center justify-between text-sm">
              <span>Du tippet:</span>
              <span className="font-bold">3 – 0</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted">Fasit:</span>
              <span className="font-bold">1 – 0</span>
            </div>
            <div className="flex items-center justify-between mt-2 pt-2 border-t border-border">
              <span className="text-accent font-semibold text-sm">
                Riktig utfall
              </span>
              <span className="font-bold text-accent text-lg">+1p</span>
            </div>
          </div>
        </div>
      </Kort>

      <div className="text-center text-xs text-muted px-4 pt-2">
        Ledertavlen oppdateres automatisk hver natt.
      </div>
    </div>
  );
}

const TEMA = {
  success: {
    ramme: "border-success/30",
    gradient: "from-success/15",
    tag: "bg-success/15 text-success",
    poeng: "text-success bg-success/15 border-success/30",
  },
  accent: {
    ramme: "border-accent/30",
    gradient: "from-accent/15",
    tag: "bg-accent/15 text-accent",
    poeng: "text-accent bg-accent/15 border-accent/30",
  },
  gold: {
    ramme: "border-gold/40",
    gradient: "from-gold/20",
    tag: "bg-gold/20 text-gold",
    poeng: "text-gold bg-gold/20 border-gold/30",
  },
  norge: {
    ramme: "border-norge/40",
    gradient: "from-norge/15",
    tag: "bg-norge/15 text-norge",
    poeng: "text-norge bg-norge/15 border-norge/30",
  },
  warning: {
    ramme: "border-warning/30",
    gradient: "from-warning/15",
    tag: "bg-warning/15 text-warning",
    poeng: "text-warning bg-warning/15 border-warning/30",
  },
  primary: {
    ramme: "border-primary/30",
    gradient: "from-primary/15",
    tag: "bg-primary/15 text-primary",
    poeng: "text-primary bg-primary/15 border-primary/30",
  },
  muted: {
    ramme: "border-border",
    gradient: "from-elevated",
    tag: "bg-elevated text-muted",
    poeng: "text-muted bg-elevated border-border",
  },
} as const;

type TemaNavn = keyof typeof TEMA;

function Kort({
  tema,
  children,
}: {
  tema: TemaNavn;
  children: React.ReactNode;
}) {
  const t = TEMA[tema];
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border ${t.ramme} bg-gradient-to-br ${t.gradient} via-transparent to-transparent p-4 space-y-3`}
    >
      {children}
    </div>
  );
}

function KortHeader({
  ikon,
  tag,
  tema,
  children,
}: {
  ikon: string;
  tag: string;
  tema: TemaNavn;
  children: React.ReactNode;
}) {
  const t = TEMA[tema];
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        <div className="text-3xl">{ikon}</div>
        <div>
          <div
            className={`text-[10px] font-bold uppercase tracking-[0.15em] ${t.tag.split(" ")[1]}`}
          >
            {tag}
          </div>
          <h2 className="font-bold text-base leading-tight">{children}</h2>
        </div>
      </div>
    </div>
  );
}

function Rad({
  poeng,
  tema,
  tittel,
  beskrivelse,
}: {
  poeng: number;
  tema: TemaNavn;
  tittel: string;
  beskrivelse: string;
}) {
  const t = TEMA[tema];
  return (
    <div className="flex items-start gap-3 bg-elevated/50 border border-border rounded-xl px-3 py-2.5">
      <div
        className={`min-w-[44px] h-11 rounded-lg border flex flex-col items-center justify-center ${t.poeng}`}
      >
        <span className="text-base font-bold leading-none">{poeng}</span>
        <span className="text-[8px] uppercase tracking-wider leading-none mt-0.5">
          poeng
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm">{tittel}</div>
        <div className="text-[11px] text-muted">{beskrivelse}</div>
      </div>
    </div>
  );
}

function Boks({
  tema,
  stor,
  liten,
}: {
  tema: TemaNavn;
  stor: string;
  liten: string;
}) {
  const t = TEMA[tema];
  return (
    <div
      className={`${t.poeng} border rounded-xl p-3 text-center`}
    >
      <div className="text-2xl font-bold leading-none">{stor}</div>
      <div className="text-[10px] uppercase tracking-wider mt-1">{liten}</div>
    </div>
  );
}
