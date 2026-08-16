export function projectTitle(title: string | null): string {
  const trimmed = title?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : "Untitled";
}
