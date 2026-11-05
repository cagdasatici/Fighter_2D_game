import { test } from "@playwright/test";

// FX slice: deterministic screenshots of hit / block / super / K.O. Run with FX_SHOTS=<dir>; skipped otherwise.
// The match is paused (Escape) so only __kb.step advances the sim; the canvas element is captured, not the DOM overlay.
const OUT = process.env["FX_SHOTS"];
const UP = 1, DOWN = 2, LEFT = 4, RIGHT = 8, LP = 16, HP = 32;

type K = { state: { frame: number; fighters: { x: number; hp: number; meter: number; comboHits: number }[]; events: { kind: string }[] }; step: (i: [number, number]) => void; start: (m: string, c: string[], s: string) => void };

test("FX screenshots", async ({ page }) => {
  test.skip(!OUT, "set FX_SHOTS to a directory");
  test.setTimeout(120000);
  await page.goto("/");
  await page.evaluate(() => localStorage.setItem("kb.settings.v1", JSON.stringify({ musicOn: false })));
  await page.reload();
  const shot = async (name: string): Promise<void> => { await page.addStyleTag({ content: ".kb-ui { display: none !important; }" }); await page.waitForTimeout(120); await page.locator("canvas").first().screenshot({ path: `${OUT}/FX-${name}.png` }); };
  const run = (code: string): Promise<unknown> => page.evaluate(code);
  const fresh = async (stage: string): Promise<void> => {
    await page.evaluate((s) => (window as unknown as { __kb: K }).__kb.start("local", ["bolt", "volt"], s), stage);
    await page.keyboard.press("Escape"); // pause: the loop stops ticking, render keeps running
    await page.waitForTimeout(200);
    await run(`(() => { const k = window.__kb; while (k.state.phase !== 'fight') k.step([0, 0]); })()`);
  };
  const helpers = `const k = window.__kb, f = k.state.fighters; const U=${UP},D=${DOWN},L=${LEFT},R=${RIGHT},LP=${LP},HP=${HP};
    const close = (d = 9000) => { let n = 0; while (f[1].x - f[0].x > d && n++ < 400) k.step([R, 0]); };
    const wait = (n) => { for (let i = 0; i < n; i++) k.step([0, 0]); };
    const until = (kind, a, b, max) => { for (let i = 0; i < max; i++) { k.step([a, b]); if (k.state.events.some(e => e.kind === kind)) return true; } return false; };`;

  await fresh("rooftop");
  await run(`(() => { ${helpers} close(); wait(30); until('hit', HP, 0, 40); wait(3); })()`);
  await shot("hit");

  await fresh("bamboo");
  await run(`(() => { ${helpers} close(4500); wait(30); until('block', HP, R, 40); wait(3); })()`);
  await shot("block");

  await fresh("volcano");
  await run(`(() => { ${helpers} close(); wait(20); f[0].meter = 1000;
    for (const i of [[D,0],[D|R,0],[R,0],[D,0],[D|R,0],[R|LP,0]]) k.step(i); wait(14); })()`);
  await shot("super");

  await fresh("rooftop");
  await run(`(() => { ${helpers} close(); wait(30); f[1].hp = 1; until('ko', HP, 0, 60); wait(22); })()`);
  await shot("ko");
});
