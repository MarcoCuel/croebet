"use client";
import { realtimeReplySchema, type RealtimeRequest } from "@croebet/shared";
import { realtimeSocket } from "@/lib/realtime";

export async function realtimeRequest<T>(request: RealtimeRequest, schema: { parse: (value: unknown) => T }): Promise<T> {
  const connection = realtimeSocket();
  if (!connection.connected) throw new Error("Aguarde a reconexão e tente novamente.");
  // Never buffer a decision for a future reconnect: retries keep their commandId.
  let response: unknown;
  try { response = await connection.timeout(10000).emitWithAck("request", request); }
  catch { throw new Error("Não foi possível confirmar a ação. Tente novamente."); }
  const reply = realtimeReplySchema.parse(response);
  if (!reply.ok) throw new Error(reply.error.message);
  return schema.parse(reply.data);
}
