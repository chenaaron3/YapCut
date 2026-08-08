/** Output composition size (9:16). */
export const COMPOSITION_WIDTH = 1080;
export const COMPOSITION_HEIGHT = 1920;
export const COMPOSITION_FPS = 30;

/** Remotion composition id (Player + Lambda). */
export const COMPOSITION_ID = "TalkingHead";

export const SAFE_AREA = {
  top: "12%",
  bottom: "22%",
  left: "18%",
  right: "18%",
} as const;

export const CAPTION_LAST_WORD_PAD_SEC = 0.3;
export const CAPTION_GROUP_GAP_SEC = 0.05;
