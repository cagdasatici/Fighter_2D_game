import { createMatch } from "../../packages/shared/src/sim/state.js";
import { CONTENT_HASH, contentHash } from "../../packages/shared/src/net/protocol.js";
import { describe, expect, test } from "vitest";
import {
  ClientMsgSchema, ServerMsgSchema, StartMsgSchema, parseClientMsg, MAX_PACKET_BYTES,
} from "../../packages/shared/src/net/protocol.js";

describe("client messages (spec §11.2)", () => {
  test("accepts every valid kind", () => {
    for (const m of [
      { t: "pick", char: "bolt" }, { t: "ready" }, { t: "in", f: 1, b: 0 }, { t: "in", f: 99, b: 255 },
      { t: "ack", f: 60, h: 0xffffffff }, { t: "resync" }, { t: "rematch" },
    ]) expect(parseClientMsg(m)).toEqual(m);
  });
  test("rejects out-of-range b", () => {
    expect(parseClientMsg({ t: "in", f: 1, b: 256 })).toBeNull();
    expect(parseClientMsg({ t: "in", f: 1, b: -1 })).toBeNull();
    expect(parseClientMsg({ t: "in", f: 1, b: 1.5 })).toBeNull();
  });
  test("rejects negative or zero f", () => {
    expect(parseClientMsg({ t: "in", f: -1, b: 0 })).toBeNull();
    expect(parseClientMsg({ t: "in", f: 0, b: 0 })).toBeNull();
    expect(parseClientMsg({ t: "ack", f: -60, h: 1 })).toBeNull();
  });
  test("rejects unknown t, extra keys, unknown char and non-objects", () => {
    expect(parseClientMsg({ t: "damage", hp: 0 })).toBeNull();
    expect(parseClientMsg({ t: "ready", hp: 0 })).toBeNull();
    expect(parseClientMsg({ t: "pick", char: "mario" })).toBeNull();
    expect(parseClientMsg("ready")).toBeNull();
    expect(parseClientMsg(null)).toBeNull();
    expect(ClientMsgSchema.safeParse({ t: "lobby", slots: [] }).success).toBe(false);
  });
  test("rejects oversized packets", () => {
    expect(parseClientMsg({ t: "pick", char: "bolt", pad: "x".repeat(MAX_PACKET_BYTES) })).toBeNull();
  });
});

describe("server messages", () => {
  test("accepts valid kinds", () => {
    for (const m of [
      { t: "lobby", slots: [{ name: "Arel", char: null, ready: false, bot: false }] },
      { t: "start", seed: 7, chars: ["bolt", "bao"], stage: "rooftop", you: 1, startAtMs: 1000, delay: 2 },
      { t: "cf", f: 1, b: [[0, 255]] },
      { t: "hash", f: 60, h: 123 },
      { t: "snap", f: 60, state: { ...createMatch({ chars: ["bolt", "bao"], stage: "rooftop", seed: 1 }), frame: 60 } },
      { t: "end", winner: null },
    ]) expect(ServerMsgSchema.safeParse(m).success).toBe(true);
  });
  test("rejects bad values", () => {
    expect(StartMsgSchema.safeParse({ t: "start", seed: 0, chars: ["bolt", "bao"], stage: "rooftop", you: 0, startAtMs: 0, delay: 2 }).success).toBe(false);
    expect(ServerMsgSchema.safeParse({ t: "cf", f: 1, b: [[0, 256]] }).success).toBe(false);
    expect(ServerMsgSchema.safeParse({ t: "end", winner: 2 }).success).toBe(false);
    expect(ServerMsgSchema.safeParse({ t: "lobby", slots: [1, 2, 3].map(() => ({ name: "a", char: null, ready: false, bot: false })) }).success).toBe(false);
    expect(ServerMsgSchema.safeParse({ t: "nope" }).success).toBe(false);
  });
});

test("snapshot validates full simulation state and matching frame", () => {
  const state = createMatch({ chars: ["bolt", "bao"], stage: "rooftop", seed: 1 });
  expect(ServerMsgSchema.safeParse({ t: "snap", f: 0, state }).success).toBe(true);
  expect(ServerMsgSchema.safeParse({ t: "snap", f: 1, state }).success).toBe(false);
  expect(ServerMsgSchema.safeParse({ t: "snap", f: 0, state: { anything: true } }).success).toBe(false);
  state.fighters[0].hp = 1.5;
  expect(ServerMsgSchema.safeParse({ t: "snap", f: 0, state }).success).toBe(false);
});
test("content compatibility hash is deterministic and sensitive to data", () => {
  expect(CONTENT_HASH).toMatch(/^[0-9a-f]{16}$/);
  expect(contentHash({ hp: 1 })).toBe(contentHash({ hp: 1 }));
  expect(contentHash({ hp: 1 })).not.toBe(contentHash({ hp: 2 }));
});
