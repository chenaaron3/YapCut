const VOCALIZED_PAUSES = [
  "um",
  "uh",
  "uhm",
  "uhh",
  "er",
  "ah",
  "hmm",
  "mm",
  "mhm",
] as const;

function normalizeToken(word: string): string {
  return word
    .toLowerCase()
    .replace(/^[^a-z0-9']+|[^a-z0-9']+$/gi, "")
    .trim();
}

/** Vocalized pause (`um` / `uh` / …) — not discourse "like" / "you know". */
export function isVocalizedPause(word: string): boolean {
  const token = normalizeToken(word);
  if (!token) return false;
  return (VOCALIZED_PAUSES as readonly string[]).includes(token);
}
