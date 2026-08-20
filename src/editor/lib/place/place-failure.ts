import type { PlaceEditFailure } from "~/domain/edit/edits";

export function placeFailureMessage(reason: PlaceEditFailure): string {
  switch (reason) {
    case "quote-overlap":
      return "Quotes can't overlap another quote.";
    case "quote-listicle-overlap":
      return "Quotes can't overlap a listicle.";
    case "transition-conflict":
      return "A transition already exists here.";
    case "invalid-range":
      return "Couldn't place that edit.";
  }
}
