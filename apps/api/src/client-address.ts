import { isIP } from "node:net";

export function clientAddress(remote: string, cloudflare: string | string[] | undefined, trusted: boolean) {
  const loopback = remote === "127.0.0.1" || remote === "::1" || remote === "::ffff:127.0.0.1";
  return trusted && loopback && typeof cloudflare === "string" && isIP(cloudflare) ? cloudflare : remote;
}
