/**
 * Curated AI SFX pack — create-pipeline companion SFX only.
 * Variants point at seeded global Asset ids (`projectId` null).
 */

export const AI_SFX_ROLES = ["motion", "ping", "reveal", "tick"] as const;
export type AiSfxRole = (typeof AI_SFX_ROLES)[number];

export type AiSfxIntensity = "soft" | "medium" | "hard";

export type AiSfxVariant = {
  /** Stable id for LLM choice, e.g. `motion.whoosh2`. */
  id: string;
  role: AiSfxRole;
  /** Global audio Asset id. */
  assetId: string;
  label: string;
  intensity: AiSfxIntensity;
  /** Short vibe note shown to the LLM. */
  description: string;
};

/** Companion SFX stacking: drop lower-priority hit if closer than this. */
export const COMPANION_SFX_MIN_GAP_SEC = 0.3;

/**
 * Priority when two companions want onsets within {@link COMPANION_SFX_MIN_GAP_SEC}.
 * Higher wins. `reveal` and `tick` share top tier (different listicle phases).
 */
export const COMPANION_SFX_ROLE_PRIORITY: Record<AiSfxRole, number> = {
  tick: 3,
  reveal: 3,
  ping: 2,
  motion: 1,
};

/**
 * Curated flavors. Keep meme / texture packs out — manual library only.
 * Asset ids are from the seeded global SFX rows.
 */
export const AI_SFX_PACK: readonly AiSfxVariant[] = [
  // motion — punch-in only (not slow zooms)
  {
    id: "motion.swish",
    role: "motion",
    assetId: "a71663b9-872c-4622-9cf5-3047a834af1d",
    label: "Swish",
    intensity: "soft",
    description: "Light airy swipe; subtle camera move, calm delivery.",
  },
  {
    id: "motion.whoosh1",
    role: "motion",
    assetId: "5075e0fc-6016-4623-a60c-c3a968901a32",
    label: "Whoosh 1",
    intensity: "medium",
    description: "Clean mid whoosh; default punch-in energy.",
  },
  {
    id: "motion.whoosh2",
    role: "motion",
    assetId: "d26cc940-c387-42ca-a146-1dc7104a28d6",
    label: "Whoosh 2",
    intensity: "medium",
    description: "Slightly brighter whoosh; upbeat or confident line.",
  },
  {
    id: "motion.whoosh3",
    role: "motion",
    assetId: "da2612ce-6e8c-42db-8495-563f2573b046",
    label: "Whoosh 3",
    intensity: "hard",
    description: "Punchier whoosh; strong claim or hook hit.",
  },
  {
    id: "motion.swish_scifi",
    role: "motion",
    assetId: "af5cafb3-9a30-4e73-8da8-02cc01c94669",
    label: "Sci-fi swish",
    intensity: "hard",
    description: "Processed futuristic swipe; techy or dramatic punch-in.",
  },

  // ping — quote peak emphasis (optional; often none)
  {
    id: "ping.ding_light",
    role: "ping",
    assetId: "bb5200c8-2bbb-4c2b-9fb1-d10665456799",
    label: "Ding light",
    intensity: "soft",
    description: "Soft chime; gentle key-word pop inside a quote.",
  },
  {
    id: "ping.beep",
    role: "ping",
    assetId: "eaec1e05-6a3a-4926-91ff-e546fdf28714",
    label: "Beep",
    intensity: "medium",
    description: "Short UI beep; clear but not shouty highlight.",
  },
  {
    id: "ping.boop_upbeat",
    role: "ping",
    assetId: "e10961ba-210f-420f-8406-b173cf36aa37",
    label: "Boop upbeat",
    intensity: "medium",
    description: "Playful boop; friendly or witty punch phrase.",
  },
  {
    id: "ping.ding_strong",
    role: "ping",
    assetId: "5fc291e4-97fe-4cbc-9194-2b45814ecf8b",
    label: "Ding strong",
    intensity: "hard",
    description: "Bright ding; high-stakes or memorable word in the quote.",
  },
  {
    id: "ping.lips_pop",
    role: "ping",
    assetId: "b58bcec2-a5df-41ff-b8f9-8913510ab2cf",
    label: "Lips pop",
    intensity: "soft",
    description: "Organic pop; soft organic vibe without a hard chime.",
  },

  // reveal — listicle indicator phase
  {
    id: "reveal.flip",
    role: "reveal",
    assetId: "ed569ef2-08b6-4d4e-ac3b-681863e9b34f",
    label: "Page flip",
    intensity: "medium",
    description: "Paper page turn; classic list / tip card enter.",
  },
  {
    id: "reveal.title_enter",
    role: "reveal",
    assetId: "05699f7c-4c11-4af4-bbc6-e21d0c07ee1a",
    label: "Title enter",
    intensity: "soft",
    description: "Soft UI enter; understated indicator appear.",
  },
  {
    id: "reveal.swish",
    role: "reveal",
    assetId: "a71663b9-872c-4622-9cf5-3047a834af1d",
    label: "Swish",
    intensity: "soft",
    description: "Light swipe in; quick indicator without paper texture.",
  },

  // tick — listicle value land
  {
    id: "tick.mouse_click",
    role: "tick",
    assetId: "8f513e7e-d712-46b7-8617-c8c9981a24bc",
    label: "Mouse click",
    intensity: "medium",
    description: "Crisp click; value lands like a UI select.",
  },
  {
    id: "tick.tap",
    role: "tick",
    assetId: "9b5a941f-b282-484e-bdf3-95b86c6172b3",
    label: "Tap",
    intensity: "soft",
    description: "Soft finger tap; quieter value confirm.",
  },
  {
    id: "tick.boop_airplane",
    role: "tick",
    assetId: "ce31d48d-9fc1-43e5-9b25-ad1dcc5d781d",
    label: "Boop airplane",
    intensity: "hard",
    description: "Snappy cartoon boop; punchy list item land.",
  },
] as const;

const BY_ID = new Map(AI_SFX_PACK.map((v) => [v.id, v]));

export function getAiSfxVariant(id: string): AiSfxVariant | undefined {
  return BY_ID.get(id);
}

export function aiSfxVariantsForRole(role: AiSfxRole): AiSfxVariant[] {
  return AI_SFX_PACK.filter((v) => v.role === role);
}

/** LLM-facing catalog: roles, ids, intensity, descriptions (not raw asset UUIDs). */
export function formatAiSfxPackForPrompt(): string {
  const lines: string[] = [
    "AI SFX pack (pick variant id, or none). Stay in the role for each companion.",
  ];
  for (const role of AI_SFX_ROLES) {
    lines.push(`## ${role}`);
    for (const v of aiSfxVariantsForRole(role)) {
      lines.push(
        `- ${v.id} [${v.intensity}] ${v.label}: ${v.description}`,
      );
    }
  }
  return lines.join("\n");
}

/** Asset id for a variant, or null if the variant id is unknown. */
export function resolveAiSfxAssetId(variantId: string): string | null {
  return getAiSfxVariant(variantId)?.assetId ?? null;
}
