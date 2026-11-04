# 0002: A held direction is never a motion

Status: ACCEPTED (2026-11-04). Found during S2 (see `docs/test-results/S2.md`, "Known limit").

The diagonal tolerance in spec §5.3 let a held `3` (3,3,3) satisfy `qcf` (2,3,6) and `dp` (6,2,3). That would make specials fire by accident while crouching forward.

**Rule:** when matching a sequence, consecutive steps must be matched on frames whose numpad directions differ. Implemented in `packages/shared/src/input/motion.ts` and tested in `tests/unit/motion.test.ts`.
