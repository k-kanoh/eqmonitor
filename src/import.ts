import { glob, readFile } from "fs/promises";
import { join } from "path";
import { program } from "commander";
import * as db from "./db.js";
import { type EventData } from "./types.js";

program
  .name("import")
  .argument("<dir>")
  .action(async (dir: string) => {
    for await (const json of glob("**/*.json", { cwd: dir })) {
      const content = await readFile(join(dir, json), "utf-8");
      const data = JSON.parse(content) as EventData;
      await db.insert(data);
    }
  })
  .parse();
