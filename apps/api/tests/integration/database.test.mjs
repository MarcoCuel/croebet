import { test } from "node:test";
import assert from "node:assert/strict";
import { createDatabase } from "../../dist/db/client.js";
// Apenas consultas/transação revertida: não cria nem reseta o destino informado.
test("PostgreSQL real: ambiente de teste, Drizzle e rollback", async t => {
  if (!process.env.TEST_DATABASE_URL) throw new Error("Defina TEST_DATABASE_URL para um banco de teste migrado e com seed APP_ENV=test.");
  const { pool, db } = createDatabase(process.env.TEST_DATABASE_URL); t.after(() => pool.end());
  const marker = await pool.query("select environment from application_environment where id = 1");
  assert.equal(marker.rows[0]?.environment, "test");
  const { sql } = await import("drizzle-orm");
  await assert.rejects(db.transaction(async tx => {
    await tx.execute(sql`update application_environment set environment = 'development' where id = 1`);
    throw new Error("rollback intencional");
  }), /rollback intencional/);
  const after = await pool.query("select environment from application_environment where id = 1");
  assert.equal(after.rows[0]?.environment, "test");
});
