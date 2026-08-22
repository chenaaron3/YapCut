import { X } from "lucide-react";
import { useMemo, useRef, useState } from "react";

import { Badge } from "~/components/ui/badge";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  COMPANION_SFX_CUE_IDS,
  COMPANION_SFX_CUE_LABELS,
} from "~/domain/audio/companion-sfx-map";
import {
  formatSfxLabel,
  SFX_FOLDER_ORDER,
  sfxFolderLabel,
  sfxFolderOf,
} from "~/domain/edit/sfx";
import { InspectorCollapsible } from "~/editor/components/inspector/field/InspectorCollapsible";
import { InspectorSelect } from "~/editor/components/inspector/field/InspectorSelect";
import { ThemeFields } from "~/editor/components/inspector/field/ThemeFields";
import {
  matchesSfxQuery,
  type SfxAssetOption,
} from "~/editor/components/inspector/field/sfx-search";
import { useEditor } from "~/editor/store";

import type {
  CompanionSfxCueId,
  CompanionSfxSource,
} from "~/domain/audio/companion-sfx-map";
import type { KeyboardEvent } from "react";

function sourceSelectValue(source: CompanionSfxSource): string {
  if (source.type === "none") return "none";
  if (source.type === "folder") return `folder:${source.folder}`;
  return "paths";
}

export function ProjectSettingsInspector() {
  const assets = useEditor((s) => s.assets);
  const companionSfx = useEditor((s) => s.config?.companionSfx);
  const setCompanionSfxCue = useEditor((s) => s.setCompanionSfxCue);

  const sfxAssets = useMemo(
    () =>
      assets
        .filter((a) => a.audioLibrary === "sfx")
        .slice()
        .sort((a, b) =>
          formatSfxLabel(a.originalFilename, a.id).localeCompare(
            formatSfxLabel(b.originalFilename, b.id),
          ),
        ),
    [assets],
  );

  const folders = useMemo(() => {
    const found = new Set<string>(SFX_FOLDER_ORDER);
    for (const a of sfxAssets) {
      const folder = sfxFolderOf(a.originalFilename);
      if (folder) found.add(folder);
    }
    return [...found].sort((a, b) => {
      const ai = SFX_FOLDER_ORDER.indexOf(
        a as (typeof SFX_FOLDER_ORDER)[number],
      );
      const bi = SFX_FOLDER_ORDER.indexOf(
        b as (typeof SFX_FOLDER_ORDER)[number],
      );
      if (ai >= 0 && bi >= 0) return ai - bi;
      if (ai >= 0) return -1;
      if (bi >= 0) return 1;
      return a.localeCompare(b);
    });
  }, [sfxAssets]);

  return (
    <div className="flex w-full min-w-0 flex-col gap-4">
      <ThemeFields />
      {companionSfx ? (
        <InspectorCollapsible title="SFX" defaultOpen>
          <p className="text-muted-foreground text-[10px]">
            Default SFX attached when an edit is created. Existing edits keep
            their pick.
          </p>
          {COMPANION_SFX_CUE_IDS.map((cue) => (
            <CueRow
              key={cue}
              cue={cue}
              source={companionSfx[cue]}
              folders={folders}
              sfxAssets={sfxAssets}
              onChange={(source) => setCompanionSfxCue(cue, source)}
            />
          ))}
        </InspectorCollapsible>
      ) : null}
    </div>
  );
}

function CueRow({
  cue,
  source,
  folders,
  sfxAssets,
  onChange,
}: {
  cue: CompanionSfxCueId;
  source: CompanionSfxSource;
  folders: string[];
  sfxAssets: Array<{ id: string; originalFilename: string | null }>;
  onChange: (source: CompanionSfxSource) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-muted-foreground text-[10px] tracking-wider uppercase">
        {COMPANION_SFX_CUE_LABELS[cue]}
      </Label>
      <InspectorSelect
        aria-label={COMPANION_SFX_CUE_LABELS[cue]}
        value={sourceSelectValue(source)}
        options={[
          { value: "none", label: "None" },
          ...folders.map((folder) => ({
            value: `folder:${folder}`,
            label: `${sfxFolderLabel(folder)} folder`,
          })),
          { value: "paths", label: "Custom list…" },
        ]}
        onChange={(value) => {
          if (value === "none") {
            onChange({ type: "none" });
            return;
          }
          if (value === "paths") {
            onChange({ type: "paths", paths: [] });
            return;
          }
          if (value.startsWith("folder:")) {
            onChange({ type: "folder", folder: value.slice("folder:".length) });
          }
        }}
      />
      {source.type === "paths" ? (
        <SfxPathChips
          paths={source.paths}
          sfxAssets={sfxAssets}
          onChange={(paths) => onChange({ type: "paths", paths })}
        />
      ) : null}
    </div>
  );
}

function SfxPathChips({
  paths,
  sfxAssets,
  onChange,
}: {
  paths: string[];
  sfxAssets: SfxAssetOption[];
  onChange: (paths: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = useMemo(() => new Set(paths), [paths]);
  const available = useMemo(
    () =>
      sfxAssets.filter((a) => {
        const path = a.originalFilename;
        return path != null && !selected.has(path) && matchesSfxQuery(a, query);
      }),
    [sfxAssets, selected, query],
  );

  const add = (path: string) => {
    if (selected.has(path)) return;
    onChange([...paths, path]);
    setQuery("");
    setHighlight(0);
    inputRef.current?.focus();
  };

  const remove = (path: string) => {
    onChange(paths.filter((p) => p !== path));
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && query.length === 0 && paths.length > 0) {
      e.preventDefault();
      remove(paths[paths.length - 1]!);
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
      const pick = available[highlight] ?? available[0];
      const path = pick?.originalFilename;
      if (!path) return;
      e.preventDefault();
      add(path);
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <div
        className="border-border bg-panel-2 flex min-h-8 flex-wrap items-center gap-1 rounded-md border px-1.5 py-1"
        onClick={() => inputRef.current?.focus()}
      >
        {paths.map((path) => (
          <Badge
            key={path}
            variant="secondary"
            className="max-w-full gap-0.5 pr-0.5 text-[10px]"
          >
            <span className="min-w-0 truncate">{formatSfxLabel(path)}</span>
            <button
              type="button"
              className="hover:bg-muted rounded-full p-0.5"
              aria-label={`Remove ${formatSfxLabel(path)}`}
              onClick={(e) => {
                e.stopPropagation();
                remove(path);
              }}
            >
              <X className="size-2.5" />
            </button>
          </Badge>
        ))}
        <Input
          ref={inputRef}
          value={query}
          placeholder={paths.length === 0 ? "Search SFX…" : ""}
          className="h-5 min-w-16 flex-1 border-0 bg-transparent px-1 py-0 text-xs shadow-none focus-visible:ring-0 dark:bg-transparent"
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
        <ul className="border-border bg-panel-2 max-h-32 overflow-y-auto rounded-md border py-0.5">
          {available.map((a, i) => {
            const path = a.originalFilename;
            if (!path) return null;
            return (
              <li key={a.id}>
                <button
                  type="button"
                  className={`flex w-full px-2 py-1 text-left text-[11px] ${
                    i === highlight
                      ? "bg-muted text-foreground"
                      : "text-foreground"
                  }`}
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setHighlight(i)}
                  onClick={() => add(path)}
                >
                  <span className="min-w-0 truncate">
                    {formatSfxLabel(path, a.id)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
      {open && query.trim() && available.length === 0 ? (
        <p className="text-muted-foreground px-1 text-[10px]">No matches.</p>
      ) : null}
    </div>
  );
}
