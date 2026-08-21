import { Video } from "@remotion/media";
import { useLayoutEffect, useRef, useState } from "react";
import {
  AbsoluteFill,
  Img,
  continueRender,
  delayRender,
  useCurrentFrame,
} from "remotion";

import { hardAlphaFromLuma } from "~/domain/asset/hard-mask";

import type { CSSProperties } from "react";

/**
 * Original pixels × hard BiRefNet luminance mask (white = keep).
 * Never plays the masker's restained RGB.
 *
 * Video cannot use CSS `mask-image` (mp4) or `mix-blend-mode: destination-in`
 * (not a CSS blend). Composite on a canvas instead.
 *
 * Player and Lambda both use @remotion/media (native decode + its canvas).
 * OffthreadVideo is avoided — it throws "No frame found at position" on long
 * sources and is too slow in the Player.
 */
function luminanceMask(maskSrc: string): CSSProperties {
  const quoted = `url("${maskSrc.replace(/"/g, '\\"')}")`;
  return {
    WebkitMaskImage: quoted,
    maskImage: quoted,
    WebkitMaskSize: "100% 100%",
    maskSize: "100% 100%",
    WebkitMaskRepeat: "no-repeat",
    maskRepeat: "no-repeat",
    WebkitMaskPosition: "center",
    maskPosition: "center",
    maskMode: "luminance",
    WebkitMaskSourceType: "luminance",
  } as CSSProperties;
}

function paintHardMask(
  src: HTMLCanvasElement,
  mask: HTMLCanvasElement,
  out: HTMLCanvasElement,
  tmp: HTMLCanvasElement,
): boolean {
  const w = src.width;
  const h = src.height;
  if (w < 2 || h < 2 || mask.width < 2) return false;
  if (out.width !== w || out.height !== h) {
    out.width = w;
    out.height = h;
  }
  if (tmp.width !== w || tmp.height !== h) {
    tmp.width = w;
    tmp.height = h;
  }
  const tctx = tmp.getContext("2d", { willReadFrequently: true });
  const ctx = out.getContext("2d");
  if (!tctx || !ctx) return false;
  tctx.drawImage(mask, 0, 0, w, h);
  const pixels = tctx.getImageData(0, 0, w, h);
  hardAlphaFromLuma(pixels.data);
  tctx.putImageData(pixels, 0, 0);
  ctx.globalCompositeOperation = "source-over";
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(src, 0, 0, w, h);
  ctx.globalCompositeOperation = "destination-in";
  ctx.drawImage(tmp, 0, 0, w, h);
  ctx.globalCompositeOperation = "source-over";
  return true;
}

function MaskedImage({
  src,
  maskSrc,
  style,
}: {
  src: string;
  maskSrc: string;
  style?: CSSProperties;
}) {
  return (
    <AbsoluteFill style={luminanceMask(maskSrc)}>
      <Img src={src} style={{ width: "100%", height: "100%", ...style }} />
    </AbsoluteFill>
  );
}

function MaskedVideo({
  src,
  maskSrc,
  trimBefore,
  trimAfter,
  volume,
  objectFit,
  style,
}: {
  src: string;
  maskSrc: string;
  trimBefore?: number;
  trimAfter?: number;
  volume: number;
  objectFit: "cover" | "contain" | "fill";
  style?: CSSProperties;
}) {
  const frame = useCurrentFrame();
  const [handle] = useState(() => delayRender("hard-mask"));
  const hostRef = useRef<HTMLDivElement>(null);
  const outRef = useRef<HTMLCanvasElement>(null);
  const tmpRef = useRef<HTMLCanvasElement | null>(null);
  const fill: CSSProperties = { width: "100%", height: "100%", ...style };

  useLayoutEffect(() => {
    let raf = 0;
    let cancelled = false;
    const paint = () => {
      if (cancelled) return;
      const host = hostRef.current;
      const out = outRef.current;
      const srcCanvas = host?.querySelector("[data-mask-plate] canvas");
      const maskCanvas = host?.querySelector("[data-mask-matte] canvas");
      if (
        host &&
        out &&
        srcCanvas instanceof HTMLCanvasElement &&
        maskCanvas instanceof HTMLCanvasElement
      ) {
        if (!tmpRef.current) tmpRef.current = document.createElement("canvas");
        try {
          if (paintHardMask(srcCanvas, maskCanvas, out, tmpRef.current)) {
            continueRender(handle);
            return;
          }
        } catch {
          /* tainted / not ready */
        }
      }
      raf = requestAnimationFrame(paint);
    };
    paint();
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [frame, handle]);

  useLayoutEffect(() => {
    return () => continueRender(handle);
  }, [handle]);

  return (
    <AbsoluteFill>
      <div
        ref={hostRef}
        style={{
          position: "absolute",
          inset: 0,
          clipPath: "inset(100%)",
          pointerEvents: "none",
        }}
      >
        <div data-mask-plate style={{ position: "absolute", inset: 0 }}>
          <Video
            src={src}
            trimBefore={trimBefore}
            trimAfter={trimAfter}
            volume={volume}
            muted={volume <= 0}
            objectFit={objectFit}
            style={fill}
            disallowFallbackToOffthreadVideo
          />
        </div>
        <div data-mask-matte style={{ position: "absolute", inset: 0 }}>
          <Video
            src={maskSrc}
            trimBefore={trimBefore}
            trimAfter={trimAfter}
            volume={0}
            muted
            objectFit={objectFit}
            style={fill}
            disallowFallbackToOffthreadVideo
          />
        </div>
      </div>
      <canvas
        ref={outRef}
        style={{
          display: "block",
          width: "100%",
          height: "100%",
          objectFit,
        }}
      />
    </AbsoluteFill>
  );
}

export function MaskedMedia({
  src,
  maskSrc,
  mediaKind,
  trimBefore,
  trimAfter,
  volume = 0,
  objectFit = "cover",
  style,
}: {
  src: string;
  maskSrc?: string;
  mediaKind: "image" | "video";
  trimBefore?: number;
  trimAfter?: number;
  volume?: number;
  objectFit?: "cover" | "contain" | "fill";
  style?: CSSProperties;
}) {
  if (!maskSrc) {
    if (mediaKind === "image") {
      return <Img src={src} style={style} />;
    }
    return (
      <Video
        src={src}
        trimBefore={trimBefore}
        trimAfter={trimAfter}
        volume={volume}
        muted={volume <= 0}
        objectFit={objectFit}
        style={style}
      />
    );
  }
  if (mediaKind === "image") {
    return <MaskedImage src={src} maskSrc={maskSrc} style={style} />;
  }
  return (
    <MaskedVideo
      src={src}
      maskSrc={maskSrc}
      trimBefore={trimBefore}
      trimAfter={trimAfter}
      volume={volume}
      objectFit={objectFit}
      style={style}
    />
  );
}
