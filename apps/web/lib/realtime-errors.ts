export type RealtimeFailure = { code: string; message: string };

const permanentCodes = new Set(["UNAUTHENTICATED", "CONNECTION_LIMIT", "RATE_LIMIT", "FORBIDDEN"]);

/** Handshake failures that will not recover by retrying the same session. */
export function permanentRealtimeFailure(value: unknown): RealtimeFailure | null {
  if (!value || typeof value !== "object") return null;
  const envelope = "data" in value && value.data && typeof value.data === "object" ? value.data as Record<string, unknown> : undefined;
  const nested = envelope && "error" in envelope && envelope.error && typeof envelope.error === "object" ? envelope.error as Record<string, unknown> : undefined;
  const source = nested ?? envelope;
  const code = source && typeof source.code === "string" ? source.code : undefined;
  if (!code || !permanentCodes.has(code)) return null;
  const message = source && typeof source.message === "string" ? source.message : "Conexão em tempo real indisponível.";
  return { code, message };
}
