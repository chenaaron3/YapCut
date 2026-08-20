# Stickers

Catalog overlays. One model: `{ source, catalogId }` on the Edit; files and labels live in `src/domain/sticker-catalog.json` (hydrated by `src/domain/sticker.ts`). `source` is the render style — **emoji** loops, **lordicon** (Marks) plays intro then holds. Both are Lottie; playback speeds up if the clip is shorter than one cycle.

Refresh / extend:

```sh
python3 scripts/sync-stickers.py
```

That pulls Noto **top 250** by `popularity` (plus our original emoji if any fell outside), Lordicon Wired Flat **[Popular](https://lordicon.com/icons/wired/flat#c:popular)** (~70), the original Marks, and a hand-picked talking-head set (numbers, quote, mic, …). It writes files here and regenerates `sticker-catalog.json`. Existing files are skipped.

Library tabs: Popular (curated mix) / Emoji / Marks / All. Search matches the full catalog.

---

## Emoji — Google Noto Animated Emoji

**Browse:** [Noto Emoji Animation](https://googlefonts.github.io/noto-emoji-animation/)

**Rank:** `https://googlefonts.github.io/noto-emoji-animation/data/api.json` field `popularity` (higher = more used).

**File:** `emoji/<id>.json`

```
https://fonts.gstatic.com/s/e/notoemoji/latest/<codepoint>/lottie.json
```

`<codepoint>` is lowercase hex with no `U+`. Sequences use `_` (`2665_fe0f`).

Manual add: drop the JSON, append a row to `sticker-catalog.json`:

```json
{ "id": "fire", "source": "emoji", "label": "Fire", "glyph": "🔥", "popular": true }
```

---

## Marks — Lordicon Wired Flat

**Browse:** [Wired / Flat Popular](https://lordicon.com/icons/wired/flat#c:popular)

**List:** `https://lordicon.com/api/library/icons?family=wired&style=flat&category=popular`

Public CDN has no `.json`. Use `.svg` (library thumb) + `.li` (Base64, XOR `0x2A` → Lottie). Crop to the first marker whose `cm` starts with `in`.

```
https://media.lordicon.com/icons/wired/flat/<index>-<name>.svg
https://media.lordicon.com/icons/wired/flat/<index>-<name>.li
```

Manual add: those two files as `lordicon/<id>.svg` + `.json`, then:

```json
{ "id": "arrow-down", "source": "lordicon", "label": "Arrow down", "popular": true }
```
