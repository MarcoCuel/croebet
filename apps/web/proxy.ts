import { NextResponse, type NextRequest } from "next/server";

// O servidor de produção escuta somente em loopback. A Cloudflare informa o
// protocolo do visitante; a conexão HTTP local do túnel não define esse protocolo.
export function proxy(request: NextRequest) {
  if (process.env.ENFORCE_HTTPS !== "true") return NextResponse.next();
  const localHealth = ["/api/v1/health", "/api/v1/health/ready"].includes(request.nextUrl.pathname)
    && /^(127\.0\.0\.1|localhost)(:\d+)?$/.test(request.headers.get("host") ?? "")
    && !request.headers.has("cf-connecting-ip");
  if (localHealth) return NextResponse.next();
  if (request.headers.get("x-forwarded-proto") === "https") return NextResponse.next();
  const origin = process.env.WEB_ORIGIN;
  if (!origin || new URL(origin).protocol !== "https:") return new NextResponse("Origem de produção indisponível.", { status: 503 });
  return NextResponse.redirect(new URL(request.nextUrl.pathname + request.nextUrl.search, origin), 308);
}
