import { spawn } from "node:child_process";
import { accessSync, constants, existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseEnv } from "node:util";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const readEnv = (path) => existsSync(path) ? parseEnv(readFileSync(path, "utf8")) : {};
const tunnel = readEnv(resolve(root, ".env.tunnel"));
const children = new Set();
let stopping = false;
let forceStop;

function stop(code) {
  if (stopping) return;
  stopping = true;
  process.exitCode = code;
  for (const child of children) signal(child, "SIGTERM");
  forceStop = setTimeout(() => {
    for (const child of children) signal(child, "SIGKILL");
  }, 5000);
  forceStop.unref();
}

function signal(child, name) {
  try {
    if (process.platform === "win32") child.kill(name);
    else process.kill(-child.pid, name);
  } catch (error) {
    if (error.code !== "ESRCH") throw error;
  }
}

function start(command, args, env = {}) {
  const child = spawn(command, args, {
    cwd: root,
    env: { ...process.env, ...env },
    stdio: "inherit",
    detached: process.platform !== "win32",
  });
  children.add(child);
  child.once("error", (error) => {
    children.delete(child);
    console.error(`[dev] Não foi possível iniciar ${command}: ${error.message}`);
    stop(1);
  });
  child.once("exit", (code) => {
    children.delete(child);
    if (!stopping) stop(code || 1);
    if (children.size === 0) clearTimeout(forceStop);
  });
}

process.on("SIGINT", () => stop(130));
process.on("SIGTERM", () => stop(143));

if (!existsSync(resolve(root, ".env.tunnel"))) {
  start("pnpm", ["--parallel", "--filter", "@croebet/web", "--filter", "@croebet/api", "dev"]);
} else {
  const origin = new URL(tunnel.DEV_TUNNEL_ORIGIN);
  if (origin.protocol !== "https:" || origin.origin !== tunnel.DEV_TUNNEL_ORIGIN || origin.hostname.includes("*")) {
    throw new Error("DEV_TUNNEL_ORIGIN exige uma origem HTTPS exata, sem caminho ou wildcard.");
  }
  if (!tunnel.DEV_TUNNEL_TOKEN_FILE) throw new Error("Defina DEV_TUNNEL_TOKEN_FILE em .env.tunnel.");
  const tokenFile = resolve(root, tunnel.DEV_TUNNEL_TOKEN_FILE);
  accessSync(tokenFile, constants.R_OK);
  if (!readFileSync(tokenFile, "utf8").trim()) throw new Error("O arquivo do token está vazio.");

  for (const [app, envFile] of [["web", ".env.local"], ["api", ".env"]]) {
    const local = readEnv(resolve(root, `apps/${app}/${envFile}`));
    const origins = [process.env.DEV_WEB_ORIGINS ?? local.DEV_WEB_ORIGINS, origin.origin].filter(Boolean).join(",");
    start("pnpm", ["--filter", `@croebet/${app}`, "dev"], {
      DEV_WEB_ORIGINS: origins,
      ...(app === "web" ? { WEB_ORIGIN: origin.origin } : {}),
    });
  }
  start("cloudflared", ["tunnel", "--no-autoupdate", "--protocol", "http2", "run", "--token-file", tokenFile]);
  console.log(`[dev] Endereço configurado: ${origin.origin} (aguardando web, API e conexão do túnel).`);
}
