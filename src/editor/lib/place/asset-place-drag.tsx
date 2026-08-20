import { type DragEvent } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";

import { chromeByKey } from "~/editor/lib/timeline/edit-chrome";
import { useTranscriptUi } from "~/editor/transcript-ui-store";
import { cn } from "~/lib/utils";

import type { EditChromeKey } from "~/editor/lib/timeline/edit-chrome";
import type { AssetDropKind } from "~/editor/lib/place/place-asset-drop";
import type { EditorAsset } from "~/editor/store";
import type { Root } from "react-dom/client";

let ghostHost: HTMLDivElement | null = null;
let ghostRoot: Root | null = null;

function ensureGhostRoot(): { host: HTMLDivElement; root: Root } {
  if (ghostHost && ghostRoot) return { host: ghostHost, root: ghostRoot };
  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  host.style.cssText =
    "position:fixed;left:-9999px;top:0;pointer-events:none;font-size:18px;line-height:1;z-index:0";
  document.body.appendChild(host);
  ghostHost = host;
  ghostRoot = createRoot(host);
  return { host, root: ghostRoot };
}

/** Same chip as the in-transcript edit marker — used as the HTML5 drag ghost. */
function EditMarkerDragGhost({
  chromeKey,
  brollAsset,
}: {
  chromeKey: EditChromeKey;
  brollAsset?: EditorAsset | null;
}) {
  const chrome = chromeByKey(chromeKey);
  const { Icon } = chrome;
  const thumbSrc =
    chromeKey === "broll" && brollAsset?.kind === "image"
      ? brollAsset.playbackUrl
      : null;

  return (
    <span
      className={cn(
        "relative inline-flex size-[1.1em] shrink-0 items-center justify-center overflow-hidden rounded-sm align-middle",
        thumbSrc ? "ring-broll/60 ring-1" : chrome.markerClass,
      )}
    >
      {thumbSrc ? (
        <img
          src={thumbSrc}
          alt=""
          draggable={false}
          className="size-full bg-black object-cover"
        />
      ) : (
        <Icon className="size-[0.65em]" strokeWidth={2.5} />
      )}
    </span>
  );
}

/** Swap the native row/tile ghost for the transcript marker, hotspot-centered. */
function setEditMarkerDragImage(
  event: DragEvent,
  chromeKey: EditChromeKey,
  brollAsset?: EditorAsset | null,
): void {
  const { host, root } = ensureGhostRoot();
  flushSync(() => {
    root.render(
      <EditMarkerDragGhost chromeKey={chromeKey} brollAsset={brollAsset} />,
    );
  });
  const ghost = host.firstElementChild as HTMLElement | null;
  if (!ghost) return;
  const { width, height } = ghost.getBoundingClientRect();
  event.dataTransfer.setDragImage(
    ghost,
    Math.round(width / 2),
    Math.round(height / 2),
  );
}

export function beginAssetPlaceDrag(
  event: DragEvent,
  kind: AssetDropKind,
  chromeKey: EditChromeKey,
  brollAsset?: EditorAsset | null,
): void {
  event.dataTransfer.effectAllowed = "move";
  setEditMarkerDragImage(event, chromeKey, brollAsset);
  useTranscriptUi.getState().setAssetDragKind(kind);
}

export function endAssetPlaceDrag(): void {
  useTranscriptUi.getState().setAssetDragKind(null);
}
