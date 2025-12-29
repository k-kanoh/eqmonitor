import "dotenv/config";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { program } from "commander";
import { parse, startOfDay, startOfMonth, addDays, addMonths, format } from "date-fns";
import { and, gte, lt } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { events } from "./schema.js";

const db = drizzle(process.env.DATABASE_URL!);

async function exportData(ymds: string[], output: string): Promise<void> {
  const ranges = ymds.map((x) => parseYmd(x));

  for (const range of ranges) {
    const records = await db
      .select()
      .from(events)
      .where(and(gte(events.time, range.start), lt(events.time, range.end)))
      .orderBy(events.time);

    for (const record of records) {
      const saveDir = join(output, "data", format(record.time, "yyyyMMdd"), String(record.code));
      await mkdir(saveDir, { recursive: true });

      const savePath = join(saveDir, `${format(record.time, "yyyyMMddHHmmssSSS")}.json`);

      const content = JSON.stringify(record.jsondata, null, 2);
      await writeFile(savePath, content, "utf-8");
    }
  }
}

function parseYmd(arg: string): { start: Date; end: Date } {
  const [, ymd, ymdOffset] = arg.match(/^(\d{6,8})([+-]\d+)?$/)!;
  const offset = ymdOffset ? parseInt(ymdOffset) : 0;

  switch (ymd.length) {
    case 8: {
      const baseDate = parse(ymd, "yyyyMMdd", new Date());
      const dates = [startOfDay(baseDate), addDays(startOfDay(baseDate), offset)];
      dates.sort((a, b) => a.getTime() - b.getTime());
      return { start: dates[0], end: addDays(dates[1], 1) };
    }
    case 6: {
      const baseDate = parse(ymd, "yyyyMM", new Date());
      const dates = [startOfMonth(baseDate), addMonths(startOfMonth(baseDate), offset)];
      dates.sort((a, b) => a.getTime() - b.getTime());
      return { start: dates[0], end: addMonths(dates[1], 1) };
    }
    default:
      throw new Error();
  }
}

program
  .name("export")
  .argument(
    "<ymds...>",
    "",
    (value: string, previous: string[]) => {
      if (!value.match(/^(\d{6,8})([+-]\d+)?$/)) {
        throw new Error("Invalid arguments.");
      }
      return [...previous, value];
    },
    []
  )
  .option("-o, --output <dir>", "", "")
  .action(async (ymds: string[], options: { output: string }) => {
    await exportData(ymds, options.output);
  })
  .parse();
