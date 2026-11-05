import { z } from "zod";
import { CHARS } from "../chars/index.js";
import type { MatchState } from "../sim/types.js";

/** Network contracts (spec §11.2). Every message is strict and validated in both directions. */
export const PROTOCOL_VERSION = 1 as const;
export const TICK_RATE = 60 as const;
export const MAX_CLIENTS = 2 as const;
export const FIGHT_ROOM_NAME = "fight" as const;
export const MAX_PACKET_BYTES = 1024 as const;

// Ids mirror spec §6 / §7. Kept here so the protocol does not depend on chars/ or sim/ (other slices own them).
export const CHAR_IDS = ["bolt", "volt", "chompa", "kaze", "bao"] as const;
export const STAGE_IDS = ["rooftop", "bamboo", "volcano"] as const;
export const CharIdSchema = z.enum(CHAR_IDS);
export const StageIdSchema = z.enum(STAGE_IDS);

const frame = z.number().int().min(1).max(0x7fffffff);
const byte = z.number().int().min(0).max(255);
const u32 = z.number().int().min(0).max(0xffffffff);
const slot = z.union([z.literal(0), z.literal(1)]);

// client -> server
export const PickMsgSchema = z.strictObject({ t: z.literal("pick"), char: CharIdSchema });
export const ReadyMsgSchema = z.strictObject({ t: z.literal("ready") });
export const InputMsgSchema = z.strictObject({ t: z.literal("in"), f: frame, b: byte });
export const AckMsgSchema = z.strictObject({ t: z.literal("ack"), f: frame, h: u32 });
export const ResyncMsgSchema = z.strictObject({ t: z.literal("resync") });
export const RematchMsgSchema = z.strictObject({ t: z.literal("rematch") });
/** Host-only (decision 0008): fill the empty slot with a server CPU before the match starts. */
export const BotMsgSchema = z.strictObject({ t: z.literal("bot"), char: CharIdSchema, difficulty: z.enum(["easy", "normal", "hard"]) });
export const ClientMsgSchema = z.discriminatedUnion("t", [
  PickMsgSchema, ReadyMsgSchema, InputMsgSchema, AckMsgSchema, ResyncMsgSchema, RematchMsgSchema, BotMsgSchema,
]);

// server -> client
export const LobbySlotSchema = z.strictObject({
  name: z.string().min(1).max(32),
  char: CharIdSchema.nullable(),
  ready: z.boolean(),
  bot: z.boolean(),
});
export const LobbyMsgSchema = z.strictObject({ t: z.literal("lobby"), slots: z.array(LobbySlotSchema).max(MAX_CLIENTS) });
export const StartMsgSchema = z.strictObject({
  t: z.literal("start"),
  seed: z.number().int().min(1).max(0xffffffff),
  chars: z.tuple([CharIdSchema, CharIdSchema]),
  stage: StageIdSchema,
  you: slot,
  startAtMs: z.number().int().nonnegative(),
  delay: z.number().int().min(0).max(10),
});
export const ConfirmedMsgSchema = z.strictObject({
  t: z.literal("cf"), f: frame, b: z.array(z.tuple([byte, byte])).min(1).max(600),
});
export const HashMsgSchema = z.strictObject({ t: z.literal("hash"), f: frame, h: u32 });
const integer = z.number().int().safe();
const nonnegative = integer.nonnegative();
const FighterSchema = z.strictObject({
  char: CharIdSchema, x: integer, y: integer, vx: integer, vy: integer,
  facing: z.union([z.literal(1), z.literal(-1)]), hp: integer, meter: nonnegative,
  state: z.enum(["idle", "walkF", "walkB", "crouch", "jumpSquat", "air", "land", "dashF", "dashB", "attack", "hitstun", "blockstun", "juggle", "knockdown", "getup", "thrown", "throwing", "techSep", "ko", "win"]),
  stateFrame: nonnegative, move: z.string().nullable(), moveFrame: nonnegative, moveHitMask: integer,
  stun: nonnegative, hitstop: nonnegative, pushRemain: integer, pushPerFrame: integer,
  crouching: z.boolean(), airborne: z.boolean(), invuln: z.enum(["none", "full", "strike", "projectile"]), invulnFrames: nonnegative,
  comboHits: nonnegative, history: z.array(byte).length(40), historyHead: nonnegative.max(39), buffered: nonnegative,
  chargeBack: nonnegative, chargeGrace: nonnegative, lastPressFrame: integer, cancelOk: z.boolean(), counterArmed: z.boolean(),
  airJumps: nonnegative, gravityScale: nonnegative, wins: nonnegative,
  lockLeft: nonnegative, lockTimer: nonnegative, rehit: nonnegative, spCount: nonnegative, superScale: nonnegative,
  platform: integer.min(-1), dropTimer: nonnegative,
});
export const MatchStateSchema: z.ZodType<MatchState> = z.strictObject({
  frame: nonnegative, rng: u32, phase: z.enum(["intro", "fight", "roundEnd", "matchEnd"]), phaseFrame: nonnegative,
  round: nonnegative, timer: nonnegative, superFreeze: nonnegative, superBy: slot.nullable(),
  fighters: z.tuple([FighterSchema, FighterSchema]),
  projectiles: z.array(z.strictObject({ owner: slot, kind: z.string(), x: integer, y: integer, vx: integer, vy: integer,
    gravity: integer, w: nonnegative, h: nonnegative, hits: nonnegative, hitInterval: nonnegative, cooldown: integer,
    life: integer, def: z.string(), exploding: nonnegative })),
  events: z.array(z.strictObject({ frame: nonnegative, kind: z.enum(["hit", "block", "counter", "throw", "super", "ko", "parry", "projectileClash", "whiff", "land", "special"]),
    x: integer, y: integer, strength: z.union([z.literal(0), z.literal(1), z.literal(2)]), by: slot })),
  stage: StageIdSchema, winner: slot.nullable(), drawRounds: nonnegative,
});
export const SnapMsgSchema = z.strictObject({ t: z.literal("snap"), f: nonnegative, state: MatchStateSchema })
  .refine((m) => m.f === m.state.frame, "snapshot frame mismatch");
export const EndMsgSchema = z.strictObject({ t: z.literal("end"), winner: slot.nullable() });
export const ServerMsgSchema = z.discriminatedUnion("t", [
  LobbyMsgSchema, StartMsgSchema, ConfirmedMsgSchema, HashMsgSchema, SnapMsgSchema, EndMsgSchema,
]);

export type CharId = z.infer<typeof CharIdSchema>;
export type StageId = z.infer<typeof StageIdSchema>;
export type ClientMsg = z.infer<typeof ClientMsgSchema>;
export type ServerMsg = z.infer<typeof ServerMsgSchema>;
export type LobbySlot = z.infer<typeof LobbySlotSchema>;
export type LobbyMsg = z.infer<typeof LobbyMsgSchema>;

/** Room message channel name (Colyseus message type). All game messages travel as `{ t, ... }` on this channel. */
export const MSG = "m" as const;

function withinBytes(raw: unknown): boolean {
  if (raw === null || typeof raw !== "object") return false;
  try { return JSON.stringify(raw).length <= MAX_PACKET_BYTES; } catch { return false; }
}
/** Strict parse: null instead of throwing; enforces the byte bound. */
export function parseClientMsg(raw: unknown): ClientMsg | null {
  if (!withinBytes(raw)) return null;
  const r = ClientMsgSchema.safeParse(raw);
  return r.success ? r.data : null;
}
export function parseServerMsg(raw: unknown): ServerMsg | null {
  const r = ServerMsgSchema.safeParse(raw);
  return r.success ? r.data : null;
}

// ---- HTTP session / join contracts (copied from battlegrounds) ----
const hashStr = z.string().regex(/^[0-9a-f]{16}$/);
/** Two independent FNV-1a lanes over roster data: browser/server identical compatibility key. */
export function contentHash(data: unknown): string {
  const text = JSON.stringify(data);
  let a = 0x811c9dc5, b = 0x9e3779b9;
  for (let i = 0; i < text.length; i++) {
    a = Math.imul(a ^ text.charCodeAt(i), 0x01000193) >>> 0;
    b = Math.imul(b ^ text.charCodeAt(i), 0x01000193) >>> 0;
  }
  return a.toString(16).padStart(8, "0") + b.toString(16).padStart(8, "0");
}
export const CONTENT_HASH = contentHash(CHARS);

export function graphemeCount(s: string): number {
  const Seg = (Intl as unknown as { Segmenter?: new (l?: string, o?: object) => { segment(s: string): Iterable<unknown> } }).Segmenter;
  if (Seg) return [...new Seg(undefined, { granularity: "grapheme" }).segment(s)].length;
  return [...s].length;
}
export const DisplayNameSchema = z
  .string()
  .refine((s) => !/[\u0000-\u001f\u007f-\u009f]/.test(s), "control characters")
  .refine((s) => { const n = graphemeCount(s); return n >= 1 && n <= 16; }, "1 to 16 graphemes");

export const SessionRequestSchema = z.strictObject({ invite: z.string().min(8).max(128), displayName: DisplayNameSchema });
/** Open join: only the two local profiles may be chosen. */
export const OPEN_PLAYER_NAMES = ["Arel", "Nora"] as const;
export const OpenSessionRequestSchema = z.strictObject({ displayName: z.enum(OPEN_PLAYER_NAMES) });
export const JoinTicketRequestSchema = z.strictObject({ roomCode: z.string().min(1).max(64) });
export interface VersionResponse { protocolVersion: number; contentHash: string; buildId: string }
export interface SessionResponse { expiresAt: number }
export interface JoinTicketResponse { ticket: string; expiresAt: number; roomName: string; roomId: string }
export const JoinOptionsSchema = z.strictObject({
  roomCode: z.string().min(1).max(64),
  ticket: z.string().regex(/^[0-9a-f]{64}$/),
  protocolVersion: z.literal(PROTOCOL_VERSION),
  contentHash: hashStr,
});
export type JoinOptions = z.infer<typeof JoinOptionsSchema>;

export function checkCompatibility(
  remote: { protocolVersion: number; contentHash: string },
  local: { protocolVersion: number; contentHash: string },
): "ok" | "VERSION_MISMATCH" {
  return remote.protocolVersion === local.protocolVersion && remote.contentHash === local.contentHash ? "ok" : "VERSION_MISMATCH";
}
