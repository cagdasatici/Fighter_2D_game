import { expect, test, type Browser, type Page } from "@playwright/test";
import { kb, waitPhase } from "./helpers.js";

async function joinAs(browser: Browser, name: string): Promise<Page> {
  const ctx = await browser.newContext(); // separate cookie jar = separate player
  const page = await ctx.newPage();
  await page.goto("/");
  await page.getByRole("button", { name: "Play Online" }).click();
  await page.getByRole("button", { name: `Play as ${name}` }).click();
  await page.locator("[data-join]").first().click();
  await expect(page.getByRole("heading", { name: "Room" })).toBeVisible();
  return page;
}

test("two tabs join one room, ready up and play the same rollback match", async ({ browser }) => {
  const a = await joinAs(browser, "Arel");
  const b = await joinAs(browser, "Nora");
  await expect(a.locator(".kb-slot")).toHaveCount(2);
  await a.getByRole("button", { name: "Ready" }).click();
  await b.getByRole("button", { name: "Ready" }).click();
  await waitPhase(a, "fight", 20000);
  await waitPhase(b, "fight", 20000);
  const [va, vb] = [(await kb(a))!, (await kb(b))!];
  expect(va.chars).toEqual(vb.chars);

  // Tab A holds forward (P1 = Arel, left side); tab B must see P1 move.
  const x0 = vb.x[0];
  await a.bringToFront();
  await a.keyboard.down("KeyD"); await a.waitForTimeout(800); await a.keyboard.up("KeyD");
  await expect.poll(async () => (await kb(b))!.x[0], { timeout: 5000 }).toBeGreaterThan(x0);
  // Both clients keep advancing.
  const fa = (await kb(a))!.frame;
  await expect.poll(async () => (await kb(a))!.frame, { timeout: 5000 }).toBeGreaterThan(fa + 30);
  await a.context().close(); await b.context().close();
});
