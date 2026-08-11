import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";

import {
  COMPANION_SFX_MIN_GAP_SEC,
  COMPANION_SFX_ROLE_PRIORITY,
  formatAiSfxPackForPrompt,
  getAiSfxVariant,
  resolveAiSfxAssetId,
  volumeForIntensity,
  type AiSfxRole,
} from "~/domain/ai-sfx-pack";
import { isListicleEdit } from "~/domain/listicle";
import { buildNumberedTranscript } from "~/domain/projection";
import type { Edit, SfxEdit } from "~/domain/project-config";
import { nextEditId } from "~/domain/project-config";
import { isQuoteEdit } from "~/domain/quote";
import type { GlobalTranscriptWord } from "~/domain/transcript";
import { getOpenAIClient, OPENAI_MODEL } from "~/server/ai/openai";

export type CompanionCandidate = {
  id: string;
  role: AiSfxRole;
  /** Timeline onset for the SFX. */
  startSec: number;
  /** Hint for the LLM. */
  label: string;
};

export type CompanionSfxAssetDuration = (assetId: string) => number | null;

/** variantId → global asset ids in that pool. */
export type CompanionSfxPools = ReadonlyMap<string, readonly string[]>;

/** Start the hook riser this many seconds before the title / first beat. */
const BUILD_LEAD_SEC = 1.2;

const CompanionChoiceSchema = z.object({
  assignments: z.array(
    z.object({
      candidateId: z.string().describe("Id from the candidate list"),
      variantId: z
        .string()
        .describe(
          'Pack variant id for the candidate role (e.g. motion.soft), or "none"',
        ),
      reason: z.string().describe("One short sentence"),
    }),
  ),
});

export type CompanionSfxDetection = z.infer<typeof CompanionChoiceSchema>;

/** Build optional companion candidates (punch-ins, quotes, listicles, title, hook). */
export function buildCompanionCandidates(
  edits: readonly Edit[],
  words: readonly GlobalTranscriptWord[],
): CompanionCandidate[] {
  const out: CompanionCandidate[] = [];
  let buildAdded = false;

  for (const edit of edits) {
    if (edit.kind === "zoom" && !edit.ease) {
      out.push({
        id: `punch-${edit.id}`,
        role: "motion",
        startSec: edit.start,
        label: `punch-in zoom #${edit.id}`,
      });
      continue;
    }

    if (isQuoteEdit(edit)) {
      const inQuote = words.filter(
        (w) =>
          !w.inGap &&
          w.emphasized &&
          w.start < edit.end - 0.001 &&
          w.end > edit.start + 0.001,
      );
      // Peak = last emphasized word in the quote (often the payoff).
      const peak = inQuote[inQuote.length - 1];
      if (peak) {
        out.push({
          id: `quote-peak-${edit.id}`,
          role: "ping",
          startSec: peak.start,
          label: `quote #${edit.id} peak "${peak.text}"`,
        });
      }
      continue;
    }

    if (isListicleEdit(edit)) {
      out.push({
        id: `listicle-ind-${edit.id}`,
        role: "reveal",
        startSec: edit.start,
        label: `listicle #${edit.id} indicator "${edit.indicatorText}"`,
      });
      const valueAt = edit.middle ?? edit.start;
      out.push({
        id: `listicle-val-${edit.id}`,
        role: "tick",
        startSec: valueAt,
        label: `listicle #${edit.id} value "${edit.valueText}"`,
      });
      continue;
    }

    if (edit.kind === "vfx" && edit.type === "text") {
      out.push({
        id: `title-reveal-${edit.id}`,
        role: "reveal",
        startSec: edit.start,
        label: `title card #${edit.id} "${edit.text}"`,
      });
      if (!buildAdded) {
        out.push({
          id: `hook-build-${edit.id}`,
          role: "build",
          startSec: Math.max(0, edit.start - BUILD_LEAD_SEC),
          label: `hook riser into title #${edit.id}`,
        });
        buildAdded = true;
      }
    }
  }

  // Hook riser even when title card is missing (first keep / earliest punch).
  if (!buildAdded) {
    const earliest = out.reduce<number | null>((min, c) => {
      if (min == null || c.startSec < min) return c.startSec;
      return min;
    }, null);
    if (earliest != null) {
      out.push({
        id: "hook-build",
        role: "build",
        startSec: Math.max(0, earliest - BUILD_LEAD_SEC),
        label: "hook riser into first beat",
      });
    }
  }

  return out;
}

type RankedHit = {
  candidateId: string;
  role: AiSfxRole;
  startSec: number;
  variantId: string;
  priority: number;
};

/** Apply min-gap suppress with role priority; higher priority keeps the onset. */
export function applyCompanionMinGap(
  hits: readonly RankedHit[],
  minGapSec = COMPANION_SFX_MIN_GAP_SEC,
): RankedHit[] {
  const sorted = [...hits].sort(
    (a, b) =>
      a.startSec - b.startSec ||
      b.priority - a.priority ||
      a.candidateId.localeCompare(b.candidateId),
  );
  const kept: RankedHit[] = [];

  for (const hit of sorted) {
    const conflictIdx = kept.findIndex(
      (k) => Math.abs(k.startSec - hit.startSec) < minGapSec,
    );
    if (conflictIdx < 0) {
      kept.push(hit);
      continue;
    }
    const existing = kept[conflictIdx]!;
    if (hit.priority > existing.priority) {
      kept[conflictIdx] = hit;
    }
  }

  return kept.sort((a, b) => a.startSec - b.startSec);
}

export function detectionToSfxEdits(
  detection: CompanionSfxDetection,
  candidates: readonly CompanionCandidate[],
  existingEdits: readonly { id: number }[],
  durationSecFor: CompanionSfxAssetDuration,
  pools: CompanionSfxPools,
): SfxEdit[] {
  const byId = new Map(candidates.map((c) => [c.id, c]));
  const ranked: RankedHit[] = [];

  for (const row of detection.assignments) {
    const variantId = row.variantId.trim();
    if (!variantId || variantId.toLowerCase() === "none") continue;
    const candidate = byId.get(row.candidateId);
    if (!candidate) continue;
    const variant = getAiSfxVariant(variantId);
    if (!variant || variant.role !== candidate.role) continue;

    ranked.push({
      candidateId: candidate.id,
      role: candidate.role,
      startSec: candidate.startSec,
      variantId: variant.id,
      priority: COMPANION_SFX_ROLE_PRIORITY[candidate.role],
    });
  }

  const kept = applyCompanionMinGap(ranked);
  let nextId = nextEditId(existingEdits);
  const out: SfxEdit[] = [];

  for (const hit of kept) {
    const variant = getAiSfxVariant(hit.variantId);
    if (!variant) continue;
    const assetId = resolveAiSfxAssetId(
      hit.variantId,
      hit.candidateId,
      pools,
    );
    if (!assetId) continue;
    const dur = durationSecFor(assetId) ?? 0.35;
    const end = hit.startSec + Math.max(0.05, dur);
    out.push({
      id: nextId,
      kind: "sfx",
      start: hit.startSec,
      end,
      assetId,
      mediaOffsetSec: 0,
      volume: volumeForIntensity(variant.intensity),
    });
    nextId += 1;
  }

  return out;
}

function formatCandidates(candidates: readonly CompanionCandidate[]): string {
  return candidates
    .map(
      (c) =>
        `- ${c.id} role=${c.role} t=${c.startSec.toFixed(2)}s — ${c.label}`,
    )
    .join("\n");
}

async function callOpenAI(
  candidates: readonly CompanionCandidate[],
  words: readonly GlobalTranscriptWord[],
): Promise<CompanionSfxDetection> {
  const client = getOpenAIClient();
  const numbered = buildNumberedTranscript(words);

  const completion = await client.chat.completions.parse({
    model: OPENAI_MODEL,
    messages: [
      {
        role: "system",
        content: [
          "You assign companion SFX variants to visual edit candidates for a talking-head short.",
          "Each candidate has a fixed role — only pick a variant id from that role (role.soft|medium|hard), or none.",
          "Not every candidate needs SFX. Prefer silence over spam. Skip slow/filler moments.",
          "Match intensity to the moment using the pack descriptions.",
          "build is optional hook anticipation; reveal is overlay enter; tick confirms list values; ping is quote sparkle; motion is punch-in whoosh.",
          "Return one assignment per candidate you decide on; omitted candidates are treated as none.",
        ].join(" "),
      },
      {
        role: "user",
        content: [
          formatAiSfxPackForPrompt(),
          "",
          "Candidates:",
          formatCandidates(candidates),
          "",
          "Numbered transcript (context):",
          numbered,
        ].join("\n"),
      },
    ],
    response_format: zodResponseFormat(
      CompanionChoiceSchema,
      "companion_sfx",
    ),
  });

  const parsed = completion.choices[0]?.message.parsed;
  if (!parsed) {
    const refusal = completion.choices[0]?.message.refusal;
    throw new Error(
      `OpenAI companion SFX failed${refusal ? `: ${refusal}` : ""}`,
    );
  }

  return parsed;
}

/** Optional companion SFX edits from punch-ins, quote peaks, listicles, title, hook. */
export async function generateCompanionSfxEdits(
  words: readonly GlobalTranscriptWord[],
  edits: readonly Edit[],
  durationSecFor: CompanionSfxAssetDuration,
  pools: CompanionSfxPools,
): Promise<SfxEdit[]> {
  const candidates = buildCompanionCandidates(edits, words);
  if (candidates.length === 0) return [];
  const detection = await callOpenAI(candidates, words);
  return detectionToSfxEdits(
    detection,
    candidates,
    edits,
    durationSecFor,
    pools,
  );
}
