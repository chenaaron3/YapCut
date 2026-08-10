# Public assets

## AI SFX pack (`sfx/`)

Layout: `sfx/<role>/<variant>/*.{wav,mp3}`

The create/AI pipeline picks a **role** and **variant** (`soft` | `medium` | `hard`). At place time, a deterministic hash selects one file from that folder so interchangeable assets rotate for variety. Re-runs with the same inputs should resolve to the same file.

Drop additional interchangeable clips into any role/variant folder. Prefer short accents (~0.15–0.5s); `build` may be ~1–2s.

Intensity also drives relative volume at place time (soft quieter, hard louder).

**ElevenLabs prompts** below: hyper-specific, ≤15 words each — paste into Sound Effects generator. Duration after each is the suggested generation length.

---

### `build` — hook anticipation

Riser under the open, into the title. One candidate per video. Felt more than heard.

#### `soft` — calm open; title can land alone

- Soft one-second tonal riser, quiet, no percussion, gentle upward pitch — **1.2s**
- Airy reverse cymbal swell, subtle, short, fade into silence before impact — **1.5s**
- Warm pad climb, low drama, smooth filter open, under voiceover level — **1.8s**

#### `medium` — default hook tension into title

- Clean synth riser, one and a half seconds, mid energy, no boom ending — **1.5s**
- White-noise whoosh build ascending, short, crisp, tension without bass hit — **1.4s**
- Electronic tension sweep, filtered noise rising, ends clean before title land — **1.6s**

#### `hard` — high-energy hook / bold claim coming

- Fast bright synth riser, urgent, one second, sharp high-end, no sub drop — **1.0s**
- Aggressive filter sweep riser, punchy, short, builds hard into a cut — **1.1s**
- Short stinger build, rising pitch and noise, stops abruptly before impact — **0.9s**

---

### `reveal` — overlay enter

Title card start and listicle indicator appear. “Something just showed up.”

#### `soft` — understated title or quiet tip card

- Soft UI panel whoosh-in, muted, short, modern app overlay appear sound — **0.35s**
- Gentle title wipe, airy swish, quiet, no bass, half-second enter — **0.45s**
- Muted digital shimmer appear, soft sparkle, brief, understated menu open — **0.40s**

#### `medium` — classic list / tip card enter

- Single paper page flip, dry close-mic, crisp, half second, no room noise — **0.50s**
- Cardboard card slide onto table, short scrape then soft stop — **0.55s**
- Clean UI present chime-swipe hybrid, mid energy, short overlay entrance — **0.45s**

#### `hard` — bold title or high-energy indicator

- Magical sparkle burst appear, bright short glitter, no deep boom — **0.60s**
- Metallic snap-whoosh enter, sharp transient, half second, high midrange — **0.45s**
- Bright pop-in accent, punchy UI appear, short decay, zero sub-bass — **0.35s**

---

### `hit` — weight / thud

Land moment: title weight, hard listicle value. Mass, not air (not a whoosh).

#### `soft` — gentle land; support without boom

- Soft muffled thud, dull body hit, short, no reverb, quiet weight — **0.30s**
- Light wooden knock, single hit, dry, mid-low, gentle confirmation thud — **0.25s**
- Soft tom drum hit, muted, short decay, subtle impact under dialogue — **0.35s**

#### `medium` — default weight on claim / title / value

- Tight mid bass hit, punchy body impact, short, YouTube emphasis thud — **0.40s**
- Clean deep hit, one shot, controlled low end, no long cinematic tail — **0.45s**
- Punchy impact thump, dry studio hit, half second, lands on text pop — **0.50s**

#### `hard` — hook payoff or strongest number

- Short sub-bass drop hit, heavy, tight decay under 400ms, no rumble tail — **0.40s**
- Cinematic boom trimmed short, chest punch, abrupt end, mono-friendly — **0.50s**
- Heavy slam impact, hard transient then quick fade, powerful but brief — **0.45s**

---

### `tick` — listicle value confirm

Value text lands (stagger middle, or start if none). “Checked / selected.”

#### `soft` — quiet confirm; dense list already noisy

- Soft fingertip tap on glass, single, dry, very quiet UI tick — **0.12s**
- Light plastic switch tick, tiny click, short, no reverb — **0.10s**
- Soft stylus tap on tablet screen, gentle, single, minimal high click — **0.15s**

#### `medium` — default value land

- Crisp computer mouse click, single press, dry office desk, short — **0.15s**
- UI checkbox select click, sharp plastic, one shot, clear confirmation — **0.18s**
- Single mechanical keyboard key press, dry, mid click, no typing roll — **0.12s**

#### `hard` — punchy / playful list item

- Snappy cartoon boop, upbeat, short, playful UI confirm, no voice — **0.25s**
- Bright upbeat digital boop, rising pitch blip, punchy half-second select — **0.35s**
- Playful pop-select blip, cartoon UI, sharp attack, quick cute decay — **0.30s**

---

### `ping` — quote peak sparkle

Last emphasized word inside a quote. Often skipped (`none`). Bright and short, not heavy.

#### `soft` — gentle keyword pop

- Soft light chime ding, single high note, quiet, short sparkle — **0.40s**
- Gentle lips pop, organic mouth pop, tiny, dry, no comedy stretch — **0.15s**
- Soft glass finger tap chime, delicate, brief, understated highlight — **0.35s**

#### `medium` — clear UI highlight; default

- Short clean UI beep, mid pitch, one blip, notification-style highlight — **0.35s**
- Digital notification ping, clear, short, no melody, single tone — **0.40s**
- Clean interface ping, square-ish beep, half second, sits under speech — **0.45s**

#### `hard` — memorable / high-stakes word

- Bright strong ding, high bell accent, sharp, short, attention-grabbing — **0.55s**
- Achievement chime hit, single bright bell, triumphant but brief — **0.60s**
- Sharp glass bell ping, loud-ish transient, fast decay, memorable word pop — **0.50s**

---

### `motion` — punch-in camera energy

Hard zoom (no ease) start. Air / swipe under voice — quieter than hits.

#### `soft` — subtle punch; calm delivery

- Light airy swish, soft camera swipe, short, no bass, subtle zoom — **0.30s**
- Gentle short whoosh, quiet air pass, half second, calm punch-in — **0.35s**
- Soft fabric-like swipe whoosh, muted highs, brief, under voiceover — **0.30s**

#### `medium` — default punch-in

- Clean mid whoosh, standard YouTube transition swoosh, short, no boom — **0.40s**
- Deep airy whoosh, fuller body still wind not bass hit, half second — **0.45s**
- Smooth stereo whoosh pass, mid energy, punch-in camera move accent — **0.40s**

#### `hard` — strong claim / hook punch-in

- Punchy zoom whoosh, fast whip air, sharp, short, energetic punch-in — **0.45s**
- Hard fast swoosh, aggressive air cut, bright transient, no sub drop — **0.40s**
- Sci-fi digital swipe whoosh, processed, snappy, camera slam energy — **0.50s**

---

### Quick reference

| Role | Job | Candidates |
|------|-----|------------|
| `build` | Anticipation | Hook open → into title |
| `reveal` | Overlay enter | Title card + listicle indicator |
| `hit` | Weight / thud | Title land, hard listicle value |
| `tick` | Value confirm | Listicle value land |
| `ping` | Word sparkle | Quote peak emphasis |
| `motion` | Camera energy | Punch-in zoom only |

No b-roll companions. No meme / texture packs in the AI pool.

### `custom/memes/` — manual library only

Seeded into the global SFX picker for drag-and-drop. **Not** part of the AI companion pack — the LLM never selects these.
