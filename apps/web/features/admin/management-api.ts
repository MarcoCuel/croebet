
export async function managementRequest<T>(path: string, schema: { parse: (value: unknown) => T }, method = "GET", body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  if (method !== "GET") {
    const csrf = await fetch("/api/v1/auth/csrf", { cache: "no-store", credentials: "same-origin" });
    if (!csrf.ok) throw new Error("Não foi possível conectar. Tente novamente.");
    headers["x-csrf-token"] = (await csrf.json()).token;
    headers["Content-Type"] = "application/json";
  }
  const response = await fetch(`/api/v1${path}`, { method, headers, credentials: "same-origin", cache: "no-store", body: body === undefined ? undefined : JSON.stringify(body) });
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.error?.message ?? "Não foi possível concluir a operação.");
  }
  return schema.parse(await response.json());
}
