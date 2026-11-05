import { setTuning } from "../packages/shared/src/chars/index.js";

// Mechanics tests assert authored numbers (characters.md). Shipped tuning (decision 0018) is covered by
// tests/unit/balance.test.ts and winrate.test.ts, which call setTuning(true) themselves.
setTuning(false);
