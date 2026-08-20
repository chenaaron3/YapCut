import { z } from "zod";

export const PLATFORM_IDS = ["youtube", "instagram", "tiktok"] as const;
export type PlatformId = (typeof PLATFORM_IDS)[number];

export const platformIdSchema = z.enum(PLATFORM_IDS);

export const PLATFORM_PUBLISH_STATUSES = [
  "pending",
  "uploading",
  "succeeded",
  "failed",
] as const;
export type PlatformPublishStatus = (typeof PLATFORM_PUBLISH_STATUSES)[number];

export const platformPublishStatusSchema = z.enum(PLATFORM_PUBLISH_STATUSES);

/** HH:MM 24h wall clock. */
export const scheduleTimeSchema = z
  .string()
  .regex(/^\d{1,2}:\d{2}$/, "Use HH:MM");

export const scheduleSettingsSchema = z.object({
  time: scheduleTimeSchema,
  timezone: z.string().min(1),
  platforms: z.array(platformIdSchema).min(1),
});

export type ScheduleSettingsInput = z.infer<typeof scheduleSettingsSchema>;

export const DEFAULT_SCHEDULE_SETTINGS: ScheduleSettingsInput = {
  time: "17:00",
  timezone: "America/New_York",
  platforms: ["youtube", "instagram", "tiktok"],
};

export function parseTimeOfDay(time: string): { hour: number; minute: number } {
  const [h, m] = time.split(":").map((x) => Number(x));
  if (
    h === undefined ||
    m === undefined ||
    !Number.isInteger(h) ||
    !Number.isInteger(m) ||
    h < 0 ||
    h > 23 ||
    m < 0 ||
    m > 59
  ) {
    throw new Error(`Invalid time of day: ${time}`);
  }
  return { hour: h, minute: m };
}

export function assertValidTimezone(timezone: string): void {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
  } catch {
    throw new Error(`Invalid timezone "${timezone}"`);
  }
}

/** App "Add to schedule" is operator-only for now. */
export const SCHEDULE_OPERATOR_EMAIL = "chenaaron3@gmail.com";

export function canUseSchedule(email: string | null | undefined): boolean {
  return email?.trim().toLowerCase() === SCHEDULE_OPERATOR_EMAIL;
}
