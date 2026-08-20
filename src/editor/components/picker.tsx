import { cn } from "~/lib/utils";

import type { DragEvent, MouseEvent, ReactNode } from "react";

/** Three-up picker used by asset libraries and the scribble inspector. */
export function PickerGrid({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid grid-cols-3 content-start gap-1.5", className)}>
      {children}
    </div>
  );
}

export function PickerEmpty({ children }: { children: ReactNode }) {
  return (
    <p className="text-muted-foreground col-span-3 px-0.5 py-3 text-center text-[11px]">
      {children}
    </p>
  );
}

export function PickerTile({
  label,
  title,
  selected = false,
  fillThumb = false,
  as = "div",
  draggable,
  thumbClassName,
  className,
  children,
  onClick,
  onMouseDown,
  onDragStart,
  onDragEnd,
}: {
  label: string;
  title?: string;
  selected?: boolean;
  /** Full-width square thumb (b-roll). Default is a 36px icon. */
  fillThumb?: boolean;
  as?: "div" | "button";
  draggable?: boolean;
  thumbClassName?: string;
  className?: string;
  children: ReactNode;
  onClick?: (e: MouseEvent<HTMLElement>) => void;
  onMouseDown?: (e: MouseEvent<HTMLElement>) => void;
  onDragStart?: (e: DragEvent<HTMLElement>) => void;
  onDragEnd?: (e: DragEvent<HTMLElement>) => void;
}) {
  const chrome = cn(
    "flex flex-col items-center select-none",
    fillThumb
      ? "overflow-hidden rounded-lg border gap-0 p-0"
      : "gap-1 rounded-lg border px-1 py-1.5",
    selected
      ? "border-primary bg-primary/15 text-primary"
      : "border-border bg-panel-2 text-[#F5F9CE]",
    as === "button" && !selected && "hover:border-[#FFA102]",
    draggable && "cursor-grab active:cursor-grabbing",
    className,
  );
  const inner = (
    <>
      <span
        className={cn(
          "flex items-center justify-center overflow-hidden",
          fillThumb
            ? "aspect-square w-full"
            : cn(
                "h-9 w-9 rounded",
                selected ? "bg-primary/20" : "bg-[#F5F9CE]/10",
              ),
          thumbClassName,
        )}
      >
        {children}
      </span>
      <span
        className={cn(
          "w-full truncate text-center text-[10px]",
          fillThumb && "px-1 py-1",
        )}
      >
        {label}
      </span>
    </>
  );

  if (as === "button") {
    return (
      <button
        type="button"
        title={title ?? label}
        className={chrome}
        onClick={onClick}
      >
        {inner}
      </button>
    );
  }

  return (
    <div
      title={title ?? label}
      className={chrome}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      onMouseDown={onMouseDown}
    >
      {inner}
    </div>
  );
}
