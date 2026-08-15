import {
  COMPANION_SFX_VOLUME,
  SFX_VOLUME_DEFAULT,
} from "~/domain/audio/mix-levels";

/**
 * LLM catalog for emphasis-word SFX.
 * Visual-edit companions use `companion-sfx` + the SFX library, not this pack.
 * Role picks the pool (`ping/` or `tick/`); `none` skips. Concrete file is hash-picked.
 */

export const AI_SFX_ROLES = ["ping", "tick", "none"] as const;
export type AiSfxRole = (typeof AI_SFX_ROLES)[number];

/** Roles that place an SFX. */
export type AiSfxPlaceRole = Exclude<AiSfxRole, "none">;

export type AiSfxRoleEntry = {
  label: string;
  description: string;
};

/** Ping sits at the SFX mix default; tick is the quieter companion level. */
export const AI_SFX_VOLUME_BY_ROLE: Record<AiSfxPlaceRole, number> = {
  ping: SFX_VOLUME_DEFAULT,
  tick: COMPANION_SFX_VOLUME,
};

export function volumeForRole(role: AiSfxPlaceRole): number {
  return AI_SFX_VOLUME_BY_ROLE[role];
}

const ROLE_SET = new Set<string>(AI_SFX_ROLES);
const PLACE_ROLE_SET = new Set<string>(["ping", "tick"]);

export function isAiSfxRole(value: string): value is AiSfxRole {
  return ROLE_SET.has(value);
}

export function isAiSfxPlaceRole(value: string): value is AiSfxPlaceRole {
  return PLACE_ROLE_SET.has(value);
}

export const AI_SFX_PING: AiSfxRoleEntry = {
  label: "Word sparkle",
  description:
    "Bright short highlight. Use sparingly for key moments with a positive connotation. At most a few per short.",
};

export const AI_SFX_TICK: AiSfxRoleEntry = {
  label: "Light tap",
  description:
    "Dry UI tick. Use when a word needs light emphasis without a sparkle.",
};

/** LLM-facing catalog: ping / tick / none (not asset UUIDs). */
export function formatAiSfxPackForPrompt(): string {
  return [
    "AI SFX — emphasized words only. Pick ping, tick, or none.",
    "Default to none. Most emphasized words should stay silent. Do not spam SFX.",
    "Skip a candidate if a nearby word already has SFX, or the moment is already punctuated.",
    `## ping — ${AI_SFX_PING.label}`,
    AI_SFX_PING.description,
    `## tick — ${AI_SFX_TICK.label}`,
    AI_SFX_TICK.description,
    "## none",
    "No SFX. The usual choice.",
  ].join("\n");
}
