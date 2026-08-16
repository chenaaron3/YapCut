export function fileKey(file: File): string {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

export function formatFromName(file: File): string {
  const ext = file.name.split(".").pop()?.toUpperCase();
  return ext && ext.length <= 5 ? ext : "VIDEO";
}

export function formatClock(seconds: number | null): string {
  if (seconds == null || !Number.isFinite(seconds)) return "—";
  const safe = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
}

export function clipCountLabel(count: number): string {
  return `${count} ${count === 1 ? "clip" : "clips"}`;
}
