import { z } from "zod";

import { CAPTION_FONT_IDS } from "~/remotion/captions/style";

import type { CaptionFontId } from "~/remotion/captions/style";

export const THEME_FONT_ROLES = [
  "clean",
  "punch",
  "script",
  "handwritten",
] as const;
export type ThemeFontRole = (typeof THEME_FONT_ROLES)[number];

export function isThemeFontRole(value: unknown): value is ThemeFontRole {
  return (
    typeof value === "string" &&
    (THEME_FONT_ROLES as readonly string[]).includes(value)
  );
}

export const THEME_COLOR_ROLES = [
  "ink",
  "paper",
  "stroke",
  "accent",
  "brand",
] as const;
export type ThemeColorRole = (typeof THEME_COLOR_ROLES)[number];

export function isThemeColorRole(value: unknown): value is ThemeColorRole {
  return (
    typeof value === "string" &&
    (THEME_COLOR_ROLES as readonly string[]).includes(value)
  );
}

export type Theme = {
  fonts: Record<ThemeFontRole, CaptionFontId>;
  colors: Record<ThemeColorRole, string>;
};

export const DEFAULT_THEME: Theme = {
  fonts: {
    clean: "chillax",
    punch: "clash-display",
    script: "dancing-script",
    handwritten: "comico",
  },
  colors: {
    ink: "#FFFFFF",
    paper: "#111111",
    stroke: "#000000",
    accent: "#FFE600",
    brand: "#E53935",
  },
};

export const THEME_FONT_ROLE_LABELS: Record<ThemeFontRole, string> = {
  clean: "Clean",
  punch: "Punch",
  script: "Script",
  handwritten: "Handwritten",
};

export const THEME_COLOR_ROLE_LABELS: Record<ThemeColorRole, string> = {
  ink: "Ink",
  paper: "Paper",
  stroke: "Stroke",
  accent: "Accent",
  brand: "Brand",
};

export function cloneTheme(theme: Theme): Theme {
  return {
    fonts: { ...theme.fonts },
    colors: { ...theme.colors },
  };
}

export function applyThemePatch(
  current: Theme,
  patch: { fonts?: Partial<Theme["fonts"]>; colors?: Partial<Theme["colors"]> },
): Theme {
  return {
    fonts: { ...current.fonts, ...patch.fonts },
    colors: { ...current.colors, ...patch.colors },
  };
}

const captionFontEnum = z.enum(
  CAPTION_FONT_IDS as unknown as [CaptionFontId, ...CaptionFontId[]],
);

export const themeSchema = z
  .object({
    fonts: z.object({
      clean: captionFontEnum,
      punch: captionFontEnum,
      script: captionFontEnum,
      handwritten: captionFontEnum,
    }),
    colors: z.object({
      ink: z.string().min(1),
      paper: z.string().min(1),
      stroke: z.string().min(1),
      accent: z.string().min(1),
      brand: z.string().min(1),
    }),
  })
  .default(() => cloneTheme(DEFAULT_THEME));

export function themeOf(theme: Theme | undefined | null): Theme {
  return theme ?? DEFAULT_THEME;
}
