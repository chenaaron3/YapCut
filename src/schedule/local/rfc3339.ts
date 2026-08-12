/** RFC3339 without milliseconds (YouTube publishAt). */
export function toRfc3339(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, "Z");
}
