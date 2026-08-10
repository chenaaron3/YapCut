/**
 * Curated AI SFX pack — create-pipeline companion SFX only.
 * LLM picks role + intensity; place-time hash picks a concrete global Asset
 * from `public/sfx/<role>/<intensity>/` (seeded with that relative path).
 */

export const AI_SFX_ROLES = [
  "build",
  "reveal",
  "hit",
  "tick",
  "ping",
  "motion",
] as const;
export type AiSfxRole = (typeof AI_SFX_ROLES)[number];

export const AI_SFX_INTENSITIES = ["soft", "medium", "hard"] as const;
export type AiSfxIntensity = (typeof AI_SFX_INTENSITIES)[number];

export type AiSfxVariant = {
  /** Stable id for LLM choice, e.g. `motion.soft`. */
  id: `${AiSfxRole}.${AiSfxIntensity}`;
  role: AiSfxRole;
  intensity: AiSfxIntensity;
  label: string;
  /** Short vibe note shown to the LLM. */
  description: string;
};

/** Companion SFX stacking: drop lower-priority hit if closer than this. */
export const COMPANION_SFX_MIN_GAP_SEC = 0.3;

/**
 * Priority when two companions want onsets within {@link COMPANION_SFX_MIN_GAP_SEC}.
 * Higher wins.
 */
export const COMPANION_SFX_ROLE_PRIORITY: Record<AiSfxRole, number> = {
  build: 4,
  reveal: 3,
  hit: 3,
  tick: 3,
  ping: 2,
  motion: 1,
};

/** Linear gain by intensity (under dialogue). */
export const AI_SFX_VOLUME_BY_INTENSITY: Record<AiSfxIntensity, number> = {
  soft: 0.45,
  medium: 0.65,
  hard: 0.85,
};

export function volumeForIntensity(intensity: AiSfxIntensity): number {
  return AI_SFX_VOLUME_BY_INTENSITY[intensity];
}

const ROLE_SET = new Set<string>(AI_SFX_ROLES);
const INTENSITY_SET = new Set<string>(AI_SFX_INTENSITIES);

/**
 * Catalog: one entry per role × intensity. No asset UUIDs — pools come from
 * seeded global Assets keyed by relative path.
 */
export const AI_SFX_PACK: readonly AiSfxVariant[] = [
  {
    id: "build.soft",
    role: "build",
    intensity: "soft",
    label: "Soft rise",
    description: "Calm hook anticipation; title can land alone.",
  },
  {
    id: "build.medium",
    role: "build",
    intensity: "medium",
    label: "Clean rise",
    description: "Default hook tension into title.",
  },
  {
    id: "build.hard",
    role: "build",
    intensity: "hard",
    label: "Sharp rise",
    description: "High-energy hook; bold claim coming.",
  },
  {
    id: "reveal.soft",
    role: "reveal",
    intensity: "soft",
    label: "Soft enter",
    description: "Understated title or quiet tip card appear.",
  },
  {
    id: "reveal.medium",
    role: "reveal",
    intensity: "medium",
    label: "Card enter",
    description: "Classic list / tip card or title enter.",
  },
  {
    id: "reveal.hard",
    role: "reveal",
    intensity: "hard",
    label: "Snap enter",
    description: "Bold title or high-energy indicator appear.",
  },
  {
    id: "hit.soft",
    role: "hit",
    intensity: "soft",
    label: "Soft thud",
    description: "Gentle weight land; support without boom.",
  },
  {
    id: "hit.medium",
    role: "hit",
    intensity: "medium",
    label: "Body hit",
    description: "Default weight on title / claim / value land.",
  },
  {
    id: "hit.hard",
    role: "hit",
    intensity: "hard",
    label: "Hard boom",
    description: "Hook payoff or strongest number drop.",
  },
  {
    id: "tick.soft",
    role: "tick",
    intensity: "soft",
    label: "Soft tap",
    description: "Quiet listicle value confirm.",
  },
  {
    id: "tick.medium",
    role: "tick",
    intensity: "medium",
    label: "Click",
    description: "Default listicle value land / UI select.",
  },
  {
    id: "tick.hard",
    role: "tick",
    intensity: "hard",
    label: "Punchy boop",
    description: "Playful or punchy list item confirm.",
  },
  {
    id: "ping.soft",
    role: "ping",
    intensity: "soft",
    label: "Soft ding",
    description: "Gentle quote keyword sparkle; often skip.",
  },
  {
    id: "ping.medium",
    role: "ping",
    intensity: "medium",
    label: "Beep",
    description: "Clear quote peak highlight.",
  },
  {
    id: "ping.hard",
    role: "ping",
    intensity: "hard",
    label: "Strong ding",
    description: "Memorable / high-stakes word in a quote.",
  },
  {
    id: "motion.soft",
    role: "motion",
    intensity: "soft",
    label: "Soft swish",
    description: "Subtle punch-in; calm delivery.",
  },
  {
    id: "motion.medium",
    role: "motion",
    intensity: "medium",
    label: "Whoosh",
    description: "Default punch-in camera energy.",
  },
  {
    id: "motion.hard",
    role: "motion",
    intensity: "hard",
    label: "Hard whoosh",
    description: "Strong claim / hook punch-in whoosh.",
  },
] as const;

const BY_ID = new Map(AI_SFX_PACK.map((v) => [v.id, v]));

export function getAiSfxVariant(id: string): AiSfxVariant | undefined {
  return BY_ID.get(id as AiSfxVariant["id"]);
}

export function aiSfxVariantsForRole(role: AiSfxRole): AiSfxVariant[] {
  return AI_SFX_PACK.filter((v) => v.role === role);
}

export function variantIdFor(
  role: AiSfxRole,
  intensity: AiSfxIntensity,
): AiSfxVariant["id"] {
  return `${role}.${intensity}`;
}

/** Parse `build/soft/foo.wav` → pool key; ignore `custom/…` and unknown paths. */
export function parseAiSfxPoolPath(
  relativePath: string,
): { role: AiSfxRole; intensity: AiSfxIntensity; variantId: AiSfxVariant["id"] } | null {
  const cleaned = relativePath.replace(/^\/+/, "").replace(/\\/g, "/");
  const parts = cleaned.split("/");
  if (parts.length < 3) return null;
  const [role, intensity] = parts;
  if (!role || !intensity) return null;
  if (!ROLE_SET.has(role) || !INTENSITY_SET.has(intensity)) return null;
  const r = role as AiSfxRole;
  const i = intensity as AiSfxIntensity;
  return { role: r, intensity: i, variantId: variantIdFor(r, i) };
}

/** Stable hash → index into a sorted pool. */
export function pickAiSfxAssetId(
  poolAssetIds: readonly string[],
  seedKey: string,
): string | null {
  if (poolAssetIds.length === 0) return null;
  const sorted = [...poolAssetIds].sort();
  let h = 2166136261;
  for (let i = 0; i < seedKey.length; i++) {
    h ^= seedKey.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const idx = Math.abs(h) % sorted.length;
  return sorted[idx] ?? null;
}

/** LLM-facing catalog: roles, ids, intensity, descriptions (not asset UUIDs). */
export function formatAiSfxPackForPrompt(): string {
  const lines: string[] = [
    "AI SFX pack (pick variant id like motion.soft, or none). Stay in the role for each companion.",
  ];
  for (const role of AI_SFX_ROLES) {
    lines.push(`## ${role}`);
    for (const v of aiSfxVariantsForRole(role)) {
      lines.push(`- ${v.id} [${v.intensity}] ${v.label}: ${v.description}`);
    }
  }
  return lines.join("\n");
}

/** Asset id for a variant pool + seed, or null if unknown / empty pool. */
export function resolveAiSfxAssetId(
  variantId: string,
  seedKey: string,
  pools: ReadonlyMap<string, readonly string[]>,
): string | null {
  const variant = getAiSfxVariant(variantId);
  if (!variant) return null;
  const pool = pools.get(variant.id);
  if (!pool?.length) return null;
  return pickAiSfxAssetId(pool, seedKey);
}

/** Expected on-disk folders for seed validation. */
export function expectedAiSfxPoolDirs(): string[] {
  const out: string[] = [];
  for (const role of AI_SFX_ROLES) {
    for (const intensity of AI_SFX_INTENSITIES) {
      out.push(`${role}/${intensity}`);
    }
  }
  return out;
}
