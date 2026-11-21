import { z } from "zod";
import { gameIdSchema, gameOptionsSchema, gameActionSchema, gameViewSchema, gameEventActionSchema, gameDefinitions, legacyGameIdentity } from "./game-registry.js";

const integer = z.number().int().safe();
const seat = integer.min(0).max(11);
// Bots remain available to engine tests, never to public room creation.
export const createMatchSchema = z.object({ requestId: z.uuid(), game: gameIdSchema, capacity: integer.min(2).max(12), options: gameOptionsSchema, entryAmount: integer.min(0).default(0), development:z.boolean().default(false), bots:integer.min(0).max(12).default(0), onlyBots:z.boolean().default(false) }).strict().superRefine((input,ctx)=>{
  const definition=gameDefinitions[input.game];
  const options=definition.options.safeParse(input.options);
  if(!options.success){ctx.addIssue({code:"custom",path:["options"],message:"Configuração inválida para este jogo."});return;}
  if(input.capacity>definition.maxPlayers(options.data))ctx.addIssue({code:"custom",path:["capacity"],message:"Quantidade inválida para este modo."});
});
export const lobbyCommandSchema = z.object({ commandId: z.uuid() }).strict();
export const updateLobbySchema = z.object({ commandId: z.uuid(), expectedVersion: integer.positive(), capacity: integer.min(2).max(12), options: gameOptionsSchema, entryAmount: integer.min(0).default(0) }).strict();
export type UpdateLobby = z.infer<typeof updateLobbySchema>;
export const confirmEntrySchema = z.object({ commandId: z.uuid(), expectedVersion: integer.positive(), entryAmount: integer.positive() }).strict();
export type ConfirmEntry = z.infer<typeof confirmEntrySchema>;
export const matchPayoutSchema = z.object({ seat, amount: integer.min(0), house: z.boolean() }).strict();
export const matchEconomyFields = { entryAmount: integer.min(0).default(0), potTotal: integer.min(0).default(0), payouts: z.array(matchPayoutSchema).max(12).default([]), settlement: z.enum(["pending", "paid", "refunded"]).nullable().default(null) };
export const kickMatchSchema = z.object({ commandId: z.uuid(), expectedVersion: integer.positive(), targetUserId: z.uuid() }).strict();
export type KickMatch = z.infer<typeof kickMatchSchema>;
export const matchAbandonSchema = z.object({ commandId: z.uuid(), expectedVersion: integer.positive() }).strict();
export const matchCodeSchema = z.string().regex(/^[A-F0-9]{12}$/);
export const matchParticipantSchema = z.object({ userId: z.uuid(), username: z.string(), displayName: z.string(), avatarUrl: z.string().nullable(), seat: integer.min(0).max(11) }).strict();
export const cancellationProposalSchema=z.object({id:z.uuid(),proposedBy:z.uuid(),eligibleUserIds:z.array(z.uuid()).min(1).max(12),acceptedUserIds:z.array(z.uuid()).min(1).max(12),createdAt:z.iso.datetime()}).strict();
export const cancellationVoteSchema=matchAbandonSchema.extend({proposalId:z.uuid(),accept:z.boolean()}).strict();
export const matchRoomFields = { cancellation:cancellationProposalSchema.nullable().optional(), development:z.boolean().default(false), bots:integer.min(0).max(12).default(0), onlyBots:z.boolean().default(false), ...matchEconomyFields, id: z.uuid(), code: matchCodeSchema, game: gameIdSchema, rulesVersion: integer.positive(), version: integer.positive(), capacity: integer.min(2).max(12), options: gameOptionsSchema, hostId: z.uuid(), participants: z.array(matchParticipantSchema).max(12) };
export const lobbySchema = z.object({ ...matchRoomFields, status: z.literal("lobby"), state: z.null(), lobbyExpiresAt:z.iso.datetime().nullable().optional(), pendingInvitations: z.array(z.object({userId:z.uuid(),username:z.string(),displayName:z.string().optional(),avatarUrl:z.string().nullable()}).strict()).default([]), onlineUserIds:z.array(z.uuid()).default([]), confirmedUserIds:z.array(z.uuid()).default([]) }).strict();
export type LobbyList = z.infer<typeof lobbyListSchema>;
export const gameMatchSchema=z.object({...matchRoomFields,status:z.enum(["playing","finished","abandoned"]),state:gameViewSchema,durationSeconds:integer.min(0).nullable().default(null)}).strict().superRefine((room,ctx)=>{
  const definition=gameDefinitions[room.game];
  if(!definition.options.safeParse(room.options).success)ctx.addIssue({code:"custom",path:["options"],message:"Configuração inválida para este jogo."});
  if(!definition.view.safeParse(room.state).success)ctx.addIssue({code:"custom",path:["state"],message:"Estado inválido para este jogo."});
});
export const matchSummarySchema = z.object({ ...matchRoomFields, status: z.literal("playing"), round: integer.positive(), controllerIds: z.array(z.uuid()).max(12) }).strict();
export const lobbyListSchema = z.object({ ownedLobbies:z.array(lobbySchema).optional(), testMatches:z.array(matchSummarySchema).optional(), testLobbies:z.array(lobbySchema).optional(), tests:z.array(z.object({hostId:z.uuid().optional(),code:matchCodeSchema,game:gameIdSchema,status:z.enum(["lobby","playing"])})).optional(), items: z.array(lobbySchema).max(100), joined: z.array(lobbySchema), owned: lobbySchema.nullable(), active: gameMatchSchema.nullable() }).strict();
export type MatchSummary = z.infer<typeof matchSummarySchema>;
export const matchListSchema = z.object({ items: z.array(matchSummarySchema).max(100) }).strict();
export type CreateMatch = z.infer<typeof createMatchSchema>;


export type Lobby = z.infer<typeof lobbySchema>;
export type MatchParticipant = z.infer<typeof matchParticipantSchema>;

// Lobby invitations expose only public account data and a short presence lease.
export const invitePlayerSchema = z.object({ targetUserId: z.uuid() }).strict();
export const lobbyPlayersQuerySchema = z.object({ q: z.string().trim().max(80).default("") }).strict();
export const lobbyPlayersSchema = z.object({ items: z.array(z.object({
  userId: z.uuid(), username: z.string(), avatarUrl: z.string().nullable(), online: z.boolean(), invited: z.boolean(),
}).strict()), hasMore: z.boolean() }).strict();
export const lobbyInvitationsSchema = z.object({ items: z.array(z.object({
  code: matchCodeSchema, username: z.string(), avatarUrl: z.string().nullable(), game:gameIdSchema.default(legacyGameIdentity.id), gameName:z.string().default(legacyGameIdentity.name), development:z.boolean().default(false),
}).strict()) }).strict();
export type LobbyPlayers = z.infer<typeof lobbyPlayersSchema>;
export type LobbyInvitations = z.infer<typeof lobbyInvitationsSchema>;

export const gameRoomSchema=z.union([lobbySchema,gameMatchSchema]);
export const gameFrameSchema=z.object({version:integer.positive(),action:gameEventActionSchema,state:gameViewSchema}).strict();
export const gameRoomSyncSchema=z.object({room:gameRoomSchema,frames:z.array(gameFrameSchema),reset:z.boolean()});
export const gameCommandSchema=z.object({commandId:z.uuid(),expectedVersion:integer.positive(),action:gameActionSchema}).strict();

// Private to the authenticated account; contains navigation data only.
export const personalMatchesSchema = z.object({ items: z.array(z.object({
  code: matchCodeSchema, game: gameIdSchema, gameName: z.string(),
  status: z.enum(["lobby", "playing"]), development: z.boolean(),
  lobbyExpiresAt:z.iso.datetime().nullable().optional(),
  yourTurn: z.boolean(), turnKey: z.string().nullable(),
  participants: z.array(matchParticipantSchema.extend({ userId:z.uuid().nullable(), bot:z.boolean().optional() })).max(12).default([]),
}).strict()) }).strict();
export type PersonalMatches = z.infer<typeof personalMatchesSchema>;

export const gameExecutionResultSchema=z.object({match:gameMatchSchema,before:gameViewSchema,frames:z.array(gameFrameSchema)}).strict();
export const gameMatchResultSchema=z.union([gameExecutionResultSchema,z.object({ok:z.literal(true)}).strict()]);
export type GameRoom=z.infer<typeof gameRoomSchema>;
export type GameRoomSync=z.infer<typeof gameRoomSyncSchema>;
export type GameCommand=z.infer<typeof gameCommandSchema>;

export const lobbyActionResultSchema = z.union([gameRoomSchema,z.object({code:matchCodeSchema,status:z.literal("started")}).strict(), z.object({code:matchCodeSchema,status:z.literal("closed")}).strict()]);
