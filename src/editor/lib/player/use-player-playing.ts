import { useSyncExternalStore } from "react";

import {
  getPlayerPlaying,
  subscribePlayerPlaying,
} from "~/editor/lib/player/player-bridge";

/** Remotion editor player play/pause. False until the player ref is set. */
export function usePlayerPlaying(): boolean {
  return useSyncExternalStore(
    subscribePlayerPlaying,
    getPlayerPlaying,
    () => false,
  );
}
