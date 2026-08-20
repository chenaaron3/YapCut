import { useState, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "~/components/ui/collapsible";
import { cn } from "~/lib/utils";

/** Full-width section with a top-rule header and chevron (inspector + asset groups). */
export function InspectorCollapsible({
  title,
  children,
  defaultOpen = false,
  open: openProp,
  onOpenChange,
  accessory,
  contentClassName,
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  accessory?: ReactNode;
  contentClassName?: string;
}) {
  const [uncontrolled, setUncontrolled] = useState(defaultOpen);
  const controlled = openProp !== undefined;
  const open = controlled ? openProp : uncontrolled;
  const setOpen = (next: boolean) => {
    if (!controlled) setUncontrolled(next);
    onOpenChange?.(next);
  };

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="w-full min-w-0"
    >
      <CollapsibleTrigger className="flex w-full min-w-0 items-center gap-1.5 border-t border-border pt-3 text-left hover:opacity-90">
        <ChevronRight
          className={cn(
            "size-3.5 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-90",
          )}
        />
        <span className="min-w-0 flex-1 truncate text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
          {title}
        </span>
        {accessory}
      </CollapsibleTrigger>
      <CollapsibleContent className="w-full min-w-0">
        <div
          className={cn(
            "flex w-full min-w-0 max-w-full flex-col gap-4 pt-3",
            contentClassName,
          )}
        >
          {children}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
