// A local copy of Scout's data, in the current schema, for building and checking a change before the shared
// database is migrated. Reads the database in .env.local (read-only) and writes .local-db/scout.tar.gz.
// npx tsx scripts/local-db.ts   then   SCOUT_PGLITE=.local-db/scout.tar.gz npx next dev -p 4601
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
import { mkdirSync, writeFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";
import { drizzle as neonDrizzle } from "drizzle-orm/neon-http";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { getTableName, is, sql } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";
import * as schema from "../src/db/schema";

const OUT = process.argv[2] || ".local-db/scout.tar.gz";
const src = neonDrizzle(neon(process.env.DATABASE_URL!), { schema });
const pg = new PGlite();
const dst = drizzle(pg, { schema });
await migrate(dst, { migrationsFolder: "./drizzle" });

for (const t of Object.values(schema)) {
  if (!is(t, PgTable)) continue;
  const name = getTableName(t);
  // only the columns the live database has: a new column keeps its default in the copy
  const info = (await neon(process.env.DATABASE_URL!).query(`select column_name, data_type from information_schema.columns where table_name = $1`, [name])) as { column_name: string; data_type: string }[];
  const cols = info.map((c) => c.column_name);
  const json = new Set(info.filter((c) => c.data_type === "jsonb" || c.data_type === "json").map((c) => c.column_name));
  if (!cols.length) continue;
  const list = cols.map((c) => `"${c}"`).join(", ");
  const rows = (await neon(process.env.DATABASE_URL!).query(`select ${list} from "${name}"`)) as Record<string, unknown>[];
  for (let i = 0; i < rows.length; i += 200) {
    const chunk = rows.slice(i, i + 200);
    const vals: unknown[] = [];
    const tuples = chunk.map((r) => `(${cols.map((c) => (vals.push(json.has(c) ? JSON.stringify(r[c]) : r[c]), `$${vals.length}`)).join(", ")})`);
    await pg.query(`insert into "${name}" (${list}) values ${tuples.join(", ")} on conflict do nothing`, vals);
  }
  if (cols.includes("id")) await dst.execute(sql.raw(`select setval(pg_get_serial_sequence('"${name}"', 'id'), coalesce((select max(id) from "${name}"), 1))`));
  console.log(`${name}: ${rows.length}`);
}
void src;
mkdirSync(OUT.replace(/\/[^/]+$/, ""), { recursive: true });
writeFileSync(OUT, Buffer.from(await (await pg.dumpDataDir("gzip")).arrayBuffer()));
console.log(`wrote ${OUT}`);
process.exit(0);
