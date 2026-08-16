import { MousePointer2 } from "lucide-react";

type Props = {
  x: number;
  y: number;
  pressed?: boolean;
  visible?: boolean;
};

export function StoryCursor({ x, y, pressed, visible = true }: Props) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute z-40 grid size-11 place-items-center rounded-full border-2 border-[#450E16] bg-[#FFA102] text-[#450E16] shadow-[5px_6px_0_rgba(69,14,22,.92)] transition-[transform] duration-75"
      style={{
        left: `${x}%`,
        top: `${y}%`,
        opacity: visible ? 1 : 0,
        transform: `translate(-30%, -20%) scale(${pressed ? 0.82 : 1})`,
      }}
    >
      <MousePointer2 className="size-5" />
    </div>
  );
}
