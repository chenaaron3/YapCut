import { Label } from "~/components/ui/label";
import { cn } from "~/lib/utils";

export function InspectorPills<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled,
  hint,
  variant = "pills",
}: {
  label: string;
  value: T;
  options: readonly { id: T; label: string }[];
  onChange: (id: T) => void;
  disabled?: boolean;
  hint?: string;
  variant?: "pills" | "tabs";
}) {
  const cols =
    options.length === 2
      ? "grid-cols-2"
      : options.length === 3
        ? "grid-cols-3"
        : "grid-cols-4";

  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-muted-foreground text-[10px] tracking-wider uppercase">
        {label}
      </Label>
      {variant === "tabs" ? (
        <div className="border-border flex gap-1 rounded-md border p-0.5">
          {options.map((option) => (
            <button
              key={option.id}
              type="button"
              disabled={disabled}
              className={cn(
                "flex-1 rounded px-2 py-1 text-[10px] font-medium tracking-wide uppercase",
                value === option.id
                  ? "bg-primary/15 text-foreground"
                  : "text-muted-foreground hover:text-foreground",
                disabled && "opacity-60",
              )}
              onClick={() => onChange(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : (
        <div className={cn("grid gap-1", cols)}>
          {options.map((option) => (
            <button
              key={option.id}
              type="button"
              disabled={disabled}
              className={cn(
                "rounded px-1.5 py-1 text-[10px] font-medium uppercase",
                value === option.id
                  ? "bg-primary/20 text-primary"
                  : "bg-panel-2 text-muted-foreground hover:text-foreground",
                disabled && "opacity-60",
              )}
              onClick={() => onChange(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
      {hint ? (
        <p className="text-muted-foreground text-[10px]">{hint}</p>
      ) : null}
    </div>
  );
}
