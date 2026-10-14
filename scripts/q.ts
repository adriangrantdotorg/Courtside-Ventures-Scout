import { config } from "dotenv"; config({ path: ".env.local", quiet: true });
import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL!);
const q = process.argv[2];
const r = await sql.query(q);
console.log(process.argv[3] === "--full" ? JSON.stringify(r) : JSON.stringify(r, null, 1).slice(0, 6000));
