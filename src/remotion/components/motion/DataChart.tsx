import {
  easeOutCubic,
  playheadSec,
  span,
} from "~/remotion/components/motion/clock";
import {
  motionLook,
  seriesColors,
  type MotionLook,
} from "~/remotion/components/motion/look";

import type { ReactNode } from "react";
import type { ChartsContent } from "~/domain/motion-config";
import type { CaptionGroupStyle } from "~/remotion/captions/style";

const AUTHORED = 8;

function piePath(cx: number, cy: number, r: number, a0: number, a1: number): string {
  const x0 = cx + r * Math.cos(a0);
  const y0 = cy + r * Math.sin(a0);
  const x1 = cx + r * Math.cos(a1);
  const y1 = cy + r * Math.sin(a1);
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M ${cx} ${cy} L ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1} Z`;
}

function clampPct(value: number): number {
  const n = value > 1 ? value / 100 : value;
  return Math.min(1, Math.max(0, n));
}

function AxisGrid({
  pad,
  width,
  innerH,
  t,
  stroke,
}: {
  pad: { l: number; r: number; t: number; b: number };
  width: number;
  innerH: number;
  t: number;
  stroke: string;
}) {
  return (
    <>
      {Array.from({ length: 5 }, (_, i) => (
        <line
          key={i}
          x1={pad.l}
          x2={width - pad.r}
          y1={pad.t + (innerH / 5) * (i + 1)}
          y2={pad.t + (innerH / 5) * (i + 1)}
          stroke={stroke}
          strokeWidth={0.5}
          opacity={span(t, 0.5 + i * 0.25, 0.5)}
        />
      ))}
    </>
  );
}

export function DataChart({
  content,
  style,
  localSec,
  durationSec,
}: {
  content: ChartsContent;
  style: CaptionGroupStyle;
  localSec: number;
  durationSec: number;
}) {
  const look = motionLook(style);
  const t = playheadSec(localSec, AUTHORED, durationSec);
  const data = content.data;
  const labels = content.labels;
  const max = Math.max(1, ...data);
  const colors = seriesColors(look.fill, content.colors, data.length);
  const head = span(t, 0, 1.2, easeOutCubic);
  const keyU = span(t, 1.0, 0.4, easeOutCubic);
  // Race is a staggered bar grow — same painter, not a separate chart type.
  const kind = content.type === "race" ? "bar" : content.type;

  if (kind === "pie") {
    const total = data.reduce((s, n) => s + Math.max(0, n), 0) || 1;
    const sweep = span(t, 1.2, 1.6, easeOutCubic);
    let acc = -Math.PI / 2;
    return (
      <ChartShell headline={content.headline} head={head} keyU={keyU} look={look}>
        <svg width={640} height={420} viewBox="0 0 640 420">
          {data.map((n, i) => {
            const slice = (Math.max(0, n) / total) * Math.PI * 2 * sweep;
            const a0 = acc;
            const a1 = acc + slice;
            acc = a1;
            return (
              <path
                key={i}
                d={piePath(320, 210, 150, a0, a1)}
                fill={colors[i]}
                opacity={0.92}
              />
            );
          })}
        </svg>
        <Legend labels={labels} colors={colors} opacity={keyU} look={look} />
      </ChartShell>
    );
  }

  if (kind === "pct") {
    const value = data[0] ?? 0;
    const ring = span(t, 0.4, 1.6, easeOutCubic);
    const r = 110;
    const c = 2 * Math.PI * r;
    return (
      <ChartShell headline={content.headline} head={head} keyU={keyU} look={look}>
        <svg width={280} height={280} viewBox="0 0 280 280">
          <circle
            cx={140}
            cy={140}
            r={r}
            fill="none"
            stroke="rgba(255,255,255,0.16)"
            strokeWidth={18}
          />
          <circle
            cx={140}
            cy={140}
            r={r}
            fill="none"
            stroke={look.fill}
            strokeWidth={18}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - ring * clampPct(value))}
            transform="rotate(-90 140 140)"
          />
        </svg>
        <div
          style={{
            ...look.font,
            ...look.paint,
            position: "absolute",
            fontSize: 56,
            fontWeight: 800,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {Math.round(value * ring)}%
        </div>
      </ChartShell>
    );
  }

  const n = Math.max(1, data.length);
  const barW = n <= 2 ? 168 : n <= 4 ? 112 : 72;
  const gap = n <= 2 ? 40 : 24;
  const pad = { l: 4, r: 4, t: 40, b: 44 };
  const innerH = 340;
  const w = pad.l + pad.r + n * barW + (n - 1) * gap;
  const h = pad.t + innerH + pad.b;

  if (kind === "line") {
    const pts = data.map((v, i) => {
      const x = pad.l + (barW + gap) * i + barW / 2;
      const y = pad.t + innerH - (v / max) * innerH;
      return `${x},${y}`;
    });
    const d = `M ${pts.join(" L ")}`;
    const draw = span(t, 1.5, 3);
    return (
      <ChartShell headline={content.headline} head={head} keyU={keyU} look={look}>
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} overflow="visible">
          {content.axes ? (
            <AxisGrid
              pad={pad}
              width={w}
              innerH={innerH}
              t={t}
              stroke="#e8e8e8"
            />
          ) : null}
          <path
            d={d}
            fill="none"
            stroke={look.fill}
            strokeWidth={3}
            pathLength={1}
            strokeDasharray={1}
            strokeDashoffset={1 - draw}
          />
          {data.map((v, i) => {
            const x = pad.l + (barW + gap) * i + barW / 2;
            const y = pad.t + innerH - (v / max) * innerH;
            const on = span(t, 1.5 + (i / Math.max(1, n - 1)) * 3, 0.2);
            return (
              <g key={i} opacity={on}>
                <circle cx={x} cy={y} r={6} fill={look.fill} />
                <text
                  x={x}
                  y={h - 18}
                  textAnchor="middle"
                  fill="#333"
                  fontSize={22}
                  fontWeight={600}
                  fontFamily={String(look.font.fontFamily ?? "")}
                >
                  {labels[i] ?? ""}
                </text>
              </g>
            );
          })}
        </svg>
      </ChartShell>
    );
  }

  return (
    <ChartShell headline={content.headline} head={head} keyU={keyU} look={look}>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} overflow="visible">
        {content.axes ? (
          <AxisGrid
            pad={pad}
            width={w}
            innerH={innerH}
            t={t}
            stroke="rgba(255,255,255,0.18)"
          />
        ) : null}
        {data.map((v, i) => {
          const start = 1.5 + i * 0.35;
          const grow = span(t, start, 0.8, easeOutCubic);
          const barH = (v / max) * innerH * grow;
          const x = pad.l + (barW + gap) * i;
          const y = pad.t + innerH - barH;
          const labelOn = span(t, start + 0.8, 0.3);
          return (
            <g key={i}>
              <rect x={x} y={y} width={barW} height={barH} fill={colors[i]} />
              <text
                x={x + barW / 2}
                y={y - 12}
                textAnchor="middle"
                fill="#111"
                fontSize={28}
                fontWeight={700}
                fontFamily={String(look.font.fontFamily ?? "")}
                opacity={labelOn}
              >
                {v}
              </text>
              <text
                x={x + barW / 2}
                y={h - 14}
                textAnchor="middle"
                fill="#333"
                fontSize={26}
                fontWeight={600}
                fontFamily={String(look.font.fontFamily ?? "")}
              >
                {labels[i] ?? ""}
              </text>
            </g>
          );
        })}
      </svg>
    </ChartShell>
  );
}

function ChartShell({
  headline,
  head,
  keyU,
  look,
  children,
}: {
  headline: string;
  head: number;
  keyU: number;
  look: MotionLook;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        width: "fit-content",
        padding: "20px 24px 16px",
        background: "rgba(250,249,246,0.96)",
        color: "#333",
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        position: "relative",
      }}
    >
      <div
        style={{
          ...look.font,
          alignSelf: "flex-start",
          fontSize: 40,
          fontWeight: 700,
          color: "#111",
          clipPath: `inset(0 ${(1 - head) * 100}% 0 0)`,
          marginBottom: 8,
          whiteSpace: "nowrap",
        }}
      >
        {headline}
      </div>
      <div style={{ opacity: keyU }}>{children}</div>
    </div>
  );
}

function Legend({
  labels,
  colors,
  opacity,
  look,
}: {
  labels: readonly string[];
  colors: readonly string[];
  opacity: number;
  look: MotionLook;
}) {
  if (labels.length === 0) return null;
  return (
    <div
      style={{
        display: "flex",
        gap: 16,
        marginTop: 12,
        opacity,
        ...look.font,
        fontSize: 13,
        color: "#666",
      }}
    >
      {labels.map((label, i) => (
        <span key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span
            style={{
              width: 10,
              height: 10,
              background: colors[i],
              display: "inline-block",
            }}
          />
          {label}
        </span>
      ))}
    </div>
  );
}
