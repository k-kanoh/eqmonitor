import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { events } from "./schema.js";
import { type EventData } from "./types.js";

const db = drizzle(process.env.DATABASE_URL!);

export async function insert(jsonData: EventData): Promise<void> {
  const id = jsonData._id;
  const code = jsonData.code;
  const time = new Date(jsonData.time);

  await db
    .insert(events)
    .values({
      id,
      code,
      time,
      jsondata: jsonData,
    })
    .onConflictDoNothing();
}
