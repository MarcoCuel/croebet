import { sessionSchema } from "@croebet/shared";
export async function authRequest(path: string, method = "GET", body?: unknown) {
  const headers: Record<string, string> = {};
  if (method !== "GET") {
    const csrf = await fetch("/api/v1/auth/csrf", { credentials: "same-origin", cache: "no-store" });
    if (!csrf.ok) throw new Error("Não foi possível conectar à autenticação.");
    const data = await csrf.json();
    headers["x-csrf-token"] = data.token;
    if (body !== undefined) headers["Content-Type"] = "application/json";
  }
  const response = await fetch(`/api/v1${path}`, { method, headers, credentials: "same-origin", cache: "no-store", body: body === undefined ? undefined : JSON.stringify(body) });
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.error?.message ?? "Serviço indisponível. Tente novamente.");
  }
  if (response.status === 204) return null;
  return sessionSchema.parse(await response.json()).user;
}
