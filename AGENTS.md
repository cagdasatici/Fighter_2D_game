# Knockout Bash implementation contract

Read `docs/spec.md`, `docs/characters.md` and `docs/tasks.md` before changing code.
Implement exactly one slice ID per session. Check its prerequisites are DONE first.
Execution agents: Sonnet 5.5 Low, Sol 6.1 Light. Do not change model settings.

Authority order:
1. Explicit user requirements.
2. `docs/decisions/*` (newest wins), then `docs/spec.md`.
3. `docs/characters.md` for character data and visuals.
4. Acceptance tests listed in the slice.

Originality (non-negotiable):
- All art, sound and music are generated in code. Never import anything from `Archive/`.
- Characters are original (docs/characters.md). Never add names, outfits, logos,
  moves or sounds from Nintendo, Capcom, DreamWorks or any existing game or film.
- Do not "improve resemblance" to any real character.

Simulation rules:
- `packages/shared/src/sim` is deterministic: integers only, `idiv()` for division,
  no Math.random/Date/performance/timers/trig/sqrt. Lint enforces it.
- `step()` is the only function that advances a frame. Render never mutates sim state.
- Server confirms inputs; clients never send damage, positions or hp.
- Every listener, interval, room handler and requestAnimationFrame has cleanup.
- Strict TypeScript; zod schemas for every network message, both directions.
- Exact dependency versions; committed lockfile; no new deps unless the slice says so.

Working rules:
- Use `rg` for search. Read relevant code before editing.
- If the spec is ambiguous or contradicts itself: STOP, write the question in
  `docs/tasks.md` under the slice as `BLOCKED: <question>`, and report. Do not guess.
- Do not refactor outside the slice. Do not touch files other slices own unless listed.

Checks before reporting done:
`pnpm typecheck && pnpm lint && pnpm test` (+ `pnpm build` from S1 on, + the slice's extra checks).
Update the slice row in `docs/tasks.md`: status, commit hash, test evidence path
`docs/test-results/<SLICE>.md` (commands run + pass counts, copied from real output).
Physical iPad checks are recorded NOT RUN until a human runs them.
Commit with the slice's commit subject, then `git push -u origin HEAD` if a remote exists.
Report: what changed, checks actually executed, known limits. Never invent results.
Keep each session to one slice; recommend a fresh session with a 2-3 line handoff.
