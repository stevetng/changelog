import { readFileSync } from "node:fs";
import { getDb, closeDb } from "./client.ts";

const schemaPath = new URL("./schema.sql", import.meta.url).pathname;

export function migrate(dbPath?: string): void {
  const db = getDb(dbPath);
  const schema = readFileSync(schemaPath, "utf-8");
  db.exec(schema);
  console.log("[migrate] Schema applied successfully.");
}

// Run directly via `tsx src/db/migrate.ts`
if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    migrate();
    console.log("[migrate] Done.");
  } finally {
    closeDb();
  }
}
