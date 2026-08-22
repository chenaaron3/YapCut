import { isThemeColorRole, isThemeFontRole } from "~/domain/project/theme";

import type { Theme } from "~/domain/project/theme";
import type {
  BackgroundStyle,
  CaptionColor,
  CaptionGroupStyle,
  WordStyle,
  WordStyleDelta,
} from "~/remotion/captions/style";

function resolveColor(
  value: CaptionColor | null | undefined,
  theme: Theme,
): string | null | undefined {
  if (value == null) return value;
  return isThemeColorRole(value) ? theme.colors[value] : value;
}

function resolveBackground(
  background: BackgroundStyle,
  theme: Theme,
): BackgroundStyle {
  return {
    kind: background.kind,
    color: resolveColor(background.color, theme),
  };
}

function resolveWordStyle(word: WordStyle, theme: Theme): WordStyle {
  return {
    fill: resolveColor(word.fill, theme) ?? word.fill,
    opacity: word.opacity,
    textShadow: word.textShadow,
    border: word.border
      ? {
          width: word.border.width,
          color: resolveColor(word.border.color, theme) ?? word.border.color,
        }
      : word.border,
    background:
      word.background == null
        ? word.background
        : resolveBackground(word.background, theme),
  };
}

function resolveWordDelta(
  delta: WordStyleDelta | undefined,
  theme: Theme,
): WordStyleDelta | undefined {
  if (!delta) return undefined;
  const out: WordStyleDelta = {};
  if (delta.fill != null) out.fill = resolveColor(delta.fill, theme) ?? delta.fill;
  if ("opacity" in delta) out.opacity = delta.opacity;
  if ("textShadow" in delta) out.textShadow = delta.textShadow;
  if ("border" in delta) {
    out.border = delta.border
      ? {
          width: delta.border.width,
          color:
            resolveColor(delta.border.color, theme) ?? delta.border.color,
        }
      : delta.border;
  }
  if ("background" in delta) {
    out.background =
      delta.background == null
        ? delta.background
        : resolveBackground(delta.background, theme);
  }
  return out;
}

/**
 * Theme roles on CaptionGroupStyle → raw faces + hex for paint / inspector.
 * Leaves concrete CaptionFontId / CSS colors untouched.
 */
export function resolveThemeStyle(
  style: CaptionGroupStyle,
  theme: Theme,
): CaptionGroupStyle {
  return {
    ...style,
    fontFamily: isThemeFontRole(style.fontFamily)
      ? theme.fonts[style.fontFamily]
      : style.fontFamily,
    background: resolveBackground(style.background, theme),
    wordStyle: resolveWordStyle(style.wordStyle, theme),
    activeWordStyle: resolveWordDelta(style.activeWordStyle, theme),
    futureWordStyle: resolveWordDelta(style.futureWordStyle, theme),
  };
}
