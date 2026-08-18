const PROJECT_KEY = "yapcut.unclaimedProjectId";

export function readUnclaimedProjectId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(PROJECT_KEY);
    return value != null && value.length > 0 ? value : null;
  } catch {
    return null;
  }
}

export function writeUnclaimedProjectId(id: string): void {
  try {
    window.localStorage.setItem(PROJECT_KEY, id);
  } catch {
    // Private mode / quota — restore will fail; create still runs this session.
  }
}

export function clearUnclaimedProjectId(): void {
  try {
    window.localStorage.removeItem(PROJECT_KEY);
  } catch {
    // ignore
  }
}
