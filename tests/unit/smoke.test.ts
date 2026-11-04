import { describe, expect, it } from "vitest";
import * as shared from "../../packages/shared/src/index.js";

describe("smoke", () => {
  it("adds", () => { expect(1 + 1 === 2).toBe(true); });
  it("imports @kb/shared index", () => { expect(shared.GAME_NAME).toBe("Knockout Bash"); });
});
