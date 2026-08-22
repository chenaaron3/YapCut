import { useRef } from "react";

import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  DEFAULT_THEME,
  THEME_COLOR_ROLE_LABELS,
  THEME_COLOR_ROLES,
  THEME_FONT_ROLE_LABELS,
  THEME_FONT_ROLES,
  themeOf,
} from "~/domain/project/theme";
import { InspectorCollapsible } from "~/editor/components/inspector/field/InspectorCollapsible";
import { InspectorSelect } from "~/editor/components/inspector/field/InspectorSelect";
import { useEditor } from "~/editor/store";
import { runGesture } from "~/editor/lib/selection/gesture";
import {
  CAPTION_FONT_IDS,
  CAPTION_FONT_LABELS,
  isCaptionFontId,
} from "~/remotion/captions/style";

import type { Theme, ThemeColorRole } from "~/domain/project/theme";

function hexOrFallback(value: string, fallback: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(value) ? value : fallback;
}

export function useProjectTheme(): Theme {
  return useEditor((s) => themeOf(s.config?.theme));
}

/** Project Theme — four font roles and five colors. */
export function ThemeFields() {
  const theme = useProjectTheme();
  const patchTheme = useEditor((s) => s.patchTheme);
  const colorGestureRef = useRef<(() => void) | null>(null);
  const beginColorGesture = () => {
    colorGestureRef.current ??= runGesture();
  };
  const endColorGesture = () => {
    colorGestureRef.current?.();
    colorGestureRef.current = null;
  };

  const isDefault =
    THEME_FONT_ROLES.every((role) => theme.fonts[role] === DEFAULT_THEME.fonts[role]) &&
    THEME_COLOR_ROLES.every(
      (role) => theme.colors[role] === DEFAULT_THEME.colors[role],
    );

  return (
    <InspectorCollapsible title="Theme" defaultOpen>
      <button
        type="button"
        className="text-muted-foreground hover:text-foreground text-left text-[11px] underline-offset-2 hover:underline disabled:pointer-events-none disabled:opacity-40"
        disabled={isDefault}
        onClick={() =>
          patchTheme({
            fonts: { ...DEFAULT_THEME.fonts },
            colors: { ...DEFAULT_THEME.colors },
          })
        }
      >
        Reset to default
      </button>
      <div className="grid grid-cols-2 gap-2">
        {THEME_FONT_ROLES.map((role) => (
          <div key={role} className="flex flex-col gap-1">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {THEME_FONT_ROLE_LABELS[role]}
            </Label>
            <InspectorSelect
              aria-label={`${THEME_FONT_ROLE_LABELS[role]} font`}
              value={theme.fonts[role]}
              options={CAPTION_FONT_IDS.map((id) => ({
                value: id,
                label: CAPTION_FONT_LABELS[id],
              }))}
              onChange={(id) => {
                if (!isCaptionFontId(id)) return;
                patchTheme({ fonts: { [role]: id } });
              }}
            />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {THEME_COLOR_ROLES.map((role) => (
          <ThemeColorField
            key={role}
            role={role}
            value={theme.colors[role]}
            onLiveChange={(color) =>
              patchTheme({ colors: { [role]: color } }, true)
            }
            onFocus={beginColorGesture}
            onBlur={endColorGesture}
          />
        ))}
      </div>
    </InspectorCollapsible>
  );
}

function ThemeColorField({
  role,
  value,
  onLiveChange,
  onFocus,
  onBlur,
}: {
  role: ThemeColorRole;
  value: string;
  onLiveChange: (color: string) => void;
  onFocus: () => void;
  onBlur: () => void;
}) {
  const hex = hexOrFallback(value, DEFAULT_THEME.colors[role]);
  return (
    <div className="flex flex-col gap-1">
      <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {THEME_COLOR_ROLE_LABELS[role]}
      </Label>
      <div className="flex items-center gap-2">
        <Input
          type="color"
          className="h-8 w-10 cursor-pointer p-1"
          value={hex}
          onFocus={onFocus}
          onBlur={onBlur}
          onChange={(e) => onLiveChange(e.target.value)}
        />
        <Input
          type="text"
          className="h-8 flex-1"
          value={value}
          onFocus={onFocus}
          onBlur={onBlur}
          onChange={(e) => onLiveChange(e.target.value)}
        />
      </div>
    </div>
  );
}
