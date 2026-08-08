import { isValidElement, type ReactElement, type ReactNode } from "react";
import { Bold, Plus, Quote, Trash2 } from "lucide-react";
import { ContextMenu } from "@base-ui/react/context-menu";

import { cn } from "~/lib/utils";

type Props = {
  /** Single element used as the right-click target (merged via `render`). */
  children: ReactElement;
  emphasized: boolean;
  onEmphasis: () => void;
  onZoom: () => void;
  onQuote: () => void;
  onDelete: () => void;
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
  onDelete,
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
          <ContextMenu.Popup className="z-50 flex w-auto min-w-0 flex-row items-center gap-0.5 rounded-md border border-border bg-panel-2 p-1 text-[#e8eaef] shadow-md outline-none">
            <MenuIcon
              label={emphasized ? "Remove emphasis" : "Emphasis"}
              active={emphasized}
              activeClass="bg-amber-700/80 text-amber-100"
              onClick={onEmphasis}
            >
              <Bold className="size-3.5" />
            </MenuIcon>
            <MenuIcon label="Zoom" onClick={onZoom}>
              <Plus className="size-3.5" />
            </MenuIcon>
            <MenuIcon label="Quote" onClick={onQuote}>
              <Quote className="size-3.5" />
            </MenuIcon>
            <MenuIcon
              label="Delete"
              className="text-red-300 focus:bg-red-950/60 focus:text-red-200 data-highlighted:bg-red-950/60 data-highlighted:text-red-200"
              onClick={onDelete}
            >
              <Trash2 className="size-3.5" />
            </MenuIcon>
          </ContextMenu.Popup>
        </ContextMenu.Positioner>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}

function MenuIcon({
  label,
  active,
  activeClass,
  className,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  activeClass?: string;
  className?: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <ContextMenu.Item
      label={label}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={cn(
        "flex size-8 cursor-default items-center justify-center rounded-md text-[#e8eaef] outline-none select-none",
        "hover:bg-[#3d4a66] focus:bg-[#3d4a66] data-highlighted:bg-[#3d4a66]",
        active && activeClass,
        className,
      )}
      onClick={onClick}
    >
      {children}
    </ContextMenu.Item>
  );
}
