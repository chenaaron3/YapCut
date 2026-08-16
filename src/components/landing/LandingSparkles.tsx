"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useMemo } from "react";

const SPARKLE_COLORS = ["#FFA102", "#F5F9CE", "#DD5533", "#450E16"] as const;

function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function LandingSparkles({
  active,
  seed = 7,
  inset = false,
  count = 22,
  colors = SPARKLE_COLORS,
}: {
  active: boolean;
  seed?: number;
  inset?: boolean;
  count?: number;
  colors?: readonly string[];
}) {
  const dots = useMemo(() => {
    const rand = mulberry32(seed);
    return Array.from({ length: count }, () => {
      const edge = Math.floor(rand() * 4);
      const along = 4 + rand() * 92;
      const out = 5 + rand() * 22;
      const drift = (rand() - 0.5) * 18;
      let left: string | number = 0;
      let top: string | number = 0;
      if (edge === 0) {
        left = `calc(${along}% + ${drift}px)`;
        top = inset ? out : -out;
      } else if (edge === 1) {
        left = inset ? `calc(100% - ${out}px)` : `calc(100% + ${out}px)`;
        top = `calc(${along}% + ${drift}px)`;
      } else if (edge === 2) {
        left = `calc(${along}% + ${drift}px)`;
        top = inset ? `calc(100% - ${out}px)` : `calc(100% + ${out}px)`;
      } else {
        left = inset ? out : -out;
        top = `calc(${along}% + ${drift}px)`;
      }
      return {
        left,
        top,
        size: 3 + Math.round(rand() * 6),
        color: colors[Math.floor(rand() * colors.length)]!,
        delay: rand() * 1.8,
        dur: 1.6 + rand() * 1.6,
        diamond: rand() > 0.35,
        rotate: rand() * 80 - 40,
      };
    });
  }, [seed, inset, count, colors]);

  return (
    <AnimatePresence>
      {active ? (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-20 overflow-visible"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4, ease: "easeInOut" }}
        >
          {dots.map((d, i) => (
            <motion.span
              key={i}
              className="absolute"
              style={{
                left: d.left,
                top: d.top,
                width: d.size,
                height: d.size,
                background: d.color,
                border: "1px solid #450E16",
                borderRadius: d.diamond ? 0 : 999,
              }}
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{
                opacity: [0, 1, 1, 0],
                scale: [0.55, 1, 0.95, 0.6],
                y: [2, -3, -6, -2],
                rotate: d.diamond
                  ? [45, 45 + d.rotate * 0.15, 45]
                  : [0, d.rotate * 0.2, 0],
              }}
              transition={{
                duration: d.dur,
                delay: d.delay,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
          ))}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
