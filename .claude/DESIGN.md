# Tarantula — Designspecifikation

> Visuell spec för Claude Code. Designspråket är hämtat från referensbilden (Riser-dashboarden):
> lila accent, mjuka vita kort med rundade hörn, ljus lavendelbakgrund, vänster sidofält och en
> prominent record-knapp som visuellt centrum. Risers funktioner (kanaler, DM, kalender) återanvänds
> **inte** — bara dess visuella språk, översatt till Tarantulas faktiska flöde:
>
> `[Spela in] → [Stoppa] → [Whisper] → [GPT-4o] → [Granska] → [Linear]`
>
> Stack: **Next.js 16 (App Router), React 19, Tailwind CSS 4**. Faithfully Riser-inspirerad — följ tokens nedan exakt.

---

## 1. Två skärmar, ett designspråk

| Skärm | Route | Riser-element som återanvänds | Tarantula-syfte |
|---|---|---|---|
| Inspelning (Home) | `app/page.tsx` | Sidofält, top-bar med Record/Import, "minuter använda"-kort, mötessummeringskort | Starta/stoppa inspelning, visa senaste sessioner |
| Granskning | `app/review/page.tsx` | Mötessummeringskort → redigerbara issue-kort, höger-rail | Redigera GPT-4o:s issue-förslag, skicka till Linear |

### Mappning bild → Tarantula

| Riser i bilden | Översätts till i Tarantula |
|---|---|
| "Record"-knapp (lila gradient + mic) | **Spela in**-knapp — appens primära CTA, identiskt utseende |
| "Import"-knapp (outline) | **Importera** — ladda upp befintlig ljud-/videofil till Whisper |
| Kalenderns mic-toggles (pill med mic-ikon) | **Capture-toggles**: Skärm / Systemljud / Mikrofon |
| Mötessummeringskort (titel, deltagare, summary-bullets, timestamps) | **Sessionskort** (Home) och **Issue-kort** (Review) |
| "Risher Business · 300/1000 mins used" | **Transkriberat denna månad** — usage-kort i sidofotens nederkant |
| "Wednesday, June 2024"-rubrik | Sessionsrubrik (titel + datum + längd) överst i Review |
| Avatar-grupp "20+" | Behålls bara där det finns riktiga deltagare; annars utelämnas |

---

## 2. Designsystem (tokens)

Paste-redo för Tailwind 4 (`app/globals.css`). Allt nedan härleds från dessa värden — inga magiska hex i komponenter.

```css
@import "tailwindcss";

@theme {
  /* Primär (lila) — knappar, logo, aktiva tillstånd, vald dag */
  --color-primary: #7C3AED;
  --color-primary-hover: #6D28D9;
  --color-primary-soft: #F1E9FE;   /* badge-bakgrund, valt tillstånd */
  --color-primary-ring: #C4B0F7;   /* fokusring */

  /* Yt & bakgrund */
  --color-app-bg: #F4F2F8;         /* yttre ram / lavendel */
  --color-surface: #FFFFFF;        /* kort, top-bar, sidofält */
  --color-surface-inset: #FAF9FC;  /* nedsänkta fält, inputs i vila */
  --color-border: #ECEAF2;         /* hårfina kanter */
  --color-border-strong: #DDD9E8;

  /* Text */
  --color-text: #1A1823;           /* rubriker, nära svart med lila ton */
  --color-text-secondary: #6E6A7C; /* brödtext, host/metadata */
  --color-text-tertiary: #A6A2B2;  /* timestamps, captions */

  /* Status */
  --color-success: #15A34A;        /* skickad till Linear */
  --color-warning: #D97706;        /* nära 25 MB / 30 min */
  --color-danger: #DC2626;         /* fel, ta bort, inspelning aktiv */

  /* Linear-prioritet (issue-kort) */
  --color-prio-urgent: #E5484D;
  --color-prio-high:   #F2994A;
  --color-prio-medium: #E2B203;
  --color-prio-low:    #5E6AD2;
  --color-prio-none:   #9CA3AF;

  /* Gradient för Spela in-knappen (lila → magenta, som i bilden) */
  --gradient-record: linear-gradient(135deg, #7C3AED 0%, #9333EA 55%, #B23AE8 100%);

  /* Radier */
  --radius-frame: 28px;   /* yttre app-ram */
  --radius-card: 16px;
  --radius-input: 10px;
  --radius-button: 12px;
  --radius-pill: 9999px;

  /* Skuggor */
  --shadow-card: 0 1px 2px rgba(20,18,35,.04), 0 6px 20px rgba(20,18,35,.05);
  --shadow-card-hover: 0 2px 4px rgba(20,18,35,.06), 0 12px 28px rgba(20,18,35,.08);
  --shadow-record: 0 8px 24px rgba(124,58,237,.35);
  --shadow-popover: 0 8px 30px rgba(20,18,35,.12);

  /* Typografi */
  --font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;
  --font-mono: "Geist Mono", ui-monospace, monospace; /* endast transkript-timecodes */
}
```

> **Note:** håll lila till accent + interaktion. Allt runt omkring ska vara lugnt (vitt/lavendel/grått).
> Boldheten spenderas på Spela in-knappen och aktiva tillstånd — inget annat ska konkurrera.

---

## 3. Typografi

Faithfully Riser: en ren geometrisk sans, tight tracking på rubriker, ljusa små timestamps.

| Roll | Storlek | Vikt | Tracking | Färg | Användning |
|---|---|---|---|---|---|
| Sidrubrik (h1) | 24px / 1.5rem | 700 | -0.02em | `--color-text` | "Senaste inspelningar", sessionstitel i Review |
| Sektion (h2) | 18px / 1.125rem | 600 | -0.01em | `--color-text` | sektionsrubriker |
| Korttitel | 16px / 1rem | 600 | -0.01em | `--color-text` | mötes-/issue-titel |
| Brödtext | 14px / 0.875rem | 400–500 | 0 | `--color-text-secondary` | beskrivningar, bullets |
| Sekundär | 13px / 0.8125rem | 500 | 0 | `--color-text-secondary` | host, metadata, nav |
| Caption/timestamp | 12px / 0.75rem | 500 | 0 | `--color-text-tertiary` | tidsstämplar (`mono` valfritt) |

Ladda Inter via `next/font/google` med subsets `["latin"]` och `display: "swap"`. `Geist Mono` används enbart för transkriptets timecodes (`00:01:35`).

---

## 4. Ikoner

Använd **`lucide-react`** genomgående (matchar Risers tunna outline-ikonografi). Storlek 18–20px, `stroke-width: 1.75`.

| Plats | Ikon (lucide) |
|---|---|
| Logo-mark | egen "T"/spindel-glyph i lila cirkel (fallback: `Webhook` eller bokstaven T) |
| Spela in | `Mic` |
| Stoppa | `Square` (fylld) |
| Importera | `Upload` |
| Skärm-capture | `MonitorUp` |
| Systemljud | `Volume2` |
| Mikrofon | `Mic` |
| Home/Inspelning | `Disc` |
| Historik | `History` |
| Inställningar | `Settings` |
| Sök | `Search` |
| Issue skickad | `Check` |
| Ta bort | `Trash2` |
| Redigera | `Pencil` |
| Prioritet | `Flag` / `SignalHigh` |
| Skicka till Linear | `ArrowUpRight` |
| Transkript | `FileText` |
| Notis | `Bell` |

---

## 5. Globala komponenter

### 5.1 App-skal (yttre ram)
Hela appen sitter i en rundad ram precis som i bilden.
- `min-h-screen` bakgrund `--color-app-bg`, centrerat innehåll med padding `16–24px`.
- Inre yta: `bg-surface`, `rounded-[--radius-frame]`, `shadow-card`, `overflow-hidden`.
- Layout inuti: `grid grid-cols-[264px_1fr]` (sidofält + main). I Review blir main själv `grid-cols-[1fr_360px]` (issues + transkript-rail).

### 5.2 Sidofält (264px)
Vertikal kolumn, `bg-surface` med `border-r border-border`. Padding `20px`.

Ordning uppifrån:
1. **Logo-rad** — lila cirkel-mark + ordmärket "Tarantula" (700, lila `--color-primary`).
2. **Användarkort** — avatar (40px rund) + namn (14px/600) + e-post (12px/`text-tertiary`) + `ChevronRight`. `bg-surface-inset`, `rounded-input`, padding `10px`.
3. **Navigering** (vertikal lista, 13px/500):
   - `Disc` Spela in (default aktiv)
   - `History` Historik
   - `Settings` Inställningar
   - Aktivt item: text `--color-text`, ikon lila, vänster `bg-primary-soft` pill bakom raden (`rounded-input`, padding `8px 10px`). Inaktivt: `text-secondary`, hover → `bg-surface-inset`.
4. **Spacer** (`flex-1`).
5. **Usage-kort** (nederst, motsvarar "Risher Business"):
   - Etikett "Transkriberat" (13px/600).
   - Progressbar: spår `bg-border` höjd 6px `rounded-pill`, fyllnad `--color-primary` (bredd = använda/total).
   - Text: "300 / 1000 min denna månad" (12px/`text-tertiary`) + "Återställs om 5 dagar".
   - Vid >80%: fyllnaden blir `--color-warning`.

### 5.3 Top-bar
Horisontell rad överst i main, `bg-surface`, `border-b border-border`, höjd ~72px, padding `16px 24px`, `flex items-center gap-3`.

Element vänster→höger:
- `Bell` med röd prick (notis) — valfritt i v1, behåll plats.
- **Sökfält** (flexar): `Search`-ikon + input "Sök inspelningar…", `bg-surface-inset`, `rounded-pill`, höjd 44px.
- **Spela in-knapp** (se 5.4) + split-dropdown `ChevronDown` för capture-inställningar.
- **Importera-knapp** (outline, se 5.4).

### 5.4 Knappar

| Variant | Stil |
|---|---|
| **Primär / Spela in** | bakgrund `--gradient-record`, vit text 14px/600, `Mic`-ikon, `rounded-button`, höjd 44px, padding `0 18px`, `shadow-record`. Hover: ljusare + lyft `translate-y-[-1px]`. |
| **Split-dropdown** | sitter ihop höger om Spela in: smal lila ruta med `ChevronDown`, delad av en 1px ljus linje. Öppnar popover med capture-toggles + "Inkludera systemljud". |
| **Sekundär / Importera** | `bg-surface`, `border border-primary`, text lila 14px/600, `Upload`-ikon, `rounded-button`, höjd 44px. Hover: `bg-primary-soft`. |
| **Stoppa** | `bg-danger`, vit text, `Square`-ikon (fylld), `rounded-button`. Endast i inspelningstillstånd. |
| **Tertiär / text** | bara text lila, ingen yta (t.ex. "Visa mer", "Granska issues →"). |

### 5.5 Kort
Bas för sessions- och issue-kort. `bg-surface`, `border border-border`, `rounded-card`, `shadow-card`, padding `20px`. Hover (klickbara kort): `shadow-card-hover`, kant `--color-border-strong`.

### 5.6 Toggle (pill)
Som Risers mic-toggles. Spår `rounded-pill` bredd 44px höjd 26px. Av: `bg-border`, knopp vit vänster. På: `bg-primary`, knopp vit höger med liten `Mic`/relevant ikon. Animera knoppen `transition-transform 150ms`.

### 5.7 Badge / pill
- **Prioritet**: liten pill, `bg` = prio-soft, prick + text (Brådskande/Hög/Medium/Låg/Ingen) i prio-färg.
- **Status**: Utkast (grå), Skickar (lila, spinner), Skickad (grön + `Check`), Fel (röd).

### 5.8 Input / textarea
`bg-surface-inset` i vila, `border border-border`, `rounded-input`, padding `10px 12px`, 14px. Fokus: `border-primary` + ring `--color-primary-ring` (2px). Textarea auto-växande.

### 5.9 Stepper (pipeline)
Horisontell stepper som speglar flödet. Tre steg: **Transkriberar (Whisper)** → **Genererar issues (GPT-4o)** → **Klar**. Aktivt steg lila med spinner, klart steg grön `Check`, kommande steg grått. Numrerade 1·2·3 (sekvensen är verklig, så numrering bär information).

### 5.10 Waveform / nivåmätare
Rad med ~32 vertikala staplar, `bg-primary`, höjd animeras från live audio-level (Web Audio `AnalyserNode`). I vila: platt grå baslinje. Respektera `prefers-reduced-motion` (visa då en statisk nivåindikator).

---

## 6. Skärm 1 — Inspelnings-UI (`app/page.tsx`)

Tre tillstånd i hero-panelen: **idle → recording → processing**. Sidofält + top-bar är konstanta.

### Wireframe (idle)
```
┌────────────────────┬─────────────────────────────────────────────────────┐
│ [T] Tarantula      │  🔔  [ 🔍 Sök inspelningar        ]  [🎙 Spela in ▾] [⬆ Importera] │
│ ┌────────────────┐ ├─────────────────────────────────────────────────────┤
│ │ 👤 Joel        │ │                                                       │
│ │   joel@…       │ │   ┌───────────────────────────────────────────────┐  │
│ └────────────────┘ │   │            ◉  (stor record-knapp)             │  │
│ ◉ Spela in         │   │     Redo att spela in nästa möte               │  │
│ ↺ Historik         │   │   [🖥 Skärm ●] [🔊 Systemljud ○] [🎙 Mik ●]    │  │
│ ⚙ Inställningar     │   └───────────────────────────────────────────────┘  │
│                    │                                                       │
│                    │   Senaste inspelningar                                │
│                    │   ┌───────────────────────────────────────────────┐  │
│ ┌────────────────┐ │   │ App-sync · 12 jun · 42 min        6 issues    │  │
│ │ Transkriberat  │ │   │ Summering: roadmap, bugg i onboarding…        │  │
│ │ ▓▓▓▓░░ 300/1000│ │   │ [Granska issues →]                            │  │
│ │ Återställs 5 d │ │   └───────────────────────────────────────────────┘  │
│ └────────────────┘ │   ┌───────────────────────────────────────────────┐  │
│                    │   │ Support-genomgång · 10 jun · 28 min  3 issues │  │
└────────────────────┴─────────────────────────────────────────────────────┘
```

### Hero-panel — tillstånd

**Idle**
- Centrerad: stor rund **Spela in**-knapp (96px), `--gradient-record`, `Mic` vit, `shadow-record`, hover-puls.
- Underrubrik: "Redo att spela in nästa möte" (`text-secondary`).
- **Capture-toggles** i rad: `Skärm`, `Systemljud`, `Mikrofon` (komponent 5.6). Default: Skärm på, Mikrofon på, Systemljud av (kräver explicit delning — visa liten hint-ikon med tooltip "Systemljud måste delas i webbläsarens dialog").

**Recording**
- Knappen blir **Stoppa** (`bg-danger`, `Square`). Röd pulserande prick + "Spelar in".
- Stor **timer** `00:00:00` (32px/700, `mono` valfritt).
- **Waveform** (5.10) under timern.
- Rad med aktiva källor (Skärm ●, Mik ●).
- **Storleks-/tidsvarning**: när inspelningen närmar sig ~25 MB eller ~30 min visas en `--color-warning`-rad: "Närmar sig Whispers gräns (25 MB). Stoppa snart för bästa resultat." (chunking stöds inte i v1.)

**Processing** (efter Stoppa)
- Hero ersätts av **Stepper** (5.9): 1 Transkriberar (Whisper) → 2 Genererar issues (GPT-4o) → 3 Klar.
- Under: liten statusrad ("Skickar ljud till Whisper…", "GPT-4o föreslår issues…").
- När klart: auto-navigera till `/review` (issues läggs i `sessionStorage`, se §8).

### Sessionskort (Senaste inspelningar)
Bas-kort (5.5), klickbart. Innehåll:
- **Titel** (auto-genererad eller redigerad) 16px/600.
- Metadata-rad: datum · längd · "N issues" (`text-tertiary`, 13px).
- **Summering**: 2–3 bullets (key points från transkriptet) med ljus timestamp till höger (`text-tertiary`) — exakt som Risers bullets.
- Footer: `[Granska issues →]` (tertiär lila) som navigerar till `/review?session=…`.

### Tomt tillstånd
Om inga sessioner: centrerad illustration/ikon + "Inga inspelningar ännu. Tryck **Spela in** för att fånga ditt första möte." (En tom skärm är en uppmaning att agera, inte bara en gråtext.)

---

## 7. Skärm 2 — Gransknings-UI (`app/review/page.tsx`)

Två kolumner: **issues** (center, fokus, redigerbara) + **transkript-rail** (höger, referens). Sidofält konstant.

### Wireframe
```
┌────────────────────┬───────────────────────────────────┬──────────────────┐
│ SIDEBAR            │ ← Tillbaka   App-sync · 12 jun · 42 min                │
│                    │                       [⬆ Skicka alla till Linear]      │
│                    ├───────────────────────────────────┬──────────────────┤
│                    │ ISSUES (3 förslag)                 │ TRANSKRIPT        │
│                    │ ┌───────────────────────────────┐ │ ┌──────────────┐ │
│                    │ │ ●Hög  Titel…           [✎][🗑] │ │ │00:00 Vi börjar│ │
│                    │ │ Beskrivning… (textarea)        │ │ │01:35 Buggen i…│ │
│                    │ │ #onboarding #app  Team ▾       │ │ │03:42 …        │ │
│                    │ │ [Utkast]      [Skicka ↗]       │ │ │              │ │
│                    │ └───────────────────────────────┘ │ │ (scrollbar)  │ │
│                    │ ┌───────────────────────────────┐ │ │              │ │
│                    │ │ ●Medium  Titel… …             │ │ │              │ │
│                    │ └───────────────────────────────┘ │ └──────────────┘ │
└────────────────────┴───────────────────────────────────┴──────────────────┘
```

### Review-topbar
- `← Tillbaka` (tertiär), sedan **sessionstitel · datum · längd** (h1-stil, motsvarar Risers "Wednesday, June 2024").
- Höger: **Skicka alla till Linear** (primär gradient-knapp, `ArrowUpRight`). Visar antal som ska skickas ("Skicka alla (3)"). Inaktiv om allt redan skickat.

### Issue-kort (redigerbart)
Bas-kort (5.5). Bind mot `LinearIssue` (§8). Anatomi uppifrån:
1. **Rad 1**: prioritets-pill (5.7, klickbar → dropdown Brådskande/Hög/Medium/Låg/Ingen med prio-färger) · höger `Pencil` (toggle redigering) + `Trash2`.
2. **Titel**: redigerbar input (16px/600). I vila ser den ut som ren text; vid fokus blir det ett tydligt fält.
3. **Beskrivning**: auto-växande textarea (14px/`text-secondary`), markdown tillåten.
4. **Metadata-rad**: label-chips (`#`-pills, addbara via "+ Etikett") · Team-dropdown (förvalt från `LINEAR_TEAM_ID`).
5. **Källhänvisning** (valfritt, fint): liten rad "Från transkript 03:42" (`text-tertiary`) — vid hover highlightas motsvarande segment i transkript-railen.
6. **Footer**: status-badge vänster · **Skicka ↗** (sekundär) höger.

#### Issue-kort tillstånd
| Tillstånd | Utseende |
|---|---|
| Utkast | normal, redigerbar, badge "Utkast" (grå) |
| Skickar | dimmat, spinner i badge "Skickar…" (lila), fält låsta |
| Skickad | kant `--color-success`, badge `Check` "Skickad" (grön), fält låsta, "Skicka"→"Öppna i Linear ↗" (länk till issue-URL) |
| Fel | kant `--color-danger`, badge "Fel" (röd) + felmeddelande i klartext ("Kunde inte nå Linear. Försök igen."), knapp "Försök igen" |

### Transkript-rail (höger, 360px)
- Rubrik `FileText` "Transkript".
- Scrollbar lista av segment: `00:01:35` (mono, `text-tertiary`) + text (`text-secondary`). Aktivt/highlightat segment: `bg-primary-soft`.
- Sticky topp med liten "Kopiera"-knapp.
- På smala skärmar: kollapsar till en flik/utfällbar panel (se §9).

### Tomt / fel
- Inga issues genererade: "GPT-4o hittade inga tydliga åtgärder. Du kan skapa en issue manuellt." + `+ Ny issue`.
- API-fel vid generering: röd panel med klartextfel + "Generera om".

---

## 8. Datatyper & dataflöde (för korrekt UI-bindning)

`lib/types.ts` (UI:t binder mot detta — håll fältnamn synkade):

```ts
export type Priority = 0 | 1 | 2 | 3 | 4; // 0 ingen, 1 brådskande … 4 låg (Linear-konvention)

export interface LinearIssue {
  id: string;            // klient-temporärt (uuid)
  title: string;
  description: string;
  priority: Priority;
  labels: string[];
  teamId: string;        // default LINEAR_TEAM_ID
  status: "draft" | "sending" | "sent" | "error";
  linearUrl?: string;    // sätts efter lyckad skapelse
  error?: string;
  sourceTimecode?: string; // t.ex. "00:03:42" för källhänvisning
}

export interface Session {
  id: string;
  title: string;
  date: string;          // ISO
  durationSec: number;
  transcript: TranscriptSegment[];
  issues: LinearIssue[];
}

export interface TranscriptSegment {
  start: number;         // sekunder
  text: string;
}
```

- Data flyttas mellan `/` och `/review` via **`sessionStorage`** (ingen databas i v1). Nyckel t.ex. `tarantula:session`.
- Prioritetsfärger: mappa `Priority` → `--color-prio-*` i en liten helper.

---

## 9. Responsivitet & Electron

- **Brytpunkter**: ≥1280px = full 3-kolumn (Review). 1024–1280px: transkript-rail blir utfällbar flik. <1024px: sidofältet kollapsar till ikon-rail (64px) med tooltips; Review staplar issues över transkript.
- **Electron**: appen laddas via URL i ett Electron-fönster senare. Designa därför fönster-agnostiskt — inga antaganden om browser-chrome. Lämna ~8px luft runt yttre ramen så fönsterkanten andas. Inga `position: fixed`-element som krockar med en framtida titlebar; håll top-bar `sticky top-0` inom main i stället.
- Allt klickbart ska funka med både mus och tangentbord (Electron-användare förväntar sig native-känsla).

---

## 10. Tillgänglighet & rörelse

- Synlig **tangentbordsfokus** överallt: ring `--color-primary-ring` 2px. Aldrig `outline: none` utan ersättning.
- Spela in/Stoppa måste nås via tangentbord och ha `aria-label`.
- Inspelnings-state annonseras via `aria-live` ("Inspelning startad", "Transkriberar…").
- Färg används aldrig ensamt: prioritet och status har alltid ikon + text, inte bara färg.
- `prefers-reduced-motion`: stäng av waveform-animation, record-puls och stepper-spinners (visa statiska tillstånd).
- Kontrast: brödtext `--color-text-secondary` på vitt ≥ 4.5:1 (uppfyllt). Timestamps (`text-tertiary`) endast för icke-kritisk info.

---

## 11. Microcopy (svenska UI-strängar)

Aktiv röst, gemener, namnges utifrån vad användaren gör — inte hur systemet är byggt.

| Plats | Sträng |
|---|---|
| Primär CTA | `Spela in` → under inspelning `Stoppa` |
| Import | `Importera` |
| Capture | `Skärm` · `Systemljud` · `Mikrofon` |
| Processing | `Transkriberar…` · `Genererar issues…` · `Klart` |
| Sessionskort | `Granska issues →` |
| Review CTA | `Skicka alla till Linear (3)` · per kort `Skicka ↗` |
| Skickad | `Skickad` · `Öppna i Linear ↗` |
| Fel | `Kunde inte nå Linear. Försök igen.` |
| Varning storlek | `Närmar sig Whispers gräns (25 MB). Stoppa snart.` |
| Tomt (Home) | `Inga inspelningar ännu. Tryck Spela in för att fånga ditt första möte.` |
| Tomt (Review) | `GPT-4o hittade inga tydliga åtgärder. Skapa en issue manuellt.` |
| Usage | `Transkriberat · 300 / 1000 min denna månad · Återställs om 5 dagar` |

---

## 12. Byggordning (för Claude Code)

1. Lägg in tokens i `app/globals.css` (§2) + ladda Inter via `next/font`.
2. Bygg globala komponenter (§5): `AppShell`, `Sidebar`, `Topbar`, `Button`, `Card`, `Toggle`, `Badge`, `Stepper`, `Waveform`.
3. `app/page.tsx`: sidofält + top-bar + hero-panel med tre tillstånd (idle/recording/processing) + lista av sessionskort.
4. Koppla inspelning (`getDisplayMedia` + `getUserMedia` + `AudioContext`) → blob → `sessionStorage` → navigera `/review` efter processing-stepper.
5. `app/review/page.tsx`: två-kolumnslayout, redigerbara issue-kort (alla fyra tillstånd) + transkript-rail + "Skicka alla".
6. Polish: hover-states, fokusringar, `prefers-reduced-motion`, responsiva brytpunkter (§9–10).

> **Kvalitetsgolv**: responsiv ned till mobil, synlig tangentbordsfokus, reduced-motion respekterad — utan att skrika om det. Lila boldhet spenderas på Spela in-knappen och aktiva tillstånd; allt annat hålls lugnt och disciplinerat.