# Tarantula

## Vad är Tarantula?

Tarantula är ett verktyg för att spela in skärm och ljud under möten eller arbetspass. När inspelningen stoppas transkriberas allt som sagts med OpenAI Whisper, och en LLM (GPT-4o) analyserar transkriptet och föreslår Linear-issues. Användaren granskar och redigerar förslagen innan de skickas till Linear.

## Flöde

```
[Spela in] → [Stoppa] → [Whisper transkriberar] → [GPT-4o genererar issues] → [Granskning] → [Linear]
```

## Arkitektur

Next.js-webbapp (App Router, Next.js 16, React 19, Tailwind CSS 4) som senare kan laddas i ett Electron-projekt via URL.

### Filstruktur

```
app/
  page.tsx                          ← Inspelnings-UI
  review/page.tsx                   ← Gransknings-UI (redigera och godkänn issues)
  api/
    transcribe/route.ts             ← POST: skickar blob till OpenAI Whisper
    generate-issues/route.ts        ← POST: skickar transkript till GPT-4o
    create-linear-issue/route.ts    ← POST: skapar issue i Linear
lib/
  types.ts                          ← Delade typer (LinearIssue m.m.)
.env.local                          ← Hemliga nycklar (committas ej)
```

## Miljövariabler

Skapa en `.env.local` i projektets rot:

```
OPENAI_API_KEY=        # platform.openai.com → API keys
LINEAR_API_KEY=        # Linear → Settings → API → Personal API keys
LINEAR_TEAM_ID=        # Hittas i Linear-URL:en eller via Linear API
```

## Beroenden

```bash
npm install openai @linear/sdk
```

## Teknikval

| Komponent | Val | Anledning |
|---|---|---|
| Transkribering | OpenAI Whisper (`whisper-1`) | Bra svenska, samma API-nyckel som LLM |
| Issue-generering | GPT-4o med JSON-mode | Strukturerad output, hög kvalitet |
| Linear-integration | `@linear/sdk` | Officiellt SDK |
| Inspelning | `getDisplayMedia` + `getUserMedia` + AudioContext | Fångar skärm, systemljud och mikrofon |

## Begränsningar (v1)

- Whisper har 25 MB filgräns — långa inspelningar (>~30 min) stöds inte utan chunking
- Systemljud kräver att användaren explicit delar det via webbläsarens dialogruta
- Data skickas via `sessionStorage` mellan sidor (ingen databas)
