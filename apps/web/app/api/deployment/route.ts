export const dynamic = "force-dynamic";

export async function GET() {
  const headers = { "Cache-Control": "no-store, max-age=0" };
  try {
    const response = await fetch(`${process.env.API_INTERNAL_URL ?? "http://127.0.0.1:3001"}/api/v1/health/ready`, {
      cache: "no-store", signal: AbortSignal.timeout(2000),
    });
    if (!response.ok) throw Error("API unavailable");
    return Response.json({ release: process.env.NEXT_PUBLIC_RELEASE_ID ?? "development" }, { headers });
  } catch {
    return Response.json({ error: "Atualização em andamento." }, { status: 503, headers });
  }
}
