import { SCRIBBLE_IDS, SCRIBBLE_LABELS } from "~/domain/transcript/scribble";
import { PickerGrid, PickerTile } from "~/editor/components/picker";
import { play } from "~/editor/lib/player/player-bridge";
import { primaryId } from "~/editor/lib/selection/selection";
import { useSelection } from "~/editor/selection-store";
import { useEditor, useGlobalWords } from "~/editor/store";
import { SCRIBBLE_CATALOG } from "~/remotion/components/captions/scribble-catalog";

import type { ScribbleId } from "~/domain/transcript/scribble";
import type { MouseEvent } from "react";

function ScribbleThumb({ id }: { id: ScribbleId }) {
  const definition = SCRIBBLE_CATALOG[id];
  return (
    <svg
      viewBox={definition.viewBox}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden
      className="size-7 overflow-visible"
    >
      {definition.layers.map((layer, index) =>
        layer.type === "fill" ? (
          <path
            key={index}
            d={layer.path}
            fill="currentColor"
            opacity={layer.opacity}
          />
        ) : (
          <path
            key={index}
            d={layer.path}
            fill="none"
            stroke="currentColor"
            strokeWidth={layer.strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={layer.opacity ?? 1}
          />
        ),
      )}
    </svg>
  );
}

/**
 * Word-level scribble picker. Only patches emphasized words in the selection.
 */
export function WordInspector() {
  const selection = useSelection((s) => s.selection);
  const words = useGlobalWords();
  const patchWords = useEditor((s) => s.patchWords);
  const seekTimeline = useEditor((s) => s.seekTimeline);

  const selected = (selection?.kind === "word" ? selection.ids : [])
    .filter((id): id is number => typeof id === "number")
    .map((i) => words[i])
    .filter((w): w is NonNullable<typeof w> => w != null);
  const emphasized = selected.filter((w) => w.emphasized);
  const focus = (() => {
    const id = primaryId(selection);
    return id != null ? words[id] : undefined;
  })();

  const mixed = new Set(emphasized.map((w) => w.scribble ?? "")).size > 1;
  const active = mixed
    ? null
    : (emphasized[0]?.scribble ?? (emphasized.length > 0 ? "none" : null));

  const apply = (
    scribble: ScribbleId | undefined,
    e: MouseEvent<HTMLElement>,
  ) => {
    if (emphasized.length === 0) return;
    patchWords(
      emphasized.map((w) => w.globalIndex),
      { scribble },
    );
    const target = focus?.emphasized ? focus : emphasized[0];
    if (target) seekTimeline(target.start);
    play(e);
  };

  return (
    <div className="flex w-full min-w-0 flex-col gap-3">
      {focus ? (
        <p
          className="text-muted-foreground truncate text-[11px]"
          title={focus.text}
        >
          {focus.text}
        </p>
      ) : null}

      {emphasized.length === 0 ? (
        <p className="text-muted-foreground text-[11px]">
          Emphasize to add a scribble
        </p>
      ) : (
        <PickerGrid>
          <PickerTile
            as="button"
            label="None"
            selected={active === "none"}
            onClick={(e) => apply(undefined, e)}
          >
            —
          </PickerTile>
          {SCRIBBLE_IDS.map((id) => (
            <PickerTile
              key={id}
              as="button"
              label={SCRIBBLE_LABELS[id]}
              selected={active === id}
              onClick={(e) => apply(id, e)}
            >
              <ScribbleThumb id={id} />
            </PickerTile>
          ))}
        </PickerGrid>
      )}
    </div>
  );
}
