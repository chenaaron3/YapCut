# Stickers

Catalog overlays. One model: `{ source, catalogId }` on the Edit; files and labels live in `src/domain/edit/sticker-catalog.json` (hydrated by `src/domain/edit/sticker.ts`). `source` is the render style — **emoji** loops, **lordicon** (Marks) plays intro then holds. Both are Lottie; playback speeds up if the clip is shorter than one cycle.

Layout: `public/stickers/{source}/{topic}/{id}.json` (lordicon also has a sibling `{id}.svg` thumb). `topic` is on each catalog row; hydrate derives the path. Existing Edits keep `{ source, catalogId }` — do not rename ids.

Refresh / extend:

```sh
python3 scripts/sync-stickers.py
```

That pulls the full Noto Animated Emoji catalogue except Fitzpatrick skin-tone variants (default yellow only; pinned Popular ids + 15 food/drink keep stable slugs), Lordicon Wired Flat **[Popular](https://lordicon.com/icons/wired/flat#c:popular)** (~70), the original Marks, and a hand-picked talking-head set (numbers, quote, mic, …). It writes files into topic folders, moves leftovers from the old flat dirs, prunes unreferenced files, and regenerates `sticker-catalog.json`. Existing dest files are skipped.

Library tabs: Popular (curated mix) / Emoji / Marks / All. Search matches the full catalog.

---

## Emoji — Google Noto Animated Emoji

**Browse:** [Noto Emoji Animation](https://googlefonts.github.io/noto-emoji-animation/)

**Rank:** `https://googlefonts.github.io/noto-emoji-animation/data/api.json` field `popularity` (higher = more used).

**Topic:** Unicode `emoji-test.txt` group, slugified:

| Unicode group | folder |
|---|---|
| Smileys & Emotion | `smileys-emotion` |
| People & Body | `people-body` |
| Animals & Nature | `animals-nature` |
| Food & Drink | `food-drink` |
| Travel & Places | `travel-places` |
| Activities | `activities` |
| Objects | `objects` |
| Symbols | `symbols` |
| Flags | `flags` |
| Component | `component` |

Default (yellow) form only — Fitzpatrick skin-tone sequences are skipped. Standalone Component modifiers land in `component` if present.

**File:** `emoji/<topic>/<id>.json`

```
https://fonts.gstatic.com/s/e/notoemoji/latest/<codepoint>/lottie.json
```

`<codepoint>` is lowercase hex with no `U+`, each segment padded to ≥4 digits (`00a9_fe0f`). Sequences use `_` (`2665_fe0f`).

Manual add: drop the JSON in the topic folder, append a row to `sticker-catalog.json`:

```json
{ "id": "fire", "source": "emoji", "label": "Fire", "glyph": "🔥", "popular": true, "topic": "travel-places" }
```

---

## Marks — Lordicon Wired Flat

**Browse:** [Wired / Flat Popular](https://lordicon.com/icons/wired/flat#c:popular)

**List:** `https://lordicon.com/api/library/icons?family=wired&style=flat&category=popular`

**Topic:** Lordicon library category, collapsed:

| folders | Lordicon categories |
|---|---|
| `ui` | interface, files |
| `people` | people, characters-and-symbols |
| `media` | photo-and-video, music-and-audio, celebrations |
| `business` | finance-and-stats, work-and-education, shopping |
| `tech` | tech-and-devices, science-and-industry |
| `objects` | everything else |

Public CDN has no `.json`. Use `.svg` (library thumb) + `.li` (Base64, XOR `0x2A` → Lottie). Crop to the first marker whose `cm` starts with `in`.

```
https://media.lordicon.com/icons/wired/flat/<index>-<name>.svg
https://media.lordicon.com/icons/wired/flat/<index>-<name>.li
```

Manual add: those two files as `lordicon/<topic>/<id>.svg` + `.json`, then:

```json
{ "id": "arrow-down", "source": "lordicon", "label": "Arrow down", "popular": true, "topic": "ui" }
```
