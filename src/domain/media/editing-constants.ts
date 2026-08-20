/** Audio kept at word boundaries when collapsing inter-word pauses */
export const WORD_MARGIN_SEC = 0.15;
/** Inter-word pause longer than this is cut during process */
export const PROCESS_GAP_THRESHOLD_SEC = 2 * WORD_MARGIN_SEC;
