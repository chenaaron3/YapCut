import { X } from "lucide-react";
import { useMemo, useRef, useState } from "react";

import { formatSfxLabel } from "~/domain/sfx";
import { Input } from "~/components/ui/input";
import {
  matchesSfxQuery,
  type SfxAssetOption,
} from "~/editor/components/inspector/field/sfx-search";
import { cn } from "~/lib/utils";

import type { KeyboardEvent } from "react";

export function SfxSearchSelect({
  assetId,
  assets,
  onChange,
  "aria-label": ariaLabel,
}: {
  assetId: string | null;
  assets: readonly SfxAssetOption[];
  onChange: (assetId: string | null) => void;
  "aria-label"?: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = useMemo(
    () => assets.find((asset) => asset.id === assetId) ?? null,
    [assets, assetId],
  );
  const selectedLabel = selected
    ? formatSfxLabel(selected.originalFilename, selected.id)
    : assetId
      ? `${assetId.slice(0, 8)}…`
      : null;

  const available = useMemo(
    () =>
      assets.filter(
        (asset) => asset.id !== assetId && matchesSfxQuery(asset, query),
      ),
    [assets, assetId, query],
  );

  const pick = (id: string | null) => {
    onChange(id);
    setQuery("");
    setHighlight(0);
    setOpen(false);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && query.length === 0 && assetId) {
      e.preventDefault();
      pick(null);
      return;
    }
    if (e.key === "Escape") {
      setOpen(false);
      return;
    }
    if (available.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setHighlight((i) => (i + 1) % available.length);
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
      setHighlight((i) => (i - 1 + available.length) % available.length);
      return;
    }
    if (e.key === "Enter") {
      const next = available[highlight] ?? available[0];
      if (!next) return;
      e.preventDefault();
      pick(next.id);
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <div
        className="flex min-h-8 flex-wrap items-center gap-1 rounded-[10px] border border-[#F5F9CE]/20 bg-panel-2 px-1.5 py-1 hover:border-[#FFA102] focus-within:border-[#FFA102] focus-within:ring-2 focus-within:ring-[#FFA102]/40"
        onClick={() => inputRef.current?.focus()}
      >
        {selectedLabel ? (
          <span className="inline-flex max-w-full items-center gap-0.5 rounded-full border border-[#450E16] bg-[#FFA102] px-2 py-0.5 text-[10px] font-medium text-[#450E16]">
            <span className="min-w-0 truncate">{selectedLabel}</span>
            <button
              type="button"
              className="rounded-full p-0.5 hover:bg-[#450E16]/10"
              aria-label={`Clear ${selectedLabel}`}
              onClick={(e) => {
                e.stopPropagation();
                pick(null);
              }}
            >
              <X className="size-2.5" />
            </button>
          </span>
        ) : null}
        <Input
          ref={inputRef}
          value={query}
          aria-label={ariaLabel ?? "Search SFX"}
          placeholder={selectedLabel ? "Replace…" : "Search SFX…"}
          className="h-5 min-w-16 flex-1 border-0 bg-transparent px-1 py-0 text-xs text-[#F5F9CE] shadow-none placeholder:text-[#F5F9CE]/40 focus-visible:ring-0 dark:bg-transparent"
          onFocus={() => setOpen(true)}
          onBlur={() => {
            window.setTimeout(() => setOpen(false), 120);
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            setHighlight(0);
            setOpen(true);
          }}
          onKeyDown={onKeyDown}
        />
      </div>
      {open && available.length > 0 ? (
        <ul className="max-h-40 overflow-y-auto rounded-[12px] border-2 border-[#450E16] bg-[#F5F9CE] py-0.5 text-[#450E16] shadow-[4px_4px_0_#450E16]">
          {available.map((asset, i) => (
            <li key={asset.id}>
              <button
                type="button"
                className={cn(
                  "flex w-full px-2 py-1 text-left text-[11px]",
                  i === highlight
                    ? "bg-[#FFA102] text-[#450E16]"
                    : "text-[#450E16]",
                )}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setHighlight(i)}
                onClick={() => pick(asset.id)}
              >
                <span className="min-w-0 truncate">
                  {formatSfxLabel(asset.originalFilename, asset.id)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {open && query.trim() && available.length === 0 ? (
        <p className="px-1 text-[10px] text-[#C4B8A8]">No matches.</p>
      ) : null}
    </div>
  );
}
