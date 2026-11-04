import { z } from "zod";
import { MAX_CLIENTS } from "./protocol.js";

/** Room list contracts. Rows carry counts only: never internal ids, member names or link tokens. */
const count = z.number().int().nonnegative().max(MAX_CLIENTS);
export const RoomSummarySchema = z.strictObject({
  roomCode: z.string().min(1).max(64).regex(/^[A-Za-z0-9_-]+$/),
  name: z.string().min(1).max(32),
  kind: z.literal("fight"),
  players: count,
  capacity: count,
  bots: count,
});
export const RoomListResponseSchema = z.strictObject({ rooms: z.array(RoomSummarySchema).max(100) });
export type RoomSummary = z.infer<typeof RoomSummarySchema>;
export type RoomListResponse = z.infer<typeof RoomListResponseSchema>;

/** True when no seat is left for a human. */
export const roomIsFull = (r: Pick<RoomSummary, "players" | "bots" | "capacity">): boolean => r.players + r.bots >= r.capacity;
