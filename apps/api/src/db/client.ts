import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema.ts";
export function createDatabase(connectionString: string) {
  const pool = new pg.Pool({ connectionString, max: 5, connectionTimeoutMillis: 3000, statement_timeout: 5000 });
  const db = drizzle({ client: pool, schema });
  return { pool, db };
}

