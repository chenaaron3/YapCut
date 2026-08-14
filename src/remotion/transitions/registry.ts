import { fadePainter } from "~/remotion/transitions/fade";
import { flashPainter } from "~/remotion/transitions/flash";
import { slidePainter } from "~/remotion/transitions/slide";
import type { TransitionPainter } from "~/remotion/transitions/types";

import type { TransitionClipProp } from "~/remotion/helpers/types";

/**
 * templateId → painter. Add a module + one line here for a new look.
 */
export const TRANSITION_PAINTERS: Record<
  TransitionClipProp["templateId"],
  TransitionPainter
> = {
  flash: flashPainter,
  fade: fadePainter,
  slide: slidePainter,
};
