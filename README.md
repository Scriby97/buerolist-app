# Bürolist App

Frontend (Next.js) für Bürolist - Arbeitszeiterfassung für Handwerksbetriebe:
Zeit erfassen pro Kunde/Projekt, Übersicht der eigenen Einträge, Kunden- und
Projekt-Verwaltung mit Notizen und Fotos. Analoger Aufbau zu
[FleetTrack](https://github.com/Scriby97/fleettrack-frontend) - gleicher
Stack (Next.js App Router, next-intl, Tailwind v4, Supabase Auth, Vercel),
gleiche Auth-/Organisations-/Einladungs-Infrastruktur, neues Domänenmodell.

Backend: [buerolist-server](../buerolist-server) (separates Repo).

## Setup

1. **`.env.local` anlegen**: `.env.example` kopieren nach `.env.local` und
   ausfüllen:
   - `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` aus demselben
     Supabase-Projekt, das `buerolist-server` verwendet (Project Settings →
     API).
   - `NEXT_PUBLIC_API_URL` zeigt auf den laufenden `buerolist-server`
     (lokal: `http://localhost:3001/api`).
2. **Installieren & starten**:
   ```bash
   npm install
   npm run dev
   ```
   Läuft standardmäßig auf `http://localhost:3000`.

## Tests / Lint / Build

```bash
npm test
npx tsc --noEmit
npm run lint
npm run build
```

## Design

Farbschema/Typografie folgen [deerworks.ch](https://deerworks.ch) (siehe
`app/globals.css` für die Tailwind-Farbpaletten-Overrides und `app/layout.tsx`
für die IBM-Plex-Schriftfamilien) statt FleetTracks Navy/Eisblau/Orange.
Logo/Icons sind Platzhalter (blockiges B-Monogramm, analog zum
FleetTrack-Logo) bis zum finalen Logo-Design.

## Deployment

Vercel-Projekt, verbunden mit diesem Repo. Env-Variablen wie in
`.env.example` beschrieben in den Vercel-Projekteinstellungen setzen.
