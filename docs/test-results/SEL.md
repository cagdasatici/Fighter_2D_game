# SEL — rotating turntable carousel character select

Commands run (2026-11-05, from repo root):

```
pnpm typecheck   # tsc -b, exit 0
pnpm lint        # exit 0
pnpm test        # Test Files 51 passed (51), Tests 616 passed (616)
pnpm build       # vite build, ✓ built, exit 0
```

New tests: `tests/unit/turntable.test.ts` (5 tests) — focused index z = 1 and drawn last; 5 steps return to start;
yaw flip rule (cos < 0 → facing inverted, |sx| ≥ 0.08); yaw 0 draw order equals the pre-SEL order, sin < 0 swaps
near/far limbs; picked fighter faces camera after 20 f.

Visual check: `docs/test-results/SEL.png` (Versus CPU select in the dev server, built-in browser, 800×600).
Owner approval: PENDING. Physical iPad check: NOT RUN.

Known limits: move list uses the current How-to-Play special labels (CTRL relabels later). Info card overlaps the
right-hand ring fighter at desktop width; on ≤640 px it stacks below the canvas. Online (Lobby) select unchanged.
