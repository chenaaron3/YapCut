import { relations, sql } from "drizzle-orm";
import { index, pgTableCreator, primaryKey } from "drizzle-orm/pg-core";
import type { AdapterAccount } from "next-auth/adapters";

import type { ProjectConfig } from "~/domain/project-config";
import type { ProjectStatus } from "~/domain/project-status";
import type { TranscriptStatus, TranscriptWord } from "~/domain/transcript";

/**
 * Multi-project schema prefix for shared databases.
 *
 * @see https://orm.drizzle.team/docs/goodies#multi-project-schema
 */
export const createTable = pgTableCreator((name) => `talking-head-2_${name}`);

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

export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  projects: many(projects),
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
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: d.varchar({ length: 512 }),
    status: d
      .varchar({ length: 32 })
      .$type<ProjectStatus>()
      .notNull()
      .default("processing"),
    failureReason: d.text(),
    config: d
      .jsonb()
      .$type<ProjectConfig | Record<string, never>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    configUpdatedAt: d.timestamp({ withTimezone: true }),
    exportS3Key: d.varchar({ length: 1024 }),
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
}));

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
    originalFilename: d.varchar({ length: 512 }),
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
