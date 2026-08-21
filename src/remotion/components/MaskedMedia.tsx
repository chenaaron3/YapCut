import { Video } from "@remotion/media";
import { useCallback, useLayoutEffect, useRef, useState } from "react";
import {
  AbsoluteFill,
  Img,
  OffthreadVideo,
  continueRender,
  delayRender,
  getRemotionEnvironment,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

import { hardAlphaFromLuma } from "~/domain/asset/hard-mask";

import type { CSSProperties } from "react";

/**
 * Original × hard BiRefNet luminance mask (white = keep).
 *
 * Preview: @remotion/media (native decode) + scrape its canvases.
 * Lambda: OffthreadVideo frames — no DOM canvas to scrape.
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

function sourceSize(source: CanvasImageSource): { w: number; h: number } {
  if (source instanceof HTMLVideoElement) {
    return { w: source.videoWidth, h: source.videoHeight };
  }
  if (source instanceof HTMLImageElement) {
    return { w: source.naturalWidth, h: source.naturalHeight };
  }
  if (source instanceof HTMLCanvasElement || source instanceof OffscreenCanvas) {
    return { w: source.width, h: source.height };
  }
  if (typeof ImageBitmap !== "undefined" && source instanceof ImageBitmap) {
    return { w: source.width, h: source.height };
  }
  return { w: 0, h: 0 };
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  dw: number,
  dh: number,
): boolean {
  const { w: sw, h: sh } = sourceSize(source);
  if (sw < 2 || sh < 2) return false;
  const scale = Math.max(dw / sw, dh / sh);
  const w = sw * scale;
  const h = sh * scale;
  ctx.drawImage(source, (dw - w) / 2, (dh - h) / 2, w, h);
  return true;
}

/** Same-size canvases (preview scrape) or native frames fitted to composition (Lambda). */
function paintHardMask(
  src: CanvasImageSource,
  mask: CanvasImageSource,
  out: HTMLCanvasElement,
  tmp: HTMLCanvasElement,
  width: number,
  height: number,
): boolean {
  if (width < 2 || height < 2) return false;
  if (out.width !== width || out.height !== height) {
    out.width = width;
    out.height = height;
  }
  if (tmp.width !== width || tmp.height !== height) {
    tmp.width = width;
    tmp.height = height;
  }
  const tctx = tmp.getContext("2d", { willReadFrequently: true });
  const ctx = out.getContext("2d");
  if (!tctx || !ctx) return false;

  tctx.clearRect(0, 0, width, height);
  if (!drawCover(tctx, mask, width, height)) return false;
  const pixels = tctx.getImageData(0, 0, width, height);
  hardAlphaFromLuma(pixels.data);
  tctx.putImageData(pixels, 0, 0);

  ctx.globalCompositeOperation = "source-over";
  ctx.clearRect(0, 0, width, height);
  if (!drawCover(ctx, src, width, height)) return false;
  ctx.globalCompositeOperation = "destination-in";
  ctx.drawImage(tmp, 0, 0, width, height);
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

const HIDDEN: CSSProperties = {
  position: "absolute",
  inset: 0,
  opacity: 0,
  pointerEvents: "none",
};

function MaskedVideoPreview({
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
          if (
            paintHardMask(
              srcCanvas,
              maskCanvas,
              out,
              tmpRef.current,
              srcCanvas.width,
              srcCanvas.height,
            )
          ) {
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

function MaskedVideoRender({
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
  const { width, height } = useVideoConfig();
  const [handle] = useState(() => delayRender("hard-mask-render"));
  const outRef = useRef<HTMLCanvasElement>(null);
  const tmpRef = useRef<HTMLCanvasElement | null>(null);
  const srcFrame = useRef<CanvasImageSource | null>(null);
  const maskFrame = useRef<CanvasImageSource | null>(null);
  const released = useRef(false);
  const fill: CSSProperties = { width: "100%", height: "100%", ...style };

  const tryPaint = useCallback(() => {
    const out = outRef.current;
    const plate = srcFrame.current;
    const matte = maskFrame.current;
    if (!out || !plate || !matte) return;
    if (!tmpRef.current) tmpRef.current = document.createElement("canvas");
    try {
      if (
        !paintHardMask(plate, matte, out, tmpRef.current, width, height)
      ) {
        return;
      }
      if (!released.current) {
        released.current = true;
        continueRender(handle);
      }
    } catch {
      /* not ready */
    }
  }, [handle, height, width]);

  useLayoutEffect(() => {
    tryPaint();
  }, [frame, tryPaint]);

  useLayoutEffect(() => {
    return () => {
      if (!released.current) continueRender(handle);
    };
  }, [handle]);

  return (
    <AbsoluteFill>
      <OffthreadVideo
        src={src}
        trimBefore={trimBefore}
        trimAfter={trimAfter}
        volume={volume}
        muted={volume <= 0}
        style={HIDDEN}
        crossOrigin="anonymous"
        onVideoFrame={(image) => {
          srcFrame.current = image;
          tryPaint();
        }}
      />
      <OffthreadVideo
        src={maskSrc}
        trimBefore={trimBefore}
        trimAfter={trimAfter}
        volume={0}
        muted
        style={HIDDEN}
        crossOrigin="anonymous"
        onVideoFrame={(image) => {
          maskFrame.current = image;
          tryPaint();
        }}
      />
      <canvas
        ref={outRef}
        style={{
          display: "block",
          width: "100%",
          height: "100%",
          objectFit,
          ...fill,
        }}
      />
    </AbsoluteFill>
  );
}

function MaskedVideo(props: {
  src: string;
  maskSrc: string;
  trimBefore?: number;
  trimAfter?: number;
  volume: number;
  objectFit: "cover" | "contain" | "fill";
  style?: CSSProperties;
}) {
  if (getRemotionEnvironment().isRendering) {
    return <MaskedVideoRender {...props} />;
  }
  return <MaskedVideoPreview {...props} />;
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
