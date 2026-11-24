import { readFile } from "node:fs/promises";
import { lookup } from "node:dns/promises";
import { get } from "node:https";
import { BlockList } from "node:net";
import path from "node:path";
import { ImageResponse } from "next/og";
import sharp from "sharp";
import { getPublicGames } from "@/features/games/server-games";
import { getSeo } from "@/features/seo/metadata";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const blockedNetworks = new BlockList();
for (const [address, prefix] of [["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15], ["224.0.0.0", 4], ["240.0.0.0", 4]] as const) blockedNetworks.addSubnet(address, prefix);

async function remoteImage(src: string): Promise<Buffer> {
  const url = new URL(src);
  if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443")) throw new Error("URL inválida");
  const addresses = await lookup(url.hostname, { all: true, family: 4 });
  if (!addresses.length || addresses.some(({ address }) => blockedNetworks.check(address))) throw new Error("Endereço indisponível");
  return new Promise((resolve, reject) => {
    const request = get(url, { lookup: (_host, _options, callback) => callback(null, addresses[0].address, 4), timeout: 5000 }, response => {
      if (response.statusCode !== 200) { response.resume(); reject(new Error("Imagem indisponível")); return; }
      const chunks: Buffer[] = [];
      let size = 0;
      response.on("data", (chunk: Buffer) => { size += chunk.length; if (size > 10_000_000) response.destroy(new Error("Imagem muito grande")); else chunks.push(chunk); });
      response.on("end", () => resolve(Buffer.concat(chunks)));
      response.on("error", reject);
    });
    request.on("timeout", () => request.destroy(new Error("Tempo esgotado")));
    request.on("error", reject);
  });
}

async function coverSource(imageUrl: string | null): Promise<string | null> {
  if (!imageUrl) return null;

  try {
    let bytes: Buffer;
    if (!imageUrl.startsWith("/")) {
      bytes = await remoteImage(imageUrl);
    } else if (imageUrl.startsWith("/api/v1/media/")) {
      const url = new URL(imageUrl, process.env.API_INTERNAL_URL ?? "http://127.0.0.1:3001");
      const response = await fetch(url, { cache: "no-store", redirect: "error", signal: AbortSignal.timeout(5000) });
      if (!response.ok) return null;
      bytes = Buffer.from(await response.arrayBuffer());
    } else {
      const publicRoot = path.resolve(process.cwd(), "public");
      const file = path.resolve(publicRoot, `.${decodeURIComponent(imageUrl.split("?")[0])}`);
      if (!file.startsWith(`${publicRoot}${path.sep}`)) return null;
      bytes = await readFile(file);
    }
    const png = await sharp(bytes, { limitInputPixels: 25_000_000 }).resize(510, 510, { fit: "cover" }).png().toBuffer();
    return `data:image/png;base64,${png.toString("base64")}`;
  } catch {
    return null;
  }
}

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [data, settings] = await Promise.all([getPublicGames(slug), getSeo()]);
  if (!data) return new Response("Serviço indisponível", { status: 503 });
  const game = data.items[0];
  if (!game) return new Response("Jogo não encontrado", { status: 404 });
  const cover = await coverSource(game.imageUrl);

  return new ImageResponse(
    <div style={{ display: "flex", width: "100%", height: "100%", background: "#fff", padding: 60, alignItems: "center", justifyContent: "space-between", fontFamily: "sans-serif" }}>
      <div style={{ display: "flex", flexDirection: "column", width: 510, paddingRight: 40, gap: 24 }}>
        <div style={{ color: "#AD158F", fontSize: 30, fontWeight: 700 }}>{settings.siteName}</div>
        <div style={{ display: "flex", color: "#101010", fontSize: game.name.length > 28 ? 50 : 68, lineHeight: 1.08, fontWeight: 700, overflowWrap: "anywhere" }}>Jogar {game.name}</div>
      </div>
      <div style={{ display: "flex", width: 510, height: 510, flexShrink: 0, overflow: "hidden", borderRadius: 40, background: "#f2f2f2", alignItems: "center", justifyContent: "center" }}>
        {/* ImageResponse renders an image, not a browser page; next/image cannot be used here. */}
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover} alt="" width={510} height={510} style={{ objectFit: "cover" }} />
        ) : <div style={{ display: "flex", color: "#AD158F", fontSize: 120, fontWeight: 700 }}>{game.name.charAt(0).toUpperCase()}</div>}
      </div>
    </div>,
    { width: 1200, height: 630, headers: { "Cache-Control": "no-store" } },
  );
}
