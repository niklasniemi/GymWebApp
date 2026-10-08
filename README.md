# Forge — Workout Tracker

A mobile-first, offline-first gym and calorie tracker that runs entirely in the browser. No backend, no account — data lives on your device in IndexedDB. Installable as a PWA and deployable to GitHub Pages for free.

## Features

**Momentum & goals**

- **The fire** — an animated flame showing how "on fire" you are. Every workout feeds it (more for heavier sessions relative to your own recent median volume/sets), it grows live set by set during a session, and it decays daily without training. Train to your weekly goal and it holds near maximum. Tap it for sparks
- Weekly goal (1–7×), "This week 2/3" progress, and a **goal streak** that only counts weeks that hit the goal
- Top-of-screen reminder when your streak ends in 2 or 1 days and the goal isn't met yet

**Workout logging**

- Touch-first active workout screen: 48 px+ targets, ± steppers with press-and-hold repeat, select-on-focus inputs, comma decimals
- Set types: normal, warm-up, drop set, failure · optional RPE or RIR per set
- Previous-session values shown per set (warm-ups matched to warm-ups); tap **Previous** to copy them, or just tap ✓ to log a repeat
- Later sets inherit earlier values as placeholders, so straight sets are one tap each
- Rest timer starts automatically on set completion: floating bar, compositor-only progress ring, ±15 s, presets (1:00 / 1:30 / 2:00 / 3:00), chime + vibration
- Swipe a set left to reveal **Delete** (long swipe deletes instantly, with Undo)
- **Log a past workout** you forgot to start at the gym (pick date and times; previous values and PRs compare only against earlier sessions)
- Edit the start time of a running workout, and the name/date/times of finished ones
- **Log runs** afterwards (no live tracking): outdoor / treadmill / trail, distance, time, effort, elevation, heart rate and notes — with live pace, speed and calorie estimate. Runs count toward your weekly goal, streak and fire (effort is compared with your earlier runs), and show in history
- **Other sports & activities** logged afterwards — tennis, padel, badminton, squash, football, floorball, ice hockey, cycling, swimming, hiking, cross-country skiing, climbing, yoga and more: duration, effort, optional distance and heart rate. Energy from MET values (Compendium of Physical Activities), and they count toward the weekly goal, streak and fire; an Activities widget shows time per sport
- **Running records**: longest run, fastest pace and estimated best 5K / 10K / half (Riegel), weekly distance chart; km or miles follow your unit setting
- In-progress workout survives refreshes, tab closes and app switches
- Screen wake lock during workouts

**Routines & exercises**

- Unlimited routines with drag-to-reorder (keyboard accessible), per-exercise sets / rep targets / rest
- **3D muscle map per routine** — see which muscles a routine trains (live preview while editing)
- Starter Push / Pull / Legs templates; save any finished workout as a routine
- 75+ built-in exercises, filterable by muscle group and equipment; custom exercises with primary + secondary muscles
- **Favourite exercises** (★) — pinned to the top of pickers and the library, with a Favourites filter

**Food & calories**

- **Food tab** with a calorie ring (left / over), the goal − food (+ workouts) budget, and protein / carb / fat bars
- Breakfast, lunch, dinner and snacks; swipe an item left to delete (with Undo), tap to change the amount or meal
- **Fast logging**: recents with one-tap **+** (remembers the portion you last used), 280+ built-in foods incl. Finnish staples (ruisleipä, rahka, karjalanpiirakka…), servings or grams, quick-amount chips
- **Barcode scanner** — camera scanning (native `BarcodeDetector`, or a self-hosted ZXing WebAssembly fallback for iPhone) with manual entry; products come from [Open Food Facts](https://world.openfoodfacts.org) and are saved for offline reuse. Unknown barcodes can be added from the label once
- Custom foods (per 100 g or per serving), **saved meals** for one-tap logging, quick-add calories, copy a meal or whole day from yesterday
- Water tracker (glasses of 250 ml) and a weekly calorie chart
- **Target weight**: progress from your starting weight, what's left, and when you'll get there — both at your planned weekly rate and at your actual weigh-in trend (least-squares over the last 4 weeks). Shown on Food, Profile, Analytics → Body (with a target line on the weight chart) and as a widget
- **Goals** from the Mifflin-St Jeor equation: sex, age, height, activity and lose / maintain / gain rate → calories, protein (1.8–2.0 g/kg), fat, carbs and water. Uses your latest logged body weight automatically; manual override available; optionally add workout calories to the budget
- Nutrition widgets on Workout and Profile, plus Calories (14 days vs target) and Macros (7-day split, protein consistency) in Analytics

**Tools** (Profile → Tools, the Workout board, or the active workout's menu)

- Plate calculator with a visual barbell (kg & lb plates, 20/15/10 kg or 45/35/15 lb bars, custom bar, toggle available plates)
- Warm-up generator (Standard 40/60/80 %, Heavy, Quick), rounded to loadable weights — also built into each exercise and addable straight into a workout
- Epley 1RM estimator with %1RM table

**Analytics**

- **Rotating 3D body heat map** of training volume — Today / Week / Month / Year; the more sets a muscle got, the hotter it glows. Tap a muscle (or the ranked list) to inspect it
- Real-time PR detection (heaviest weight, most reps, best set volume, est. 1RM) with haptics, sound and an animated toast
- **Per-lift history**: every exercise with a sparkline and change since you started; full view with time ranges, PR-marked chart and a session table
- Daily/weekly/monthly volume (1W–All), training-frequency heatmap, recent PRs
- More widgets: weekly goal history, momentum history, weekly sets per muscle vs the 10–20 growth range, most improved lifts, rep-range mix, when you train, session length, records, and lifetime totals ("≈ 3.2 African elephants")
- **Profile** tab: lifetime stats, frequency calendar, this week's 3D muscles, weekly goal — with the ⚙︎ Settings inside
- Body measurements (weight, body fat, 8 circumferences) with an exponentially smoothed trend line

**Design**

- Light / dark / system theme, **8 accent colours**, plus a **Liquid Glass** mode (translucent `bg-white/70` / `bg-slate-900/60` surfaces, `backdrop-blur-md backdrop-saturate-150`, specular top edge, layered shadows)
- Battery saver: automatically drops to solid surfaces on low battery, Save-Data or _Reduce Transparency_
- Bottom sheets on phones (drag to dismiss), dialogs on desktop; side rail navigation on large screens
- **Customisable widgets** on the Workout and Analytics tabs — tap **Edit** to reorder, remove or add; every widget opens its detailed view

**Data**

- JSON backup / restore (merge or replace, includes the food diary and nutrition goals) and CSV export / import (one row per set) for moving data between devices; food diary CSV export
- Uses the native share sheet on phones so backups can go straight to Files, AirDrop or Drive
- Requests persistent storage so the browser doesn't evict your data

## Tech stack

React 19 · TypeScript · Vite · Tailwind CSS v4 · Framer Motion · Recharts · Dexie (IndexedDB) · Zustand · vite-plugin-pwa (Workbox) · Lucide icons · Vitest

## Getting started

```bash
npm install
npm run dev
```

| Script                        | Purpose                                        |
| ----------------------------- | ---------------------------------------------- |
| `npm run dev`                 | Dev server                                     |
| `npm run build`               | Type-check + production build into `dist/`     |
| `npm run preview`             | Serve the production build (service worker on) |
| `npm test`                    | Unit tests (calc, PRs, nutrition, CSV/JSON, storage) |
| `npm run lint`                | ESLint (incl. React Compiler rules)            |
| `npm run format`              | Prettier                                       |
| `npm run generate-pwa-assets` | Regenerate PWA icons from `public/favicon.svg` |
| `node scripts/optimize-model.mjs <in.glb>` | Rebuild `public/models/human_body.glb` (strip UVs, weld, quantise) |

## Deploying to GitHub Pages

1. Push this project to a GitHub repository (default branch `main`).
2. In the repo, go to **Settings → Pages** and set **Source** to **GitHub Actions**.
3. Every push to `main` runs `.github/workflows/deploy.yml`: lint → test → build → deploy.

The workflow sets `BASE_PATH` from the Pages configuration, so both project sites (`user.github.io/repo/`) and user sites (`user.github.io`) work. Routing uses URL hashes (`#/analytics`), so no 404 redirect hacks are needed.

To build for a sub-path locally: `BASE_PATH=/my-repo/ npm run build`.

## Architecture

```
src/
  types.ts              Domain model (weights stored in kg, lengths in cm)
  data/exercises.ts     Built-in exercise catalog + starter routines
  data/foods.ts         Built-in foods (typical values per 100 g / 100 ml)
  db/persistence.ts     Storage adapter: IndexedDB → localStorage → memory fallback
  store/                Zustand stores
    data.ts             Persisted library (exercises, routines, workouts, measurements,
                        foods, food diary, saved meals, water)
    nutrition.ts        Calorie / macro goals and preferences
    workout.ts          Active workout (debounced localStorage, flushed on pagehide)
    timer.ts            Rest timer (timestamp-based, survives backgrounding)
    settings.ts, ui.ts, toast.ts, tools.ts
  lib/                  Pure logic: Epley, plates, warm-ups, PR detection, analytics,
                        nutrition targets, Open Food Facts client,
                        CSV/JSON import-export, haptics, sound, PWA
  components/           UI primitives, workout, exercises, routines, tools, analytics
  pages/                One per tab; Analytics (and Recharts) is lazy-loaded
```

### 3D body map

`public/models/human_body.glb` is a single-mesh model, optimised from ~1 MB to ~400 KB (~310 KB gzipped). At load, every vertex is assigned to one of 16 muscle regions by `src/components/body/bodyRig.ts`, using landmarks measured off the mesh (arm axis, elbow, wrist, crotch, knee…) plus the surface normal for front / back / inner / outer. Per-muscle heat is written to a vertex attribute and blurred across neighbouring vertices for soft heat-map edges. A custom shader renders the translucent "hologram" look (fresnel rim, x-ray back faces). three.js and the model load lazily the first time a body map is shown, and are cached for offline use.

### Performance notes

- Animations touch only `transform` and `opacity`. The rest-timer ring is two clipped half-arcs rotated by a single CSS animation (negative `animation-delay` = elapsed time) — zero JavaScript per frame.
- Set rows and exercise cards are memoized and subscribe to narrow store slices; PR status is selected as a primitive string, so completing one set re-renders only the rows that changed.
- Number inputs commit through a debounced handler; ticking clocks live in small leaf components.
- Blur is never stacked: nested glass surfaces fall back to a cheaper translucent fill, and the ambient background is a static gradient.
- Vendor code is split into long-lived chunks (react, motion, dexie); Recharts loads on demand and is prefetched at idle.
- The calorie ring uses the same compositor-only half-arc technique; the Food tab's charts are plain CSS transforms, so it never loads Recharts. The barcode decoder (~1 MB WebAssembly) loads only when the scanner opens and is then cached for offline use.

## Credits

Food data: product lookups use [Open Food Facts](https://world.openfoodfacts.org), available under the [Open Database License](https://opendatacommons.org/licenses/odbl/1-0/). Built-in foods are rounded typical values from standard food-composition tables.

3D body model: [“HUMAN_BODY”](https://sketchfab.com/3d-models/human-body-f022e4a3641943328b2fbfdf0f7c3e1e) by [vistaalienprime](https://sketchfab.com/vistaalienprime5665288), licensed [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Modified: UVs removed, geometry welded and quantised, segmented into muscle regions at runtime.

## Browser notes

- **Haptics** use the Vibration API (Android). iOS has no Vibration API; on iOS 18+ Forge triggers the system haptic via a native switch control during taps, and **Haptic sounds** (on by default on iPhone) play soft synthesised clicks instead — they follow the silent switch.
- **Pinch-zoom is disabled** (viewport meta, `touch-action`, and iOS gesture events) for an app-like feel.
- **Streak reminders** appear when you open the app; web apps can't schedule notifications while closed without a push server.
- **Sound** unlocks on the first tap (browser autoplay rules).
- **Install** via the browser's install prompt (Settings → Install Forge), or on iPhone: Share → Add to Home Screen.
- Data is per browser and per origin. Use **Settings → Data & backup** to move it between devices.
- **Barcode scanning** needs camera permission and HTTPS (GitHub Pages is fine). Only the barcode is sent to Open Food Facts. Their free-text product search turns away anonymous browser traffic when busy, so Forge runs it only when you tap **Search products** and falls back gracefully; barcode lookups aren't affected.
