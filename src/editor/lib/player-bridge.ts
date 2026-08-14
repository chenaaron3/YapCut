import type { PlayerRef } from "@remotion/player";
import type { SyntheticEvent } from "react";

let player: PlayerRef | null = null;

export function setPlayer(ref: PlayerRef | null) {
  player = ref;
}

export function getPlayer(): PlayerRef | null {
  return player;
}

/** Remotion sticky-mutes after a failed AudioContext.resume(); we have no mute UI. */
export function ensurePlayerAudible(target: PlayerRef | null = player) {
  if (target?.isMuted()) target.unmute();
}

export function play(e?: SyntheticEvent | Event) {
  if (!player) return;
  ensurePlayerAudible(player);
  if (!player.isPlaying()) player.play(e as SyntheticEvent | undefined);
}

export function togglePlayback(e?: SyntheticEvent | Event) {
  if (!player) return;
  if (player.isPlaying()) {
    player.pause();
    return;
  }
  play(e);
}
