# Designregler — VM-tipping

Estetisk grunnregel: **mørkt, rolig, premium**. Mindre er mer. Apprupanelet skal føles som en moderne fotball-app — fokus på lesbarhet og raske handlinger.

## Språk
- **Alt på norsk (bokmål).** Ingen engelske ord i UI.
- Knapper er verb i imperativ: "Lagre tips", "Logg inn", "Se ledertavle".
- Tall vises med komma som desimaltegn, men resultater er heltall.

## Farger
- Bakgrunn: `#0B0F14` (nesten svart, blålig)
- Kortflate: `#121821`
- Hevet flate: `#1A2230`
- Border: `#243042`
- Tekst: `#F5F7FA`
- Dempet tekst: `#8A95A8`
- Primær (handling/aktiv): `#22D39A` (mintgrønn — føles "fotball-gress")
- Aksent: `#3B82F6` (blå — info, lenker)
- Fare: `#EF4444`
- Advarsel: `#F59E0B`

Bruk primær sparsomt — kun for hovedhandlinger og posisjon 1 i ledertavlen.

## Typografi
- Inter, system-ui som fallback.
- Skalaer: 12 (small), 14 (body), 16 (lead), 20 (h3), 24 (h2), 32 (h1).
- Vekter: 400 (body), 500 (etiketter), 600 (overskrifter), 700 (tall i tabell).

## Spacing
- 4px grid. Vanlig: 8, 12, 16, 24, 32.
- Padding i kort: 16px mobil, 20px desktop.
- Avstand mellom kort: 12px.

## Komponenter
- **Kort:** `rounded-2xl`, border 1px `border`, bakgrunn `surface`. Ingen tunge skygger.
- **Knapp primær:** fylt mintgrønn, sort tekst, `rounded-xl`, 44px høyde (touch-target).
- **Knapp sekundær:** transparent, border 1px `border`, samme høyde.
- **Input:** `bakgrunn elevated`, border 1px `border`, focus-ring `primary`.
- **Tabell-rad:** ikke striper. Bruk border-bottom mellom rader.
- **Tall-input for tipping:** stort, midtstilt, monospace-feel. Tap for å åpne, ikke skriv direkte.

## Layout
- **Mobile-first.** Maks bredde 480px i hovedinnhold, sentrert.
- Bunnavigasjon med 3 ikoner: Kamper · Mine tips · Ledertavle.
- Topp: tynn header med logo "VM-tipping" + brukerinitialer til høyre.

## Bevegelse
- Bare små transisjoner (150ms ease-out) på hover/active.
- Ingen sprettanimasjoner. Subtilt scale-95 på trykk.

## Tone
- Vennlig og direkte. "Du har 3 kamper igjen å tippe på."
- Aldri kjeftende. Ingen utropstegn unntatt i feilmeldinger.

## Tilgjengelighet
- Kontrast min 4.5:1 for tekst.
- Touch-target min 44×44px.
- Alle interaktive elementer skal være tab-bare.
