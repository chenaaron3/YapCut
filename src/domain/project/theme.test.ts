/**
 * Theme resolve + catalog role contract.
 * Run: npx tsx src/domain/project/theme.test.ts
 */
import {
  DEFAULT_THEME,
  isThemeColorRole,
  isThemeFontRole,
} from "~/domain/project/theme";
import {
  applyCaptionOverrides,
  isCaptionFontId,
} from "~/remotion/captions/style";
import { captionTemplateStyle } from "~/domain/project/template-style";
import {
  CAPTION_TEMPLATE_LIST,
  CAPTION_TEMPLATES,
} from "~/remotion/templates/caption";
import { OVERLAY_TEMPLATE_LIST } from "~/remotion/templates/overlay";
import { QUOTE_TEMPLATE_LIST } from "~/remotion/templates/quote";
import { resolveTemplateStyle } from "~/remotion/templates/style";
import { resolveThemeStyle } from "~/remotion/templates/theme-style";

import type {
  CaptionGroupStyle,
  WordStyle,
  WordStyleDelta,
} from "~/remotion/captions/style";

function check(name: string, ok: boolean) {
  if (!ok) throw new Error(name);
  console.log(`ok  ${name}`);
}

function pushColor(
  out: { path: string; value: string }[],
  path: string,
  value: string | null | undefined,
) {
  if (value == null || value === "") return;
  out.push({ path, value });
}

function pushWordColors(
  out: { path: string; value: string }[],
  prefix: string,
  word: WordStyle | WordStyleDelta,
) {
  pushColor(out, `${prefix}.fill`, word.fill);
  if (word.border) pushColor(out, `${prefix}.border.color`, word.border.color);
  if (word.background) {
    pushColor(out, `${prefix}.background.color`, word.background.color);
  }
}

/** Set fill / border / background colors on a group (textShadow is baked, skipped). */
function presentColors(
  style: CaptionGroupStyle,
): { path: string; value: string }[] {
  const out: { path: string; value: string }[] = [];
  pushColor(out, "background.color", style.background.color);
  pushWordColors(out, "wordStyle", style.wordStyle);
  if (style.activeWordStyle) {
    pushWordColors(out, "activeWordStyle", style.activeWordStyle);
  }
  if (style.futureWordStyle) {
    pushWordColors(out, "futureWordStyle", style.futureWordStyle);
  }
  return out;
}

function assertCatalogRoles(label: string, style: CaptionGroupStyle) {
  check(`${label} font is role`, isThemeFontRole(style.fontFamily));
  for (const { path, value } of presentColors(style)) {
    check(`${label} ${path} is role`, isThemeColorRole(value));
  }

  const resolved = resolveThemeStyle(style, DEFAULT_THEME);
  check(`${label} resolved font is face`, isCaptionFontId(resolved.fontFamily));
  if (isThemeFontRole(style.fontFamily)) {
    check(
      `${label} font maps through theme`,
      resolved.fontFamily === DEFAULT_THEME.fonts[style.fontFamily],
    );
  }
  const catalogColors = presentColors(style);
  const resolvedColors = presentColors(resolved);
  check(
    `${label} resolved color slot count`,
    catalogColors.length === resolvedColors.length,
  );
  for (let i = 0; i < catalogColors.length; i++) {
    const raw = resolvedColors[i]!;
    check(`${label} ${raw.path} is raw`, !isThemeColorRole(raw.value));
    const role = catalogColors[i]!;
    if (isThemeColorRole(role.value)) {
      check(
        `${label} ${raw.path} maps through theme`,
        raw.value === DEFAULT_THEME.colors[role.value],
      );
    }
  }
}

const ugc = resolveTemplateStyle(captionTemplateStyle("ugc"), DEFAULT_THEME);
check("ugc inherits clean face", ugc.fontFamily === DEFAULT_THEME.fonts.clean);
check("ugc fill is ink", ugc.wordStyle.fill === DEFAULT_THEME.colors.ink);
check(
  "ugc stroke is theme stroke",
  ugc.wordStyle.border?.color === DEFAULT_THEME.colors.stroke,
);

const punchTheme = {
  ...DEFAULT_THEME,
  fonts: { ...DEFAULT_THEME.fonts, clean: "satoshi" as const },
};
check(
  "swapping clean remaps ugc",
  resolveTemplateStyle(captionTemplateStyle("ugc"), punchTheme).fontFamily ===
    "satoshi",
);

const overridden = applyCaptionOverrides(ugc, { fontFamily: "tanker" });
check("edit override wins over role", overridden.fontFamily === "tanker");

const hormozi = resolveThemeStyle(CAPTION_TEMPLATES.hormozi.style, DEFAULT_THEME);
check(
  "hormozi pill is accent",
  hormozi.activeWordStyle?.background?.color === DEFAULT_THEME.colors.accent,
);

for (const t of CAPTION_TEMPLATE_LIST) {
  assertCatalogRoles(`caption:${t.id}`, t.style);
}
for (const t of QUOTE_TEMPLATE_LIST) {
  assertCatalogRoles(`quote:${t.id}`, t.style);
}
for (const t of OVERLAY_TEMPLATE_LIST) {
  assertCatalogRoles(`overlay:${t.id}:heading`, t.headingStyle);
  assertCatalogRoles(`overlay:${t.id}:sub`, t.subheadingStyle);
}

console.log("theme.resolve ok");
