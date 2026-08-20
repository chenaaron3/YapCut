import type { PlayerRef } from "@remotion/player";
import type { SyntheticEvent } from "react";

let player: PlayerRef | null = null;
const playingListeners = new Set<() => void>();

function notifyPlaying() {
  for (const listener of playingListeners) listener();
}

function bindPlaying(target: PlayerRef | null) {
  if (!target) return;
  target.addEventListener("play", notifyPlaying);
  target.addEventListener("pause", notifyPlaying);
  target.addEventListener("ended", notifyPlaying);
}

function unbindPlaying(target: PlayerRef | null) {
  if (!target) return;
  target.removeEventListener("play", notifyPlaying);
  target.removeEventListener("pause", notifyPlaying);
  target.removeEventListener("ended", notifyPlaying);
}

export function setPlayer(ref: PlayerRef | null) {
  if (player === ref) return;
  unbindPlaying(player);
  player = ref;
  bindPlaying(player);
  notifyPlaying();
}

export function getPlayer(): PlayerRef | null {
  return player;
}

export function subscribePlayerPlaying(onStoreChange: () => void): () => void {
  playingListeners.add(onStoreChange);
  return () => {
    playingListeners.delete(onStoreChange);
  };
}

export function getPlayerPlaying(): boolean {
  return player?.isPlaying() ?? false;
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
