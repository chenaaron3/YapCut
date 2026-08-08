import type { PlayerRef } from "@remotion/player";

let player: PlayerRef | null = null;
let playAfterSeek = false;

export function setPlayer(ref: PlayerRef | null) {
  player = ref;
}

export function getPlayer(): PlayerRef | null {
  return player;
}

export function togglePlayback() {
  if (!player) return;
  if (player.isPlaying()) player.pause();
  else player.play();
}

export function peekPlayAfterSeek() {
  return playAfterSeek;
}

export function takePlayAfterSeek() {
  const v = playAfterSeek;
  playAfterSeek = false;
  return v;
}

export function requestPlayAfterSeek() {
  playAfterSeek = true;
}
