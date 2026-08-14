/** Contour sticker metrics (em, relative to caption font-size). */
export const CONTOUR_PAD_X_EM = 0.85;
export const CONTOUR_PAD_Y_EM = 0.42;
/**
 * Layout-only vertical reserve (not {@link CONTOUR_PAD_Y_EM}).
 * Inline wrap pad is `border-box` on a line-height 1.05 box, so only part of
 * it overflows; 0.25em was tuned so stacked wrap stickers sit flush.
 */
export const CONTOUR_LAYOUT_PAD_Y_EM = 0.25;
export const CONTOUR_RADIUS_EM = 0.55;
export const CONTOUR_LINE_HEIGHT = 1.05;

/** SVG goo blur stdDeviation (merges adjacent line fragments). */
export const CONTOUR_GOO_STD_DEV = 8;

/**
 * Layout px reserved beyond the glyph line box so goo is in the AABB.
 * Inline vertical padding is added separately (it does not grow line-height).
 */
export const CONTOUR_GOO_LAYOUT_PX = CONTOUR_GOO_STD_DEV;
