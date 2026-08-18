import { relations, sql } from "drizzle-orm";
import {
  index,
  pgEnum,
  pgTableCreator,
  primaryKey,
  unique,
} from "drizzle-orm/pg-core";

import type { CreateProgressEvent } from "~/domain/create-progress";
import type { ProjectConfig } from "~/domain/project-config";
import type { ProjectStatus } from "~/domain/project-status";
import type { PlatformPublishStatus } from "~/domain/schedule";
import type { TranscriptStatus, TranscriptWord } from "~/domain/transcript";
import type { AdapterAccount } from "next-auth/adapters";

/**
 * Multi-project schema prefix for shared databases.
 *
 * @see https://orm.drizzle.team/docs/goodies#multi-project-schema
 */
export const createTable = pgTableCreator((name) => `talking-head-2_${name}`);

/** Shared by ScheduleSettings.platforms[] and PlatformPublish.platform. */
export const platformIdEnum = pgEnum("talking_head_2_platform_id", [
  "youtube",
  "instagram",
  "tiktok",
]);

export const users = createTable("user", (d) => ({
  id: d
    .varchar({ length: 255 })
    .notNull()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: d.varchar({ length: 255 }),
  email: d.varchar({ length: 255 }).notNull(),
  emailVerified: d
    .timestamp({
      mode: "date",
      withTimezone: true,
    })
    .$defaultFn(() => /* @__PURE__ */ new Date()),
  image: d.varchar({ length: 255 }),
}));

export const usersRelations = relations(users, ({ many, one }) => ({
  accounts: many(accounts),
  projects: many(projects),
  scheduleSettings: one(scheduleSettings),
  scheduleEntries: many(scheduleEntries),
}));

export const accounts = createTable(
  "account",
  (d) => ({
    userId: d
      .varchar({ length: 255 })
      .notNull()
      .references(() => users.id),
    type: d.varchar({ length: 255 }).$type<AdapterAccount["type"]>().notNull(),
    provider: d.varchar({ length: 255 }).notNull(),
    providerAccountId: d.varchar({ length: 255 }).notNull(),
    refresh_token: d.text(),
    access_token: d.text(),
    expires_at: d.integer(),
    token_type: d.varchar({ length: 255 }),
    scope: d.varchar({ length: 255 }),
    id_token: d.text(),
    session_state: d.varchar({ length: 255 }),
  }),
  (t) => [
    primaryKey({ columns: [t.provider, t.providerAccountId] }),
    index("account_user_id_idx").on(t.userId),
  ],
);

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
}));

export const sessions = createTable(
  "session",
  (d) => ({
    sessionToken: d.varchar({ length: 255 }).notNull().primaryKey(),
    userId: d
      .varchar({ length: 255 })
      .notNull()
      .references(() => users.id),
    expires: d.timestamp({ mode: "date", withTimezone: true }).notNull(),
  }),
  (t) => [index("t_user_id_idx").on(t.userId)],
);

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const verificationTokens = createTable(
  "verification_token",
  (d) => ({
    identifier: d.varchar({ length: 255 }).notNull(),
    token: d.varchar({ length: 255 }).notNull(),
    expires: d.timestamp({ mode: "date", withTimezone: true }).notNull(),
  }),
  (t) => [primaryKey({ columns: [t.identifier, t.token] })],
);

export type AssetKind = "video" | "image" | "audio";

export const projects = createTable(
  "project",
  (d) => ({
    id: d
      .varchar({ length: 255 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: d
      .varchar({ length: 255 })
      .references(() => users.id, { onDelete: "cascade" }),
    title: d.varchar({ length: 512 }),
    status: d
      .varchar({ length: 32 })
      .$type<ProjectStatus>()
      .notNull()
      .default("processing"),
    failureReason: d.text(),
    /** Vercel Workflow run id while create is in flight (stream reconnect). */
    workflowRunId: d.varchar({ length: 255 }),
    /** Latest create-pipeline progress (poll fallback + initial UI). */
    createProgress: d.jsonb().$type<CreateProgressEvent | null>(),
    config: d
      .jsonb()
      .$type<ProjectConfig | Record<string, never>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    configUpdatedAt: d.timestamp({ withTimezone: true }),
    /** Object key in the Remotion Lambda bucket (`exportBucketName`). */
    exportS3Key: d.varchar({ length: 1024 }),
    /** Styled Cover still key in the same Remotion bucket as the video export. */
    coverS3Key: d.varchar({ length: 1024 }),
    /** Remotion Lambda render id while `status === "exporting"`. */
    exportRenderId: d.varchar({ length: 128 }),
    /** Remotion Lambda bucket (progress + final MP4 + Cover). Kept after export for Download. */
    exportBucketName: d.varchar({ length: 255 }),
    createdAt: d
      .timestamp({ withTimezone: true })
      .$defaultFn(() => /* @__PURE__ */ new Date())
      .notNull(),
    updatedAt: d
      .timestamp({ withTimezone: true })
      .$defaultFn(() => /* @__PURE__ */ new Date())
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  }),
  (t) => [index("project_user_id_idx").on(t.userId)],
);

export const projectsRelations = relations(projects, ({ one, many }) => ({
  user: one(users, { fields: [projects.userId], references: [users.id] }),
  assets: many(assets),
  scheduleEntry: one(scheduleEntries),
}));

/** Per-user cadence + platform list for schedule. */
export const scheduleSettings = createTable("schedule_settings", (d) => ({
  userId: d
    .varchar({ length: 255 })
    .notNull()
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  /** Daily wall-clock slot HH:MM (in `timezone`). */
  time: d.varchar({ length: 8 }).notNull().default("17:00"),
  timezone: d.varchar({ length: 64 }).notNull().default("America/New_York"),
  platforms: platformIdEnum("platforms")
    .array()
    .notNull()
    .default(
      sql`ARRAY['youtube','instagram','tiktok']::talking_head_2_platform_id[]`,
    ),
  updatedAt: d
    .timestamp({ withTimezone: true })
    .$defaultFn(() => /* @__PURE__ */ new Date())
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
}));

export const scheduleSettingsRelations = relations(
  scheduleSettings,
  ({ one }) => ({
    user: one(users, {
      fields: [scheduleSettings.userId],
      references: [users.id],
    }),
  }),
);

/** One Project slotted for publish (strict 1:1). */
export const scheduleEntries = createTable(
  "schedule_entry",
  (d) => ({
    id: d
      .varchar({ length: 255 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: d
      .varchar({ length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    projectId: d
      .varchar({ length: 255 })
      .notNull()
      .unique()
      .references(() => projects.id, { onDelete: "cascade" }),
    scheduledAt: d.timestamp({ withTimezone: true }).notNull(),
    createdAt: d
      .timestamp({ withTimezone: true })
      .$defaultFn(() => /* @__PURE__ */ new Date())
      .notNull(),
    updatedAt: d
      .timestamp({ withTimezone: true })
      .$defaultFn(() => /* @__PURE__ */ new Date())
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  }),
  (t) => [
    index("schedule_entry_user_id_idx").on(t.userId),
    index("schedule_entry_scheduled_at_idx").on(t.scheduledAt),
  ],
);

export const scheduleEntriesRelations = relations(
  scheduleEntries,
  ({ one, many }) => ({
    user: one(users, {
      fields: [scheduleEntries.userId],
      references: [users.id],
    }),
    project: one(projects, {
      fields: [scheduleEntries.projectId],
      references: [projects.id],
    }),
    platformPublishes: many(platformPublishes),
  }),
);

/** Current publish state per platform on a ScheduleEntry. */
export const platformPublishes = createTable(
  "platform_publish",
  (d) => ({
    id: d
      .varchar({ length: 255 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    scheduleEntryId: d
      .varchar({ length: 255 })
      .notNull()
      .references(() => scheduleEntries.id, { onDelete: "cascade" }),
    platform: platformIdEnum("platform").notNull(),
    status: d
      .varchar({ length: 32 })
      .$type<PlatformPublishStatus>()
      .notNull()
      .default("pending"),
    postUrl: d.varchar({ length: 2048 }),
    lastError: d.text(),
    updatedAt: d
      .timestamp({ withTimezone: true })
      .$defaultFn(() => /* @__PURE__ */ new Date())
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  }),
  (t) => [
    index("platform_publish_entry_idx").on(t.scheduleEntryId),
    unique("platform_publish_entry_platform_uid").on(
      t.scheduleEntryId,
      t.platform,
    ),
  ],
);

export const platformPublishesRelations = relations(
  platformPublishes,
  ({ one }) => ({
    scheduleEntry: one(scheduleEntries, {
      fields: [platformPublishes.scheduleEntryId],
      references: [scheduleEntries.id],
    }),
  }),
);

export const assets = createTable(
  "asset",
  (d) => ({
    id: d
      .varchar({ length: 255 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    projectId: d
      .varchar({ length: 255 })
      .references(() => projects.id, { onDelete: "cascade" }),
    kind: d.varchar({ length: 32 }).$type<AssetKind>().notNull(),
    s3Key: d.varchar({ length: 1024 }).notNull(),
    contentType: d.varchar({ length: 255 }).notNull(),
    durationSec: d.doublePrecision(),
    /** Natural pixel size (b-roll layout / transform overlay). */
    width: d.integer(),
    height: d.integer(),
    originalFilename: d.varchar({ length: 512 }),
    /** Integrated LUFS (EBU R128). Null until measured. */
    lufs: d.doublePrecision(),
    /** True peak dBTP. Null until measured. */
    truePeakDb: d.doublePrecision(),
    /** Peak envelope for A-roll timeline (local asset time). */
    waveformPeaksPerSec: d.doublePrecision(),
    waveformPeaks: d.jsonb().$type<number[]>(),
    sortOrder: d.integer().notNull().default(0),
    createdAt: d
      .timestamp({ withTimezone: true })
      .$defaultFn(() => /* @__PURE__ */ new Date())
      .notNull(),
    updatedAt: d
      .timestamp({ withTimezone: true })
      .$defaultFn(() => /* @__PURE__ */ new Date())
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  }),
  (t) => [
    index("asset_project_id_idx").on(t.projectId),
    index("asset_s3_key_idx").on(t.s3Key),
  ],
);

export const assetsRelations = relations(assets, ({ one }) => ({
  project: one(projects, {
    fields: [assets.projectId],
    references: [projects.id],
  }),
  transcript: one(transcripts),
}));

export const transcripts = createTable(
  "transcript",
  (d) => ({
    id: d
      .varchar({ length: 255 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    assetId: d
      .varchar({ length: 255 })
      .notNull()
      .unique()
      .references(() => assets.id, { onDelete: "cascade" }),
    words: d
      .jsonb()
      .$type<TranscriptWord[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    durationSec: d.doublePrecision(),
    language: d.varchar({ length: 64 }),
    status: d
      .varchar({ length: 32 })
      .$type<TranscriptStatus>()
      .notNull()
      .default("pending"),
    raw: d.jsonb().$type<Record<string, unknown>>(),
    createdAt: d
      .timestamp({ withTimezone: true })
      .$defaultFn(() => /* @__PURE__ */ new Date())
      .notNull(),
    updatedAt: d
      .timestamp({ withTimezone: true })
      .$defaultFn(() => /* @__PURE__ */ new Date())
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  }),
  (t) => [index("transcript_asset_id_idx").on(t.assetId)],
);

export const transcriptsRelations = relations(transcripts, ({ one }) => ({
  asset: one(assets, {
    fields: [transcripts.assetId],
    references: [assets.id],
  }),
}));
