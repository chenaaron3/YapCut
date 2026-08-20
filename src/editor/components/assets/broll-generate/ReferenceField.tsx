import { Plus, X } from "lucide-react";

import { Label } from "~/components/ui/label";
import { BrollThumb } from "~/editor/components/assets/BrollThumb";
import {
  PickerEmpty,
  PickerGrid,
  PickerTile,
} from "~/editor/components/picker";

import type { EditorAsset } from "~/editor/store";

export function ReferenceField({
  imageAssets,
  reference,
  referenceId,
  picking,
  onPick,
  onClear,
  onTogglePicker,
  onOpenPicker,
}: {
  imageAssets: EditorAsset[];
  reference: EditorAsset | null;
  referenceId: string | null;
  picking: boolean;
  onPick: (assetId: string) => void;
  onClear: () => void;
  onTogglePicker: () => void;
  onOpenPicker: () => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <Label className="ember-mono text-[11px] font-medium tracking-[0.13em] text-[#c4b8a8]">
        REFERENCE
      </Label>
      {reference ? (
        <div className="flex min-h-16 items-center gap-3 rounded-[14px] border border-[#453239] bg-[#171922] px-3">
          <button
            type="button"
            className="flex min-w-0 flex-1 items-center gap-3 text-left"
            onClick={onOpenPicker}
          >
            <span className="size-10 shrink-0 overflow-hidden rounded-md">
              <BrollThumb asset={reference} />
            </span>
            <span className="truncate text-[1.05rem] text-[#f5f9ce]">
              {reference.originalFilename ?? reference.id.slice(0, 8)}
            </span>
          </button>
          <button
            type="button"
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-[#c4b8a8] hover:bg-[#222632] hover:text-[#f5f9ce]"
            title="Remove reference"
            aria-label="Remove reference"
            onClick={onClear}
          >
            <X className="size-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="flex min-h-16 w-full items-center justify-center gap-3 rounded-[14px] border border-dashed border-[#75677f]/65 bg-transparent px-4 text-[1.1rem] text-[#c4b8a8] transition-colors outline-none hover:border-[#ffa102] hover:bg-[#222632]/50 hover:text-[#f5f9ce] focus-visible:ring-2 focus-visible:ring-[#ffa102] focus-visible:ring-offset-2 focus-visible:ring-offset-[#1a1d26]"
          onClick={onTogglePicker}
        >
          <Plus className="size-5 stroke-[1.5]" />
          Attach from B-roll
        </button>
      )}

      {picking ? (
        <div className="min-h-0 flex-1 overflow-y-auto">
          {imageAssets.length === 0 ? (
            <PickerEmpty>
              No images in B-roll yet. Drop one on the tab first.
            </PickerEmpty>
          ) : (
            <PickerGrid>
              {imageAssets.map((asset) => (
                <PickerTile
                  key={asset.id}
                  as="button"
                  fillThumb
                  label={asset.originalFilename ?? asset.id.slice(0, 8)}
                  selected={asset.id === referenceId}
                  onClick={() => onPick(asset.id)}
                >
                  <BrollThumb asset={asset} />
                </PickerTile>
              ))}
            </PickerGrid>
          )}
        </div>
      ) : null}
    </div>
  );
}
