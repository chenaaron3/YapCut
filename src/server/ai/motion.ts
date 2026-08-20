import { and, eq } from "drizzle-orm";
import { zodFunction, zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";

import { durationMapFromArolls } from "~/domain/aroll/arolls";
import {
  assetFusionContentSchema,
  chartsContentSchema,
  checklistContentSchema,
  lowerThirdsContentSchema,
  MOTION_CATEGORIES,
  MOTION_MAX_PROMPT,
  motionAcceptsAssetNeeds,
  motionMediaRef,
  newsContentSchema,
  shotPlanSchema,
  statContentSchema,
  withMotionMedia,
} from "~/domain/vfx/motion-config";
import { parseProjectConfig } from "~/domain/project/project-config";
import { isEditorProjectStatus } from "~/domain/project/project-status";
import { keptTimelineWords, projectTimelineWords } from "~/domain/aroll/projection";
import { IMAGE_SIZES } from "~/server/ai/images/types";
import { sourceMotionAssets } from "~/server/ai/motion-source";
import { getOpenAIClient, OPENAI_MODEL } from "~/server/ai/openai";
import { db } from "~/server/db";
import { assets, projects, transcripts } from "~/server/db/schema";

import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import type { ShotPlan } from "~/domain/vfx/motion-config";
import type { TranscriptWord } from "~/domain/transcript/transcript";
import type { AssetNeed, SourcedAsset } from "~/server/ai/motion-source";

const sourceStillParams = z.object({
  method: z.enum(["search", "generate"]),
  query: z.string().min(1).max(800),
  image_size: z.enum(IMAGE_SIZES).nullable(),
});

const sourceStillTool = zodFunction({
  name: "source_still",
  description:
    "Search or generate a still and persist it as a project asset. " +
    "Call before returning an asset-fusion ShotPlan.",
  parameters: sourceStillParams,
});

/** OpenAI structured outputs reject a top-level anyOf union — keep a single object. */
const motionPlanLlmSchema = z.object({
  category: z.enum(MOTION_CATEGORIES),
  brief: z.string(),
  style: z.string(),
  stat: statContentSchema.nullable(),
  charts: chartsContentSchema.nullable(),
  lowerThirds: lowerThirdsContentSchema.nullable(),
  news: newsContentSchema.nullable(),
  assetFusion: assetFusionContentSchema.nullable(),
  checklist: checklistContentSchema.nullable(),
});

const MAX_DIRECTOR_ROUNDS = 6;

function shotPlanFromLlm(
  raw: z.infer<typeof motionPlanLlmSchema>,
): ShotPlan {
  const env = { brief: raw.brief, style: raw.style };
  switch (raw.category) {
    case "stat":
      if (!raw.stat) throw new Error("ShotPlan missing stat content");
      return { ...env, category: "stat", content: raw.stat };
    case "charts":
      if (!raw.charts) throw new Error("ShotPlan missing charts content");
      return { ...env, category: "charts", content: raw.charts };
    case "lower-thirds":
      if (!raw.lowerThirds) {
        throw new Error("ShotPlan missing lower-thirds content");
      }
      return { ...env, category: "lower-thirds", content: raw.lowerThirds };
    case "news":
      if (!raw.news) throw new Error("ShotPlan missing news content");
      return { ...env, category: "news", content: raw.news };
    case "asset-fusion":
      if (!raw.assetFusion) {
        throw new Error("ShotPlan missing asset-fusion content");
      }
      return { ...env, category: "asset-fusion", content: raw.assetFusion };
    case "checklist":
      if (!raw.checklist) throw new Error("ShotPlan missing checklist content");
      return { ...env, category: "checklist", content: raw.checklist };
  }
}

const MOTION_SYSTEM_PROMPT = `You are the Motion Director for a talking-head Short (9:16 overlay on A-roll).
Turn the instruction into a ShotPlan.
You do NOT write Remotion, GSAP, HTML, or JSX — that's the Builder.

The overlay already has a timeline range. duration, fps (30), and canvas (1080×1920)
are given — do not invent them. Captions already exist; do not re-caption speech.

Numbered words include timeline seconds. Copy those times into any beats you need.

## Classify

   stat           a single hero number / count-up
   charts         bar / line / pie / race / % from data
   lower-thirds   name bars and chips over footage (place, LIVE, date, topic)
   news           a news article → article-highlight (text only)
   asset-fusion   a still of the subject with a label
   checklist      one persistent stack of upcoming topics; each row slams
                  in when that phrase is spoken and stays. 2–5 items typical.

If genuinely ambiguous between two, pick the one that matches the spoken words.
checklist is not listicle: listicle is a separate VFX (one card per item).
Use checklist when the speaker names a short list that should accumulate.

## Stills

Only asset-fusion needs a photo. Call source_still first, then return the plan.
Other categories: do not call the tool.

source_still({ method, query, image_size })
- search = Wikimedia. Real-world named person, place, flag, brand, product,
  news event. Query ≤5 words — the name only. image_size is null.
- generate = Flux. Fictional, invented, illustrative, hypothetical, or
  "as if". Query is an optimized image prompt: lead with the subject, then
  composition (centered, fill-frame), lighting, and look. No text, logos,
  or watermarks. One still, not a collage. image_size is required:
    portrait   tall subject / 9:16 card
    square     flag, product, face, icon
    landscape  wide scene
  Prefer portrait on a 9:16 Short unless the subject is clearly wide or square.
Empty Wikimedia search fails — do not search a query Commons will not have.
If search returns an error, retry once with a better Commons name. Do not
generate a fake photo of a real-world subject.

The tool returns { assetId }. Put that assetId on content.media.
Do not invent assetIds.

When the user message includes a current ShotPlan with content.media, keep
it unless the update needs a different still — then call source_still.

## ShotPlan

Return category + brief + style plus the matching content bag.
Fill only that bag; set every other bag to null.

Bags: stat, charts, lowerThirds, news, assetFusion, checklist.

stat: { value, prefix, suffix, label, ring }
charts: { type: bar|line|pie|race|pct, data, labels, headline, axes, colors }
  colors is string[] or null (null = use the accent ramp).
lowerThirds: { kind: name-bar|chip, title, detail, position: lower-left|lower-third|corner|upper-left, brandColors }
  name-bar = speaker identity. chip = short overlay (LIVE, place, date, topic).
  Photo-on-image callouts are asset-fusion, not chips.
news: { outlet, kicker, headline, keyword }
  Text only. No images. keyword is a contiguous phrase copied from
  headline — usually mid-sentence (the number, name, or punch).
  Do not append extra words after the headline.
assetFusion: { label, box: 0–1 of the image, media: MediaRef }
checklist: { headline, items: [{ label, atSec }] }
  headline is "" if none. items 1–8, labels 2–6 words.
  atSec is seconds from overlay start (0 = rangeStart). Copy from the
  numbered word that names that item: word.start − rangeStart, minus
  ~0.1s anticipation, clamped to ≥ 0. Extra overlay time holds the last item.

MediaRef is { assetId, mediaOffsetSec: 0, volume: 1 }.

## Heuristics

Motion IS the message; no narration arc. Hook lands in the first ~0.5s.
One dominant motif. If the overlay runs >~2.5s, pattern-interrupt: change
exactly one thing. Effect intensity matches the energy. A key element stays
readable ≥~0.3s. Beats may be anticipated ~0.1s for perceived sync.

When the user message includes a current ShotPlan JSON, this is a revision.
Keep fields the revision does not mention. Return a complete replacement plan.`;

function wordsInRange<T extends { start: number; end: number }>(
  words: readonly T[],
  start: number,
  end: number,
): T[] {
  return words.filter((w) => w.start < end - 0.001 && w.end > start + 0.001);
}

function numberedWords(
  words: readonly { text: string; start: number; end: number }[],
): string {
  return words
    .map((w, i) => `${i}  ${w.start.toFixed(2)}–${w.end.toFixed(2)}  ${w.text}`)
    .join("\n");
}

function motionUserContent(input: {
  prompt: string;
  plan: ShotPlan | null | undefined;
  numbered: string;
  rangeStart: number;
  rangeEnd: number;
}): string {
  const prompt = input.prompt.trim();
  const parts = [
    `Overlay range (timeline seconds): ${input.rangeStart.toFixed(2)}–${input.rangeEnd.toFixed(2)}`,
    `Numbered words in range (index, start–end, text):\n${input.numbered}`,
  ];
  if (input.plan) {
    parts.push(`Current ShotPlan JSON:\n${JSON.stringify(input.plan)}`);
    parts.push(`Update:\n${prompt}`);
  } else {
    parts.push(`Instruction:\n${prompt}`);
  }
  return parts.join("\n\n");
}

async function runSourceStill(options: {
  db: typeof db;
  projectId: string;
  args: unknown;
}): Promise<{ ok: true; asset: SourcedAsset } | { ok: false; error: string }> {
  const parsed = sourceStillParams.safeParse(options.args);
  if (!parsed.success) return { ok: false, error: parsed.error.message };
  const need: AssetNeed = {
    query: parsed.data.query,
    method: parsed.data.method,
    imageSize: parsed.data.image_size,
  };
  try {
    const [asset] = await sourceMotionAssets({
      db: options.db,
      projectId: options.projectId,
      needs: [need],
    });
    if (!asset) return { ok: false, error: "Image source returned nothing" };
    return { ok: true, asset };
  } catch (error) {
    return { ok: false, error: motionFailMessage(error) };
  }
}

function planMediaIsKnown(plan: ShotPlan, known: ReadonlySet<string>): boolean {
  const ref = motionMediaRef(plan);
  return ref == null || known.has(ref.assetId);
}

export function motionFailMessage(error: unknown): string {
  if (error && typeof error === "object") {
    const body = error as {
      message?: unknown;
      error?: { message?: unknown } | string;
      body?: { detail?: unknown; message?: unknown };
    };
    const errBody = typeof body.error === "object" ? body.error : null;
    const inner =
      errBody && "message" in errBody
        ? errBody.message
        : (body.body?.detail ?? body.body?.message);
    if (typeof inner === "string" && inner.trim()) {
      if (!/unprocessable entity/i.test(inner)) return inner;
    }
    if (body.error && typeof body.error === "object") {
      const dumped = JSON.stringify(body.error);
      if (dumped && dumped !== "{}") return dumped;
    }
    if (Array.isArray(inner)) return JSON.stringify(inner);
    if (typeof body.message === "string" && body.message.trim()) {
      return body.message;
    }
  }
  return "Motion generate failed";
}

function parsedOrThrow<T>(
  result: {
    choices: { message: { parsed?: T | null; refusal?: string | null } }[];
  },
  label: string,
): T {
  const parsed = result.choices[0]?.message.parsed;
  if (parsed) return parsed;
  const refusal = result.choices[0]?.message.refusal;
  throw new Error(`${label}${refusal ? `: ${refusal}` : ""}`);
}

export async function generateMotionPlan(input: {
  projectId: string;
  userId: string;
  start: number;
  end: number;
  prompt: string;
  plan?: ShotPlan | null;
}): Promise<{ plan: ShotPlan; assets: SourcedAsset["client"][] }> {
  const prompt = input.prompt.trim().slice(0, MOTION_MAX_PROMPT);
  if (!prompt) throw new Error("Prompt is empty");
  if (input.end <= input.start) throw new Error("Invalid range");

  const [project] = await db
    .select()
    .from(projects)
    .where(
      and(eq(projects.id, input.projectId), eq(projects.userId, input.userId)),
    )
    .limit(1);

  if (!project) throw new Error("Project not found");
  if (!isEditorProjectStatus(project.status)) {
    throw new Error(`Cannot generate while status is ${project.status}`);
  }

  const config = parseProjectConfig(project.config);
  const projectAssets = await db
    .select({ id: assets.id, durationSec: assets.durationSec })
    .from(assets)
    .where(eq(assets.projectId, input.projectId));
  const durationByAssetId = new Map<string, number>();
  for (const row of projectAssets) {
    if (row.durationSec != null) durationByAssetId.set(row.id, row.durationSec);
  }

  const wordsByAssetId = new Map<string, TranscriptWord[]>();
  for (const assetId of [...new Set(config.arolls.map((k) => k.assetId))]) {
    const [transcript] = await db
      .select()
      .from(transcripts)
      .where(eq(transcripts.assetId, assetId))
      .limit(1);
    if (!transcript || transcript.status !== "ready") {
      throw new Error(`Transcript not ready for asset ${assetId}`);
    }
    wordsByAssetId.set(assetId, transcript.words);
  }

  const kept = keptTimelineWords(
    projectTimelineWords(
      config.arolls,
      wordsByAssetId,
      durationMapFromArolls(config.arolls, (id) => durationByAssetId.get(id)),
    ),
  );
  const ranged = wordsInRange(kept, input.start, input.end);
  const numbered =
    ranged.length > 0
      ? numberedWords(ranged)
      : "(no spoken words in this range)";

  const client = getOpenAIClient();
  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: MOTION_SYSTEM_PROMPT },
    {
      role: "user",
      content: motionUserContent({
        prompt,
        plan: input.plan,
        numbered,
        rangeStart: input.start,
        rangeEnd: input.end,
      }),
    },
  ];

  const sourced: SourcedAsset[] = [];
  let raw: z.infer<typeof motionPlanLlmSchema> | null = null;
  for (let round = 0; round < MAX_DIRECTOR_ROUNDS; round++) {
    const completion = await client.chat.completions.parse({
      model: OPENAI_MODEL,
      messages,
      tools: [sourceStillTool],
      tool_choice: "auto",
      parallel_tool_calls: false,
      response_format: zodResponseFormat(motionPlanLlmSchema, "motion_plan"),
    });
    const message = completion.choices[0]?.message;
    if (!message) throw new Error("OpenAI motion plan failed");
    const toolCalls = message.tool_calls ?? [];
    if (toolCalls.length > 0) {
      messages.push(message as ChatCompletionMessageParam);
      for (const call of toolCalls) {
        if (call.type !== "function") {
          messages.push({
            role: "tool",
            tool_call_id: call.id,
            content: JSON.stringify({ ok: false, error: "unsupported tool" }),
          });
          continue;
        }
        const args =
          "parsed_arguments" in call.function &&
          call.function.parsed_arguments != null
            ? call.function.parsed_arguments
            : JSON.parse(call.function.arguments) as unknown;
        const result =
          call.function.name === "source_still"
            ? await runSourceStill({
                db,
                projectId: input.projectId,
                args,
              })
            : { ok: false as const, error: `Unknown tool ${call.function.name}` };
        if (result.ok) {
          sourced.splice(0, sourced.length, result.asset);
          messages.push({
            role: "tool",
            tool_call_id: call.id,
            content: JSON.stringify({
              ok: true,
              assetId: result.asset.ref.assetId,
            }),
          });
        } else {
          messages.push({
            role: "tool",
            tool_call_id: call.id,
            content: JSON.stringify({ ok: false, error: result.error }),
          });
        }
      }
      continue;
    }
    raw = parsedOrThrow(completion, "OpenAI motion plan failed");
    break;
  }
  if (!raw) throw new Error("OpenAI motion plan failed");

  const parsed = shotPlanFromLlm(raw);
  const checked = shotPlanSchema.safeParse(
    withMotionMedia(parsed, sourced.at(-1)?.ref),
  );
  if (!checked.success) {
    throw new Error(`Invalid ShotPlan: ${checked.error.message}`);
  }
  const known = new Set(projectAssets.map((row) => row.id));
  for (const asset of sourced) known.add(asset.ref.assetId);
  if (
    motionAcceptsAssetNeeds(checked.data.category) &&
    !planMediaIsKnown(checked.data, known)
  ) {
    throw new Error("asset-fusion requires source_still");
  }

  return {
    plan: checked.data,
    assets: sourced.map((s) => s.client),
  };
}
