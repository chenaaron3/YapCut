import type { PlayerRef } from "@remotion/player";

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

export function togglePlayback() {
  if (!player) return;
  if (player.isPlaying()) {
    if (player.isMuted()) {
      player.unmute();
      return;
    }
    player.pause();
    return;
  }
  ensurePlayerAudible(player);
  player.play();
}
