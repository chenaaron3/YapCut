import { X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { GenerateForm } from "~/editor/components/assets/broll-generate/GenerateForm";
import { ResultsPane } from "~/editor/components/assets/broll-generate/ResultsPane";
import { useEditor } from "~/editor/store";
import { api } from "~/utils/api";

import type {
  Candidate,
  ImageSize,
} from "~/editor/components/assets/broll-generate/types";
import type { EditorAsset } from "~/editor/store";

export function BrollGenerateModal({
  imageAssets,
  open,
  onClose,
}: {
  imageAssets: EditorAsset[];
  open: boolean;
  onClose: () => void;
}) {
  const projectId = useEditor((s) => s.projectId);
  const addAssets = useEditor((s) => s.addAssets);
  const [prompt, setPrompt] = useState("");
  const [imageSize, setImageSize] = useState<ImageSize>("portrait");
  const [referenceId, setReferenceId] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [addedUrls, setAddedUrls] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const addedUrlsRef = useRef(addedUrls);
  addedUrlsRef.current = addedUrls;
  const requestId = useRef(0);

  const reference = useMemo(
    () => imageAssets.find((a) => a.id === referenceId) ?? null,
    [imageAssets, referenceId],
  );

  useEffect(() => {
    if (referenceId && !reference) setReferenceId(null);
  }, [referenceId, reference]);

  useEffect(() => {
    if (open) return;
    setPrompt("");
    setImageSize("portrait");
    setReferenceId(null);
    setPicking(false);
    setCandidates([]);
    setAddedUrls(new Set());
    addedUrlsRef.current = new Set();
  }, [open]);

  const generate = api.project.generateBrollImages.useMutation({
    onError: (err) => {
      toast.error(err.message);
    },
  });
  const persist = api.project.persistGeneratedBroll.useMutation({
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const onGenerate = () => {
    if (!projectId) return;
    const instruction = prompt.trim();
    if (!instruction) {
      toast.error("Describe the still first.");
      return;
    }
    const id = ++requestId.current;
    generate.mutate(
      {
        projectId,
        prompt: instruction,
        imageSize,
        referenceAssetId: referenceId,
      },
      {
        onSuccess: (data) => {
          if (id !== requestId.current) return;
          setCandidates(data.candidates);
        },
      },
    );
  };

  const onAdd = (still: Candidate) => {
    if (!projectId || addedUrlsRef.current.has(still.url)) return;
    const next = new Set(addedUrlsRef.current).add(still.url);
    addedUrlsRef.current = next;
    setAddedUrls(next);
    persist.mutate(
      {
        projectId,
        url: still.url,
        width: still.width,
        height: still.height,
      },
      {
        onSuccess: (asset) => {
          addAssets([asset]);
        },
        onError: () => {
          const reverted = new Set(addedUrlsRef.current);
          reverted.delete(still.url);
          addedUrlsRef.current = reverted;
          setAddedUrls(reverted);
        },
      },
    );
  };

  const canGenerate = Boolean(projectId) && prompt.trim().length > 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent
        showCloseButton={false}
        overlayClassName="bg-[#450e16]/38 backdrop-blur-[2px]"
        className="bg-panel flex h-[min(760px,calc(100dvh-3rem))] max-h-[calc(100dvh-3rem)] w-[min(1320px,calc(100%-3rem))] max-w-none flex-col gap-0 overflow-hidden rounded-2xl border border-[#453239] p-0 text-[#f5f9ce] shadow-[0_20px_48px_rgba(0,0,0,0.7)] ring-0 sm:max-w-none"
      >
        <DialogHeader className="flex shrink-0 flex-row items-start justify-between gap-8 px-8 pt-6 pb-5 max-md:px-5 max-md:pt-5 max-md:pb-4">
          <div className="min-w-0">
            <DialogTitle className="ember-display text-[clamp(1.85rem,2.6vw,2.6rem)] leading-[0.98] font-semibold tracking-[-0.035em] text-[#f5f9ce]">
              Generate B-roll
            </DialogTitle>
            <DialogDescription className="mt-2 max-w-[62ch] text-[clamp(0.95rem,1.3vw,1.12rem)] leading-snug text-[#c4b8a8]">
              Provide a prompt to create a new image or attach an existing image
              to modify it.
            </DialogDescription>
          </div>
          <DialogClose
            render={
              <button
                type="button"
                title="Close"
                aria-label="Close generate B-roll dialog"
                className="grid size-10 shrink-0 place-items-center rounded-[10px] text-[#f5f9ce] transition-colors outline-none hover:bg-[#222632] hover:text-[#ffa102] focus-visible:ring-2 focus-visible:ring-[#ffa102] focus-visible:ring-offset-2 focus-visible:ring-offset-[#1a1d26]"
              />
            }
          >
            <X className="size-6 stroke-[1.5]" />
            <span className="sr-only">Close</span>
          </DialogClose>
        </DialogHeader>

        <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,0.72fr)_minmax(0,1fr)] overflow-hidden border-t border-[#453239]">
          <GenerateForm
            prompt={prompt}
            onPromptChange={setPrompt}
            imageAssets={imageAssets}
            reference={reference}
            referenceId={referenceId}
            picking={picking}
            onPick={(assetId) => {
              setReferenceId(assetId);
              setPicking(false);
            }}
            onClearReference={() => {
              setReferenceId(null);
              setPicking(false);
            }}
            onTogglePicker={() => setPicking((v) => !v)}
            onOpenPicker={() => setPicking(true)}
            imageSize={imageSize}
            onImageSizeChange={setImageSize}
            canGenerate={canGenerate}
            generatePending={generate.isPending}
            onSubmit={onGenerate}
          />
          <ResultsPane
            imageSize={imageSize}
            pending={generate.isPending}
            candidates={candidates}
            addedUrls={addedUrls}
            onAdd={onAdd}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
