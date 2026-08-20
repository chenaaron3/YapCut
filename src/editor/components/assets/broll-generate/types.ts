import {
  RectangleHorizontal,
  RectangleVertical,
  Square,
} from "lucide-react";

import type { LucideIcon } from "lucide-react";

export type ImageSize = "portrait" | "square" | "landscape";

export type Candidate = {
  url: string;
  width: number | null;
  height: number | null;
};

export const SIZE_OPTIONS: {
  id: ImageSize;
  label: string;
  Icon: LucideIcon;
}[] = [
  { id: "landscape", label: "Horizontal 16:9", Icon: RectangleHorizontal },
  { id: "square", label: "Square 1:1", Icon: Square },
  { id: "portrait", label: "Vertical 9:16", Icon: RectangleVertical },
];

export const SLOT_BOX: Record<ImageSize, string> = {
  landscape: "aspect-video w-[min(calc((100cqi-1rem)/2),calc(100cqb*16/9))]",
  square: "aspect-square w-[min(calc((100cqi-1rem)/2),100cqb)]",
  portrait: "aspect-[9/16] w-[min(calc((100cqi-1rem)/2),calc(100cqb*9/16))]",
};

export const RESULT_SLOT_COUNT = 2;
