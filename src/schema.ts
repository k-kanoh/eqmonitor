import { pgTable, text, integer, timestamp, jsonb, index } from "drizzle-orm/pg-core";

export const events = pgTable(
  "events",
  {
    id: text("id").primaryKey(),
    code: integer("code").notNull(),
    time: timestamp("time", { precision: 3, withTimezone: true }).notNull(),
    jsondata: jsonb("jsondata").notNull(),
  },
  (table) => [
    index("events_time_idx").on(table.time),
    index("events_code_time_idx").on(table.code, table.time),
  ]
);
