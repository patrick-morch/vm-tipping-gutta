# VM-tipping — Gutta

VM-tipping for gutta. Next.js + Firebase. Norsk, mobile-first, mørk premium-stil.

## Oppsett

```bash
npm install
cp .env.local.example .env.local
# Fyll inn Firebase-nøklene fra Firebase Console
npm run dev
```

App kjører på http://localhost:3000

## Firebase

1. Opprett prosjekt på https://console.firebase.google.com
2. Aktiver **Authentication → E-post/passord**
3. Aktiver **Firestore Database** (start i produksjonsmodus)
4. Lim inn reglene fra `firestore.rules` i Firestore-reglene
5. Web-app → kopier config → lim inn i `.env.local`

## Bli admin

Etter at du har registrert din første bruker:
1. Gå til Firestore Console
2. Finn `brukere/<din-uid>`
3. Endre `rolle` fra `medlem` til `admin`
4. Logg ut og inn igjen — "Admin"-lenken dukker opp i headeren

Admin kan legge til kamper og sette resultater. Poengene beregnes automatisk i ledertavlen.

## Deploy til Firebase Hosting

```bash
npm install -g firebase-tools
firebase login
firebase init hosting     # velg "Use existing project"
# Public dir: out
# Single-page: nei (Next.js handterer ruter selv)
# Github actions: opp til deg

npm run build
firebase deploy
```

Hvis du vil ha SSR, vurder Firebase App Hosting eller Vercel.

## Poeng

- **3p** for nøyaktig resultat
- **1p** for riktig utfall (H/U/B) men feil resultat
- **0p** ellers
- **×2** i sluttspill (semi, bronse, finale)

## Struktur

```
app/
  page.tsx          → redirect til /kamper eller /logg-inn
  logg-inn/         → innlogging, registrering, glemt passord
  kamper/           → liste kommende kamper, tipp
  mine-tips/        → oversikt over egne tips og poeng
  ledertavle/       → klubb-tabell med filter på avdeling
  admin/            → legge til kamper, sette resultater
components/
  Skall.tsx         → header + bunnav
  Beskytt.tsx       → krever innlogging
lib/
  firebase.ts       → SDK-init
  auth-context.tsx  → React-kontekst rundt Firebase Auth
  types.ts          → Match, Prediction, Bruker, poengberegning
```

Se `DESIGN-RULES.md` for visuelle prinsipper.
