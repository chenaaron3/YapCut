import { X } from "lucide-react";

import { ClipStack } from "~/components/projects/create-project/ClipStack";
import { clipCountLabel } from "~/components/projects/create-project/format";
import { StitchedPreview } from "~/components/projects/create-project/StitchedPreview";
import { useCreateClips } from "~/components/projects/create-project/use-create-clips";
import { useCreateProject } from "~/components/projects/create-project/use-create-project";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "~/components/ui/dialog";
import { cn } from "~/lib/utils";

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated?: (projectId: string) => void;
};

export function CreateProjectModal({ open, onClose, onCreated }: Props) {
  const { phase, busy, handleCreate, uploader } = useCreateProject({
    open,
    onClose,
    onCreated,
  });
  const {
    clips,
    activeId,
    setActiveId,
    setDraggingId,
    draggingClip,
    status,
    setStatus,
    checking,
    dropzone,
    moveClip,
    removeClip,
    onDragStart,
    onDragEnd,
  } = useCreateClips(open, busy, uploader);

  const {
    getRootProps,
    getInputProps,
    open: openFilePicker,
    isDragAccept,
  } = dropzone;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !busy) onClose();
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="ember-shell grid max-h-[calc(100dvh-2rem)] w-full overflow-y-auto rounded-[24px] border-2 border-[#450E16] bg-[#F5F9CE] p-0 text-[#450E16] shadow-[12px_13px_0_#450E16] ring-0 sm:max-w-[min(44rem,calc(100%-2rem))] lg:h-[min(40rem,calc(100dvh-2rem))] lg:grid-cols-2 lg:overflow-hidden"
      >
        <section
          {...getRootProps()}
          className={cn(
            "relative flex min-h-0 min-w-0 flex-col overflow-x-hidden border-[#450E16]/20 px-6 pt-6 pb-6 outline-none lg:border-r-[1.5px] lg:px-7",
            isDragAccept && "bg-[#FFA102]/15",
          )}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <DialogTitle className="ember-display text-[clamp(2.2rem,4vw,3.2rem)] leading-[0.82] font-bold tracking-[-0.06em]">
                New project
              </DialogTitle>
              <DialogDescription className="mt-3 max-w-[34ch] text-base leading-snug text-[#432E6F]">
                Upload talking head clips here. We’ll stitch them together into
                one video.
              </DialogDescription>
            </div>
            <DialogClose
              disabled={busy}
              render={
                <button
                  type="button"
                  className="grid size-11 shrink-0 place-items-center rounded-full text-[#450E16] hover:bg-[#FFA102]/18"
                  aria-label="Close new project dialog"
                  title="Close"
                />
              }
            >
              <X className="size-6" aria-hidden />
            </DialogClose>
          </div>

          <ClipStack
            clips={clips}
            activeId={activeId}
            draggingClip={draggingClip}
            busy={busy}
            checking={checking}
            isDragAccept={isDragAccept}
            getInputProps={getInputProps}
            openFilePicker={openFilePicker}
            onSelect={(id, index) => {
              setActiveId(id);
              const clip = clips.find((item) => item.id === id);
              setStatus(
                `Previewing clip ${index + 1}: ${clip?.file.name ?? ""}`,
              );
            }}
            onRemove={removeClip}
            onMove={moveClip}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onDragCancel={() => setDraggingId(null)}
          />
          <p className="sr-only" role="status" aria-live="polite">
            {status}
          </p>
        </section>

        <section className="flex min-h-0 min-w-0 flex-col bg-[#ECEFC0]/70 px-4 pt-5 pb-4 lg:h-full">
          <StitchedPreview
            clips={clips}
            activeId={activeId}
            onActiveChange={setActiveId}
          />

          <footer className="mt-3 flex shrink-0 justify-center">
            <Button
              type="button"
              variant="ember"
              disabled={
                clips.length === 0 ||
                busy ||
                checking ||
                clips.some((clip) => clip.uploadStatus !== "done")
              }
              className="h-auto min-h-12 w-fit rounded-2xl px-4 py-2.5 text-base font-bold shadow-[4px_5px_0_#450E16] hover:translate-x-px hover:translate-y-px hover:shadow-[2px_3px_0_#450E16]"
              onClick={() => {
                void handleCreate(clips);
              }}
            >
              {phase === "finalizing"
                ? "Starting…"
                : clips.some(
                      (clip) =>
                        clip.uploadStatus === "queued" ||
                        clip.uploadStatus === "uploading",
                    )
                  ? "Uploading…"
                  : `Create project · ${clipCountLabel(clips.length)}`}
            </Button>
          </footer>
        </section>
      </DialogContent>
    </Dialog>
  );
}
