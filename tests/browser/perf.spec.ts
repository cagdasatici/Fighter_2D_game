import { writeFileSync } from "node:fs";
import { test } from "@playwright/test";
import { kb } from "./helpers.js";

// PERF slice: frame-time measurement per stage. Chromium + CDP CPU throttle 4x, 600 fight frames, CPU opponent.
// Results go to $PERF_OUT (JSON) when set. Not a pass/fail gate: numbers are recorded in docs/test-results/PERF.md.
const FRAMES = 600;
const STAGES = ["rooftop", "bamboo", "volcano"] as const;

test("PERF frame-time per stage (4x CPU throttle)", async ({ page, context }) => {
  test.setTimeout(240000);
  const cdp = await context.newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await cdp.send("Performance.enable");
  await page.goto("/");
  await page.evaluate(() => localStorage.setItem("kb.settings.v1", JSON.stringify({ difficulty: "hard", musicOn: false })));
  await page.reload();
  const out: Record<string, { avgMs: number; p95Ms: number; maxMs: number; taskMsPerFrame: number; scriptMsPerFrame: number }> = {};
  for (const stage of STAGES) {
    await page.evaluate((s) => (window as unknown as { __kb: { start: (m: string, c: string[], st: string) => void } }).__kb.start("cpu", ["bolt", "volt"], s), stage);
    // Keep P1 busy so the fight stays in the fight phase with real effects.
    const keys = ["KeyD", "KeyU", "KeyI", "KeyK", "KeyA", "KeyO"];
    let n = 0;
    const pump = setInterval(() => { void page.keyboard.press(keys[n++ % keys.length]!).catch(() => {}); }, 120);
    await page.waitForTimeout(1500);
    const metric = async (): Promise<Record<string, number>> => Object.fromEntries((await cdp.send("Performance.getMetrics")).metrics.map((m) => [m.name, m.value]));
    const m0 = await metric();
    await page.evaluate((frames) => new Promise<void>((resolve) => {
      const w = window as unknown as { __perf?: number[] };
      const d: number[] = []; let last = performance.now();
      const tick = (): void => {
        const now = performance.now(); d.push(now - last); last = now;
        if (d.length < frames) requestAnimationFrame(tick); else { w.__perf = d; resolve(); }
      };
      requestAnimationFrame(tick);
    }), FRAMES);
    const m1 = await metric();
    clearInterval(pump);
    const d = (await page.evaluate(() => (window as unknown as { __perf: number[] }).__perf)).slice(1).sort((a, b) => a - b);
    const avg = d.reduce((a, b) => a + b, 0) / d.length;
    out[stage] = {
      avgMs: +avg.toFixed(2), p95Ms: +d[Math.floor(d.length * 0.95)]!.toFixed(2), maxMs: +d[d.length - 1]!.toFixed(2),
      taskMsPerFrame: +(((m1["TaskDuration"]! - m0["TaskDuration"]!) * 1000) / FRAMES).toFixed(2),
      scriptMsPerFrame: +(((m1["ScriptDuration"]! - m0["ScriptDuration"]!) * 1000) / FRAMES).toFixed(2),
    };
    const v = await kb(page);
    console.log(stage, JSON.stringify(out[stage]), "phase", v?.phase);
  }
  if (process.env["PERF_OUT"]) writeFileSync(process.env["PERF_OUT"], JSON.stringify(out, null, 2));
});
