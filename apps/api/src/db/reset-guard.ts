export function assertResetAllowed(env: NodeJS.ProcessEnv, marker: unknown, databaseName: string, connectionString: string) {
  if (!["development", "test"].includes(env.APP_ENV ?? "") || env.NODE_ENV === "production") throw new Error("Reset permitido somente em development/test.");
  if (marker !== env.APP_ENV) throw new Error("Identificação do ambiente no banco ausente ou incompatível.");
  if (!env.DB_RESET_ALLOWED_URL || env.DB_RESET_ALLOWED_URL !== connectionString) throw new Error("Destino não autorizado para reset.");
  if (!databaseName || env.DB_RESET_CONFIRM !== databaseName) throw new Error("Confirme o nome exato do banco em DB_RESET_CONFIRM.");
}

