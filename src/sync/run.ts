import { loadConfig } from "../config.ts";
import { migrate } from "../db/migrate.ts";
import { closeDb } from "../db/client.ts";
import { syncAll } from "./engine.ts";

async function main() {
  const config = await loadConfig();
  migrate();
  const results = await syncAll(config);

  console.log("\n--- Sync Summary ---");
  for (const r of results) {
    const status = r.errors.length > 0 ? "with errors" : "ok";
    console.log(`  ${r.adapter}: +${r.added} ~${r.updated} (${status})`);
    for (const err of r.errors) {
      console.log(`    ! ${err}`);
    }
  }

  closeDb();
}

main().catch((err) => {
  console.error("Sync failed:", err);
  closeDb();
  process.exit(1);
});
