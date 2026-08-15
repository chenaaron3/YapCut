import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";

import {
  AI_SFX_ROLES,
  formatAiSfxPackForPrompt,
  isAiSfxPlaceRole,
  volumeForRole,
  type AiSfxPlaceRole,
} from "~/domain/ai-sfx-pack";
import { hasSfxOnsetAt } from "~/domain/companion-sfx";
import { splitTranscriptSentences } from "~/domain/pacing";
import { nextEditId } from "~/domain/project-config";
import { pickSfxAssetId, sfxFolderOf } from "~/domain/sfx";
import { getOpenAIClient, OPENAI_MODEL } from "~/server/ai/openai";
import { loadGlobalSfxAssets } from "~/server/ai/global-sfx";

import type { CompanionSfxAsset } from "~/domain/companion-sfx";
import type { Edit, SfxEdit } from "~/domain/project-config";
import type { GlobalTranscriptWord } from "~/domain/transcript";

export type EmphasisSfxCandidate = {
  id: string;
  startSec: number;
  /** Sentence with the emphasized word marked `[like this]`. */
  context: string;
};

const EmphasisSfxChoiceSchema = z.object({
  assignments: z.array(
    z.object({
      candidateId: z.string().describe("Id from the candidate list"),
      role: z
        .enum(AI_SFX_ROLES)
        .describe("ping, tick, or none — default none"),
      reason: z.string().describe("One short sentence"),
    }),
  ),
});

export type EmphasisSfxDetection = z.infer<typeof EmphasisSfxChoiceSchema>;

type RolePools = Record<AiSfxPlaceRole, readonly string[]>;

function sentenceContextForWord(
  words: readonly GlobalTranscriptWord[],
  sentences: readonly { startWordIndex: number; endWordIndex: number }[],
  globalIndex: number,
): string {
  const sentence = sentences.find(
    (s) => globalIndex >= s.startWordIndex && globalIndex <= s.endWordIndex,
  );
  if (!sentence) {
    const word = words.find((w) => w.globalIndex === globalIndex);
    return word ? `[${word.text}]` : `[${globalIndex}]`;
  }
  return words
    .filter(
      (w) =>
        !w.inGap &&
        w.globalIndex >= sentence.startWordIndex &&
        w.globalIndex <= sentence.endWordIndex,
    )
    .map((w) => (w.globalIndex === globalIndex ? `[${w.text}]` : w.text))
    .join(" ");
}

/** Emphasized words that do not already share a start with an SFX. */
export function buildEmphasisSfxCandidates(
  edits: readonly Edit[],
  words: readonly GlobalTranscriptWord[],
): EmphasisSfxCandidate[] {
  const sentences = splitTranscriptSentences(words);
  const out: EmphasisSfxCandidate[] = [];
  for (const word of words) {
    if (word.inGap || !word.emphasized) continue;
    if (hasSfxOnsetAt(edits, word.start)) continue;
    out.push({
      id: `emph-${word.globalIndex}`,
      startSec: word.start,
      context: sentenceContextForWord(words, sentences, word.globalIndex),
    });
  }
  return out;
}

export function detectionToSfxEdits(
  detection: EmphasisSfxDetection,
  candidates: readonly EmphasisSfxCandidate[],
  existingEdits: readonly { id: number }[],
  durationSecFor: (assetId: string) => number | null,
  pools: RolePools,
): SfxEdit[] {
  const byId = new Map(candidates.map((c) => [c.id, c]));
  let nextId = nextEditId(existingEdits);
  const out: SfxEdit[] = [];

  for (const row of detection.assignments) {
    const raw = row.role.trim().toLowerCase();
    if (!isAiSfxPlaceRole(raw)) continue;
    const candidate = byId.get(row.candidateId);
    if (!candidate) continue;
    const assetId = pickSfxAssetId(pools[raw], candidate.id);
    if (!assetId) continue;
    const dur = durationSecFor(assetId) ?? 0.35;
    const end = candidate.startSec + Math.max(0.05, dur);
    out.push({
      id: nextId,
      kind: "sfx",
      start: candidate.startSec,
      end,
      assetId,
      mediaOffsetSec: 0,
      volume: volumeForRole(raw),
    });
    nextId += 1;
  }

  return out;
}

function formatCandidates(candidates: readonly EmphasisSfxCandidate[]): string {
  return candidates
    .map((c) => `- ${c.id} t=${c.startSec.toFixed(2)}s — ${c.context}`)
    .join("\n");
}

async function callOpenAI(
  candidates: readonly EmphasisSfxCandidate[],
): Promise<EmphasisSfxDetection> {
  const client = getOpenAIClient();

  const completion = await client.chat.completions.parse({
    model: OPENAI_MODEL,
    messages: [
      {
        role: "system",
        content: [
          "You assign SFX to emphasized words in a talking-head short.",
          "Every candidate is an emphasized word marked [like this] in its sentence — choose ping, tick, or none.",
          "Default to none. Do not spam SFX.",
          "Tick is for light emphasis. Ping is rare: key moments with a positive connotation.",
          "Skip if a nearby candidate already has SFX.",
          "Return exactly one assignment for every candidate.",
        ].join(" "),
      },
      {
        role: "user",
        content: [
          formatAiSfxPackForPrompt(),
          "",
          "Candidates (target word in [brackets]):",
          formatCandidates(candidates),
        ].join("\n"),
      },
    ],
    response_format: zodResponseFormat(
      EmphasisSfxChoiceSchema,
      "emphasis_sfx",
    ),
  });

  const parsed = completion.choices[0]?.message.parsed;
  if (!parsed) {
    const refusal = completion.choices[0]?.message.refusal;
    throw new Error(
      `OpenAI emphasis SFX failed${refusal ? `: ${refusal}` : ""}`,
    );
  }

  return parsed;
}

function poolFromAssets(
  sfxAssets: readonly CompanionSfxAsset[],
  folder: AiSfxPlaceRole,
): string[] {
  return sfxAssets
    .filter((a) => sfxFolderOf(a.originalFilename) === folder)
    .map((a) => a.id);
}

/**
 * LLM ping/tick SfxEdits on emphasized words. Soft-fails to [] on OpenAI error.
 */
export async function generateEmphasisSfxEdits(options: {
  words: readonly GlobalTranscriptWord[];
  edits: readonly Edit[];
}): Promise<SfxEdit[]> {
  const { assets: sfxAssets, durationByAssetId } = await loadGlobalSfxAssets();
  const pools: RolePools = {
    ping: poolFromAssets(sfxAssets, "ping"),
    tick: poolFromAssets(sfxAssets, "tick"),
  };
  const candidates = buildEmphasisSfxCandidates(options.edits, options.words);
  if (candidates.length === 0) return [];

  const detection = await callOpenAI(candidates);
  return detectionToSfxEdits(
    detection,
    candidates,
    options.edits,
    (assetId) => durationByAssetId.get(assetId) ?? null,
    pools,
  );
}
