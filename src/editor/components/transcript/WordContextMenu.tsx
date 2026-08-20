import { isValidElement, type ReactElement, type ReactNode } from "react";
import { Bold, Plus, Quote, Type } from "lucide-react";
import { ContextMenu } from "@base-ui/react/context-menu";

import { WORD_SELECTION_HOTKEYS } from "~/editor/lib/word/word-hotkeys";
import { cn } from "~/lib/utils";

type Props = {
  /** Single element used as the right-click target (merged via `render`). */
  children: ReactElement;
  emphasized: boolean;
  onEmphasis: () => void;
  onZoom: () => void;
  onQuote: () => void;
  onTextVfx: () => void;
};

/**
 * Prototype-style icon toolbar on right-click.
 * Uses Base UI ContextMenu; popup styled as the prototype's horizontal icon bar.
 */
export function WordContextMenu({
  children,
  emphasized,
  onEmphasis,
  onZoom,
  onQuote,
  onTextVfx,
}: Props) {
  if (!isValidElement(children)) return children;

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger render={children} />
      <ContextMenu.Portal>
        <ContextMenu.Positioner
          side="top"
          align="center"
          sideOffset={8}
          className="outline-none"
        >
          <ContextMenu.Popup
            // Portal bubbles through React to the transcript panel — don't clear selection.
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            className="z-50 flex w-auto min-w-0 flex-row items-center gap-0.5 rounded-[10px] border-2 border-[#450E16] bg-[#F5F9CE] p-1 text-[#450E16] shadow-[3px_3px_0_#450E16] outline-none"
          >
            <MenuIcon
              label={emphasized ? "Remove emphasis" : "Emphasis"}
              hotkey={WORD_SELECTION_HOTKEYS.emphasis}
              active={emphasized}
              activeClass="bg-[#FFA102] text-[#450E16]"
              onClick={onEmphasis}
            >
              <Bold className="size-3.5" />
            </MenuIcon>
            <MenuIcon
              label="Zoom"
              hotkey={WORD_SELECTION_HOTKEYS.zoom}
              onClick={onZoom}
            >
              <Plus className="size-3.5" />
            </MenuIcon>
            <MenuIcon
              label="Quote"
              hotkey={WORD_SELECTION_HOTKEYS.quote}
              onClick={onQuote}
            >
              <Quote className="size-3.5" />
            </MenuIcon>
            <MenuIcon
              label="Text VFX"
              hotkey={WORD_SELECTION_HOTKEYS.text}
              onClick={onTextVfx}
            >
              <Type className="size-3.5" />
            </MenuIcon>
          </ContextMenu.Popup>
        </ContextMenu.Positioner>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}

function MenuIcon({
  label,
  hotkey,
  active,
  activeClass,
  className,
  onClick,
  children,
}: {
  label: string;
  hotkey: string;
  active?: boolean;
  activeClass?: string;
  className?: string;
  onClick: () => void;
  children: ReactNode;
}) {
  const titled = `${label} (${hotkey})`;
  return (
    <ContextMenu.Item
      label={titled}
      title={titled}
      aria-label={titled}
      aria-keyshortcuts={hotkey}
      aria-pressed={active}
      className={cn(
        "relative flex size-8 cursor-default items-center justify-center rounded-md text-[#450E16] outline-none select-none",
        "hover:bg-[#FFA102] focus:bg-[#FFA102] data-highlighted:bg-[#FFA102]",
        active && activeClass,
        className,
      )}
      onClick={onClick}
    >
      <span className="relative inline-flex">
        {children}
        <span
          aria-hidden
          className="pointer-events-none absolute -right-1.5 -bottom-1 text-[9px] leading-none font-medium text-[#450E16]/55"
        >
          {hotkey}
        </span>
      </span>
    </ContextMenu.Item>
  );
}
