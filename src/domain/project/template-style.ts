import { z } from "zod";

export const CAPTION_TEMPLATE_IDS = [
  "typewriter",
  "ugc",
  "bold",
  "hormozi",
] as const;
export type CaptionTemplateId = (typeof CAPTION_TEMPLATE_IDS)[number];

export const QUOTE_TEMPLATE_IDS = ["bold-white", "typewriter", "pop"] as const;
export type QuoteTemplateId = (typeof QUOTE_TEMPLATE_IDS)[number];

export const OVERLAY_TEMPLATE_IDS = [
  "typewriter",
  "arc-ribbon",
  "wrap-pair",
] as const;
export type OverlayTemplateId = (typeof OVERLAY_TEMPLATE_IDS)[number];

export function isCaptionTemplateId(
  value: unknown,
): value is CaptionTemplateId {
  return (
    typeof value === "string" &&
    (CAPTION_TEMPLATE_IDS as readonly string[]).includes(value)
  );
}

export function isQuoteTemplateId(value: unknown): value is QuoteTemplateId {
  return (
    typeof value === "string" &&
    (QUOTE_TEMPLATE_IDS as readonly string[]).includes(value)
  );
}

export function isOverlayTemplateId(
  value: unknown,
): value is OverlayTemplateId {
  return (
    typeof value === "string" &&
    (OVERLAY_TEMPLATE_IDS as readonly string[]).includes(value)
  );
}

export const DEFAULT_CAPTION_TEMPLATE_ID: CaptionTemplateId = "ugc";
export const DEFAULT_QUOTE_TEMPLATE_ID: QuoteTemplateId = "bold-white";
export const DEFAULT_OVERLAY_TEMPLATE_ID: OverlayTemplateId = "wrap-pair";
/** Titles seed this overlay look. */
export const DEFAULT_TEXT_TEMPLATE_ID = DEFAULT_OVERLAY_TEMPLATE_ID;
/** Listicles seed this overlay look. */
export const DEFAULT_LISTICLE_TEMPLATE_ID = DEFAULT_OVERLAY_TEMPLATE_ID;

type OverrideBag = Record<string, unknown>;

export type CaptionTemplateStyle = {
  kind: "caption";
  templateId: CaptionTemplateId;
  overrides?: OverrideBag;
};

export type QuoteTemplateStyle = {
  kind: "quote";
  templateId: QuoteTemplateId;
  overrides?: OverrideBag;
};

export type OverlayTemplateStyle = {
  kind: "overlay";
  templateId: OverlayTemplateId;
  overrides?: OverrideBag;
  subheadingOverrides?: OverrideBag;
};

/** Catalog + sparse user overrides. Discriminated by `kind` (ids collide). */
export type TemplateStyle =
  | CaptionTemplateStyle
  | QuoteTemplateStyle
  | OverlayTemplateStyle;

export function captionTemplateStyle(
  templateId: CaptionTemplateId = DEFAULT_CAPTION_TEMPLATE_ID,
  overrides?: OverrideBag,
): CaptionTemplateStyle {
  return {
    kind: "caption",
    templateId,
    ...(overrides && Object.keys(overrides).length > 0 ? { overrides } : {}),
  };
}

export function quoteTemplateStyle(
  templateId: QuoteTemplateId = DEFAULT_QUOTE_TEMPLATE_ID,
  overrides?: OverrideBag,
): QuoteTemplateStyle {
  return {
    kind: "quote",
    templateId,
    ...(overrides && Object.keys(overrides).length > 0 ? { overrides } : {}),
  };
}

export function overlayTemplateStyle(
  templateId: OverlayTemplateId = DEFAULT_OVERLAY_TEMPLATE_ID,
  overrides?: OverrideBag,
): OverlayTemplateStyle {
  return {
    kind: "overlay",
    templateId,
    ...(overrides && Object.keys(overrides).length > 0 ? { overrides } : {}),
  };
}

/** Copy bags so fan-out does not share object identity. */
export function cloneTemplateStyle<T extends TemplateStyle>(style: T): T {
  return applyTemplateStylePatch(style, {});
}

/**
 * Merge a partial patch onto a TemplateStyle.
 * `"overrides" in patch` / `"subheadingOverrides" in patch` can clear a bag.
 * `kind` is fixed by `current`.
 */
export function applyTemplateStylePatch<T extends TemplateStyle>(
  current: T,
  patch: Partial<Omit<T, "kind">>,
): T {
  const templateId = (patch.templateId ?? current.templateId) as T["templateId"];
  const overrides = "overrides" in patch ? patch.overrides : current.overrides;
  const next = {
    kind: current.kind,
    templateId,
    ...(overrides && Object.keys(overrides).length > 0
      ? { overrides: { ...overrides } }
      : {}),
  };
  if (current.kind !== "overlay") return next as T;
  const sub =
    "subheadingOverrides" in patch
      ? (patch as Partial<OverlayTemplateStyle>).subheadingOverrides
      : current.subheadingOverrides;
  return {
    ...next,
    kind: "overlay",
    ...(sub && Object.keys(sub).length > 0
      ? { subheadingOverrides: { ...sub } }
      : {}),
  } as T;
}

function idEnum<T extends string>(ids: readonly T[]) {
  return z.enum(ids as unknown as [T, ...T[]]);
}

const overrideBag = z.record(z.unknown()).optional();

export const captionTemplateStyleSchema = z.object({
  kind: z.literal("caption"),
  templateId: idEnum(CAPTION_TEMPLATE_IDS),
  overrides: overrideBag,
});

export const quoteTemplateStyleSchema = z.object({
  kind: z.literal("quote"),
  templateId: idEnum(QUOTE_TEMPLATE_IDS),
  overrides: overrideBag,
});

export const overlayTemplateStyleSchema = z.object({
  kind: z.literal("overlay"),
  templateId: idEnum(OVERLAY_TEMPLATE_IDS),
  overrides: overrideBag,
  subheadingOverrides: overrideBag,
});

export const templateStyleSchema = z.discriminatedUnion("kind", [
  captionTemplateStyleSchema,
  quoteTemplateStyleSchema,
  overlayTemplateStyleSchema,
]);
