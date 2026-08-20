"use client";

import { useEffect, useRef, useState } from "react";

import { hardAlphaFromLuma } from "~/domain/asset/hard-mask";
import { cn } from "~/lib/utils";

import type { CSSProperties } from "react";
import type { EditorAsset } from "~/editor/store";

const CHECKER =
  "bg-[repeating-conic-gradient(#3a3a3a_0%_25%,#1f1f1f_0%_50%)] bg-[length:10px_10px]";

function luminanceMask(maskSrc: string): CSSProperties {
  const quoted = `url("${maskSrc.replace(/"/g, '\\"')}")`;
  return {
    WebkitMaskImage: quoted,
    maskImage: quoted,
    WebkitMaskSize: "cover",
    maskSize: "cover",
    WebkitMaskRepeat: "no-repeat",
    maskRepeat: "no-repeat",
    WebkitMaskPosition: "center",
    maskPosition: "center",
    maskMode: "luminance",
    WebkitMaskSourceType: "luminance",
  } as CSSProperties;
}

function loadVideo(src: string): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.crossOrigin = "anonymous";
    video.onloadeddata = () => resolve(video);
    video.onerror = () => reject(new Error("video"));
    video.src = src;
    video.load();
  });
}

function MaskedVideoThumb({
  src,
  maskSrc,
  className,
}: {
  src: string;
  maskSrc: string;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    const canvas = canvasRef.current;
    if (!canvas) return;

    void (async () => {
      try {
        const [source, mask] = await Promise.all([
          loadVideo(src),
          loadVideo(maskSrc),
        ]);
        if (cancelled) return;
        const vw = source.videoWidth;
        const vh = source.videoHeight;
        if (vw < 2 || vh < 2) {
          setFailed(true);
          return;
        }
        const max = 256;
        const scale = Math.min(1, max / Math.max(vw, vh));
        const w = Math.max(2, Math.round(vw * scale));
        const h = Math.max(2, Math.round(vh * scale));
        const srcCanvas = document.createElement("canvas");
        const maskCanvas = document.createElement("canvas");
        const tmp = document.createElement("canvas");
        srcCanvas.width = maskCanvas.width = tmp.width = w;
        srcCanvas.height = maskCanvas.height = tmp.height = h;
        srcCanvas.getContext("2d")!.drawImage(source, 0, 0, w, h);
        maskCanvas.getContext("2d")!.drawImage(mask, 0, 0, w, h);
        const tctx = tmp.getContext("2d", { willReadFrequently: true });
        const ctx = canvas.getContext("2d");
        if (!tctx || !ctx) {
          setFailed(true);
          return;
        }
        tctx.drawImage(maskCanvas, 0, 0, w, h);
        const pixels = tctx.getImageData(0, 0, w, h);
        hardAlphaFromLuma(pixels.data);
        tctx.putImageData(pixels, 0, 0);
        canvas.width = w;
        canvas.height = h;
        ctx.drawImage(srcCanvas, 0, 0, w, h);
        ctx.globalCompositeOperation = "destination-in";
        ctx.drawImage(tmp, 0, 0, w, h);
        ctx.globalCompositeOperation = "source-over";
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [src, maskSrc]);

  return (
    <div className={className}>
      <canvas
        ref={canvasRef}
        className={cn("size-full object-cover", failed && "hidden")}
      />
      {failed ? (
        <video
          src={src}
          muted
          playsInline
          preload="metadata"
          className="size-full object-cover"
        />
      ) : null}
    </div>
  );
}

export function BrollThumb({
  asset,
  className,
}: {
  asset: EditorAsset;
  className?: string;
}) {
  const maskUrl =
    asset.mask?.type === "cutout"
      ? (asset.mask.playbackUrl ?? undefined)
      : undefined;
  const frameClass = cn(
    "aspect-square w-full",
    maskUrl ? CHECKER : "bg-black",
    className,
  );

  if (asset.kind === "video") {
    if (maskUrl) {
      return (
        <MaskedVideoThumb
          src={asset.playbackUrl}
          maskSrc={maskUrl}
          className={frameClass}
        />
      );
    }
    return (
      <video
        src={asset.playbackUrl}
        muted
        playsInline
        preload="metadata"
        className={cn(frameClass, "object-cover")}
      />
    );
  }

  if (maskUrl) {
    return (
      <div className={frameClass}>
        <img
          src={asset.playbackUrl}
          alt={asset.originalFilename ?? "b-roll"}
          className="size-full object-cover"
          style={luminanceMask(maskUrl)}
        />
      </div>
    );
  }

  return (
    <img
      src={asset.playbackUrl}
      alt={asset.originalFilename ?? "b-roll"}
      className={cn(frameClass, "object-cover")}
    />
  );
}
