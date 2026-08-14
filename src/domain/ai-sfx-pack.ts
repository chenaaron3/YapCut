import { SFX_VOLUME_DEFAULT } from "~/domain/audio/mix-levels";

/**
 * Curated AI SFX pack — create-pipeline companion SFX only.
 * LLM picks intensity for a candidate's fixed role; place-time hash picks a
 * concrete global Asset from `public/sfx/<role>/`. Soft/medium/hard map to
 * volume; `none` skips placement.
 */

export const AI_SFX_ROLES = [
  "reveal",
  "tick",
  "ping",
  "motion",
] as const;
export type AiSfxRole = (typeof AI_SFX_ROLES)[number];

export const AI_SFX_INTENSITIES = ["soft", "medium", "hard", "none"] as const;
export type AiSfxIntensity = (typeof AI_SFX_INTENSITIES)[number];

/** Intensities that place an SFX (and set volume). */
export type AiSfxVolumeIntensity = Exclude<AiSfxIntensity, "none">;

export type AiSfxRoleEntry = {
  role: AiSfxRole;
  label: string;
  /** Short vibe note shown to the LLM. */
  description: string;
  /** When to pick each intensity for this role. */
  intensities: Record<AiSfxIntensity, string>;
};

/** Companion SFX stacking: drop lower-priority onset if closer than this. */
export const COMPANION_SFX_MIN_GAP_SEC = 0.3;

/**
 * Priority when two companions want onsets within {@link COMPANION_SFX_MIN_GAP_SEC}.
 * Higher wins.
 */
export const COMPANION_SFX_ROLE_PRIORITY: Record<AiSfxRole, number> = {
  reveal: 3,
  tick: 3,
  ping: 2,
  motion: 1,
};

/** Linear gain by intensity (under dialogue). Medium = mix default. */
export const AI_SFX_VOLUME_BY_INTENSITY: Record<AiSfxVolumeIntensity, number> = {
  soft: SFX_VOLUME_DEFAULT * 0.7,
  medium: SFX_VOLUME_DEFAULT,
  hard: SFX_VOLUME_DEFAULT * 1.25,
};

export function volumeForIntensity(intensity: AiSfxVolumeIntensity): number {
  return AI_SFX_VOLUME_BY_INTENSITY[intensity];
}

const ROLE_SET = new Set<string>(AI_SFX_ROLES);
const INTENSITY_SET = new Set<string>(AI_SFX_INTENSITIES);
const VOLUME_INTENSITY_SET = new Set<string>(["soft", "medium", "hard"]);

export function isAiSfxIntensity(value: string): value is AiSfxIntensity {
  return INTENSITY_SET.has(value);
}

export function isAiSfxVolumeIntensity(
  value: string,
): value is AiSfxVolumeIntensity {
  return VOLUME_INTENSITY_SET.has(value);
}

/**
 * Catalog: one entry per role. No asset UUIDs — pools come from seeded
 * global Assets keyed by relative path under that role.
 */
export const AI_SFX_PACK: readonly AiSfxRoleEntry[] = [
  {
    role: "reveal",
    label: "Overlay enter",
    description: "Title card or listicle indicator appear — something just showed up.",
    intensities: {
      soft: "Understated title or quiet tip card.",
      medium: "Classic list / tip card or title enter.",
      hard: "Bold title or high-energy indicator appear.",
      none: "Almost never — place on every enter.",
    },
  },
  {
    role: "tick",
    label: "Value confirm",
    description: "Listicle value land / UI select confirm.",
    intensities: {
      soft: "Quiet confirm when the list is already dense.",
      medium: "Default value land.",
      hard: "Punchy or playful list item confirm.",
      none: "Almost never — use soft instead of skipping when dense.",
    },
  },
  {
    role: "ping",
    label: "Quote sparkle",
    description: "Bright short highlight on a quote peak word.",
    intensities: {
      soft: "Gentle keyword pop; fine for lighter peaks.",
      medium: "Clear quote peak highlight.",
      hard: "Memorable / high-stakes word.",
      none: "Only if the peak word is weak filler with no payoff.",
    },
  },
  {
    role: "motion",
    label: "Punch-in whoosh",
    description: "Air / swipe under a hard punch-in zoom; quieter than overlay enters.",
    intensities: {
      soft: "Subtle punch-in; calm delivery.",
      medium: "Default punch-in energy.",
      hard: "Strong claim / hook punch-in.",
      none: "Only for tiny accidental punch-ins; prefer soft when calm.",
    },
  },
] as const;

const BY_ROLE = new Map(AI_SFX_PACK.map((e) => [e.role, e]));

export function getAiSfxRole(role: string): AiSfxRoleEntry | undefined {
  return BY_ROLE.get(role as AiSfxRole);
}

/** Parse `reveal/foo.wav` → role; ignore `custom/…` and unknown paths. */
export function parseAiSfxPoolPath(
  relativePath: string,
): { role: AiSfxRole } | null {
  const cleaned = relativePath.replace(/^\/+/, "").replace(/\\/g, "/");
  const parts = cleaned.split("/");
  if (parts.length !== 2) return null;
  const [role, file] = parts;
  if (!role || !file || file.includes("..")) return null;
  if (!ROLE_SET.has(role)) return null;
  return { role: role as AiSfxRole };
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

/** LLM-facing catalog: roles, intensity use-cases (not asset UUIDs). */
export function formatAiSfxPackForPrompt(): string {
  const lines: string[] = [
    "AI SFX pack — role is fixed per candidate; pick soft|medium|hard|none.",
    "Default to placing (soft/medium/hard). soft/medium/hard map to volume; none skips.",
  ];
  for (const entry of AI_SFX_PACK) {
    lines.push(`## ${entry.role} — ${entry.label}`);
    lines.push(entry.description);
    for (const intensity of AI_SFX_INTENSITIES) {
      lines.push(`- ${intensity}: ${entry.intensities[intensity]}`);
    }
  }
  return lines.join("\n");
}

/** Asset id for a role pool + seed, or null if unknown / empty pool. */
export function resolveAiSfxAssetId(
  role: AiSfxRole,
  seedKey: string,
  pools: ReadonlyMap<string, readonly string[]>,
): string | null {
  if (!getAiSfxRole(role)) return null;
  const pool = pools.get(role);
  if (!pool?.length) return null;
  return pickAiSfxAssetId(pool, seedKey);
}

/** Expected on-disk folders for seed validation. */
export function expectedAiSfxPoolDirs(): string[] {
  return [...AI_SFX_ROLES];
}
