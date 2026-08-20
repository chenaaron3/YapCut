export function isTerminalProgressEvent(event: {
  stage: string;
}): boolean {
  return event.stage === "ready" || event.stage === "failed";
}
