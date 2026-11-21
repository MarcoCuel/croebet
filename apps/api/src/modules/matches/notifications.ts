import { z } from "zod";

// Internal wake-up signals carry identifiers only; persisted state authorizes emission.
export const matchNotificationSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("room"), code: z.string(), directory: z.boolean(), matches: z.boolean() }).strict(),
  z.object({ kind: z.literal("account"), userId: z.string() }).strict(),
  z.object({ kind: z.literal("invitation"), userId: z.string(), code: z.string() }).strict(),
  z.object({ kind: z.literal("presence"), code: z.string() }).strict(),
  z.object({ kind: z.literal("auth"), userId: z.string() }).strict(),
  z.object({ kind: z.literal("catalog") }).strict(),
]);
export type Refresh = { room?: boolean; directory?: boolean; matches?: boolean; invitations?: boolean; presence?: boolean; auth?: boolean; personal?: boolean };
export function notificationRefresh(event: z.infer<typeof matchNotificationSchema>, connection: { actor: string | null; code?: string; watching: boolean; directoryWatching: boolean; personalCodes?: ReadonlySet<string> }): Refresh {
  const directory = connection.directoryWatching;
  switch (event.kind) {
    case "room": return { room: connection.watching && connection.code === event.code, directory: directory && event.directory, matches: directory && event.matches, personal: !!connection.actor && !!connection.personalCodes?.has(event.code) };
    case "presence": return { room: connection.watching && connection.code === event.code, directory };
    case "account": return connection.actor === event.userId ? { directory, presence: true, personal: true } : {};
    case "invitation": return { room: connection.watching && connection.code === event.code, directory, invitations: connection.actor === event.userId };
    case "auth": return connection.actor === event.userId ? { auth: true } : {};
    case "catalog": return { directory, matches: directory, invitations: !!connection.actor, personal: !!connection.actor };
  }
}
