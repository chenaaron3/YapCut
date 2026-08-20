import { Sparkles } from "lucide-react";

import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { BROLL_GENERATE_MAX_PROMPT } from "~/domain/edit/broll";
import { ReferenceField } from "~/editor/components/assets/broll-generate/ReferenceField";
import { SizeField } from "~/editor/components/assets/broll-generate/SizeField";

import type { ImageSize } from "~/editor/components/assets/broll-generate/types";
import type { EditorAsset } from "~/editor/store";

export function GenerateForm({
  prompt,
  onPromptChange,
  imageAssets,
  reference,
  referenceId,
  picking,
  onPick,
  onClearReference,
  onTogglePicker,
  onOpenPicker,
  imageSize,
  onImageSizeChange,
  canGenerate,
  generatePending,
  onSubmit,
}: {
  prompt: string;
  onPromptChange: (value: string) => void;
  imageAssets: EditorAsset[];
  reference: EditorAsset | null;
  referenceId: string | null;
  picking: boolean;
  onPick: (assetId: string) => void;
  onClearReference: () => void;
  onTogglePicker: () => void;
  onOpenPicker: () => void;
  imageSize: ImageSize;
  onImageSizeChange: (size: ImageSize) => void;
  canGenerate: boolean;
  generatePending: boolean;
  onSubmit: () => void;
}) {
  return (
    <form
      className="flex min-h-0 flex-col gap-5 overflow-hidden border-r border-[#453239] px-8 py-6 max-md:px-5 max-md:py-5"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <div className="flex shrink-0 flex-col gap-2">
        <Label
          htmlFor="broll-generate-prompt"
          className="ember-mono text-[11px] font-medium tracking-[0.13em] text-[#c4b8a8]"
        >
          PROMPT
        </Label>
        <Textarea
          id="broll-generate-prompt"
          value={prompt}
          maxLength={BROLL_GENERATE_MAX_PROMPT}
          placeholder="A ceramic coffee mug, centered, warm side light"
          onChange={(e) => onPromptChange(e.target.value)}
          className="field-sizing-fixed h-28 min-h-28 resize-none rounded-2xl border-2 border-[#ffa102] bg-[#171922] px-4 py-3 text-[1.15rem] leading-[1.22] text-[#f5f9ce] shadow-[0_0_0_4px_rgba(255,161,2,0.12)] placeholder:text-[#75677f] focus-visible:border-[#ffa102] focus-visible:ring-2 focus-visible:ring-[#ffa102]"
        />
      </div>

      <ReferenceField
        imageAssets={imageAssets}
        reference={reference}
        referenceId={referenceId}
        picking={picking}
        onPick={onPick}
        onClear={onClearReference}
        onTogglePicker={onTogglePicker}
        onOpenPicker={onOpenPicker}
      />

      <div className="mt-auto flex shrink-0 items-end justify-between gap-3">
        <SizeField imageSize={imageSize} onChange={onImageSizeChange} />
        <button
          type="submit"
          disabled={generatePending || !canGenerate}
          className="flex min-h-12 min-w-32 flex-1 items-center justify-center gap-2 rounded-xl border border-[#bc7720] bg-[#a97022] px-4 py-2.5 text-[1.06rem] font-semibold text-[#1d1414] transition-colors outline-none hover:bg-[#c17d27] focus-visible:ring-2 focus-visible:ring-[#ffa102] focus-visible:ring-offset-2 focus-visible:ring-offset-[#1a1d26] disabled:pointer-events-none disabled:opacity-50 max-sm:min-w-0"
        >
          <Sparkles className="size-4 stroke-[1.7]" />
          {generatePending ? "Generating…" : "Generate"}
        </button>
      </div>
    </form>
  );
}
