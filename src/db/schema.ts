import {
  pgTable,
  text,
  timestamp,
  uuid,
  integer,
  jsonb,
  index,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  githubId: text("github_id").unique(),
  email: text("email"),
  name: text("name"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const watches = pgTable(
  "watches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    // Guest watches have no user; identified by a session cookie.
    sessionId: text("session_id"),
    // Where to send the change email (Resend). Optional: in-app only if unset.
    email: text("email"),
    url: text("url").notNull(),
    description: text("description").notNull(),
    alertRule: text("alert_rule").notNull().default("any meaningful change"),
    cadence: text("cadence").notNull().default("daily"), // hourly | daily | weekly
    channel: text("channel").notNull().default("email"),
    collectorId: text("collector_id"), // c_* (null until created)
    status: text("status").notNull().default("creating"), // creating | active | healing | error
    lastError: text("last_error"),
    lastRunAt: timestamp("last_run_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index("watches_user_idx").on(table.userId),
    sessionIdx: index("watches_session_idx").on(table.sessionId),
    statusIdx: index("watches_status_idx").on(table.status),
  }),
);

export const runs = pgTable(
  "runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    watchId: uuid("watch_id")
      .notNull()
      .references(() => watches.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("queued"), // queued | running | succeeded | empty | failed
    snapshotId: text("snapshot_id"), // j_* (collection_id)
    rawJson: jsonb("raw_json"),
    error: text("error"),
    startedAt: timestamp("started_at"),
    finishedAt: timestamp("finished_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    watchIdx: index("runs_watch_idx").on(table.watchId),
  }),
);

export const changes = pgTable(
  "changes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    watchId: uuid("watch_id")
      .notNull()
      .references(() => watches.id, { onDelete: "cascade" }),
    runId: uuid("run_id").references(() => runs.id, { onDelete: "set null" }),
    beforeJson: jsonb("before_json"),
    afterJson: jsonb("after_json"),
    summary: text("summary").notNull(),
    classification: text("classification")
      .notNull()
      .default("meaningful_change"),
    notifiedAt: timestamp("notified_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    watchIdx: index("changes_watch_idx").on(table.watchId),
  }),
);

export const jobs = pgTable(
  "jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    type: text("type").notNull(), // create | run | heal
    watchId: uuid("watch_id").references(() => watches.id, { onDelete: "cascade" }),
    payload: jsonb("payload").notNull().default({}),
    status: text("status").notNull().default("queued"), // queued | running | done | failed
    attempts: integer("attempts").notNull().default(0),
    lockedAt: timestamp("locked_at"),
    nextRunAt: timestamp("next_run_at").defaultNow().notNull(),
    error: text("error"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    finishedAt: timestamp("finished_at"),
  },
  (table) => ({
    statusIdx: index("jobs_status_idx").on(table.status),
    nextRunIdx: index("jobs_next_run_idx").on(table.nextRunAt),
  }),
);

export type User = typeof users.$inferSelect;
export type Watch = typeof watches.$inferSelect;
export type Run = typeof runs.$inferSelect;
export type Change = typeof changes.$inferSelect;
export type Job = typeof jobs.$inferSelect;
