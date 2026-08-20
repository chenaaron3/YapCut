import { FatalError } from "workflow";

export function workflowFailureMessage(
  error: unknown,
  fallback: string,
): string {
  if (error instanceof FatalError) return error.message;
  if (error instanceof Error) return error.message;
  return fallback;
}

export function rethrowAsFatal(error: unknown, fallback: string): never {
  const message = workflowFailureMessage(error, fallback);
  if (error instanceof FatalError) throw error;
  throw new FatalError(message);
}

export function rethrowFatalFal(error: unknown): never {
  if (
    error instanceof Error &&
    error.name === "FalMeasureError" &&
    "fatal" in error &&
    error.fatal === true
  ) {
    throw new FatalError(error.message);
  }
  throw error;
}
