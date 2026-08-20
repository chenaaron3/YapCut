import { useEditor } from "~/editor/store";

/**
 * Start a multi-update gesture (history once; live commits skip tRPC).
 * Returns an idempotent `end` that flushes autosave.
 */
export function runGesture(): () => void {
  useEditor.getState().beginGesture();
  let done = false;
  return () => {
    if (done) return;
    done = true;
    useEditor.getState().endGesture();
  };
}

/**
 * `runGesture` plus automatic end on the next window pointerup/cancel
 * (capture). Call the returned `end` early for Escape / cancel paths.
 */
export function beginPointerGesture(): () => void {
  const end = runGesture();
  const onUp = () => {
    end();
    window.removeEventListener("pointerup", onUp, true);
    window.removeEventListener("pointercancel", onUp, true);
  };
  window.addEventListener("pointerup", onUp, true);
  window.addEventListener("pointercancel", onUp, true);
  return end;
}
