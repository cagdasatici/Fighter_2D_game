# Knockout Bash

A small 2D fighting game for the browser and iPad: five original characters, Versus CPU, local 2P, Training and
online play over a server-relayed rollback connection. All art, sound and music are generated in code.

**Quick start: `pnpm play`** builds the game, creates an invitation, prints the link and a QR code, and starts the
server for your home Wi-Fi (plain HTTP on this computer's private IP; Ctrl-C stops it). Flags: `--local` (this
computer only), `--tailscale` (HTTPS via Tailscale Serve, opt-in; also enables the offline cache), `--host-ip <ip>`,
`--no-build`, `--uses N` (default 4), `--hours N` (default 24). On the iPad: open the link in Safari, then
Share > Add to Home Screen. Needs Node 24 and pnpm 10 (`pnpm install` once).

## Admin and reusable home address

Run `pnpm admin:setup` once in a terminal on the host. It prompts twice without echoing the password and stores
only a private scrypt hash in `~/kb-data` (or `DATA_DIR`). No default admin password exists. The admin HTTP API
(`/api/admin/*`) uses it, and so does the admin web page (`/admin.html`, printed by `pnpm play`): status, invitations,
players, rooms (optionally with a CPU in seat 2) and the announcement banner. Players do not need it, because the
server always lists the **Play** room.

Bookmark the printed **Game home** address, without an invitation fragment. An invitation is needed for initial
player access; the same browser can return using its saved session until expiry/revocation. The host must remain
running. Keep the same port and host IP for the bookmark. If 2567 is already occupied, stop the previous game or use
`PORT=2568 pnpm play`.

## Invitations

`pnpm play` prints one invitation each time it starts. For more:
`pnpm --filter @kb/server exec tsx ../../ops/scripts/invite.ts <origin> [ttlHours=24] [maxUses=1]` prints a new
link once (only its hash is stored). Send the link to the player; the token sits in the `#invite=` fragment and is
never sent to the server in the URL.

## Development

| Command | What it does |
|---|---|
| `pnpm verify` | `typecheck`, `lint` (sim determinism + timer boundaries), `test` (vitest), `build` |
| `pnpm test:browser` | Playwright: title, Versus CPU match (canvas + keyboard hit), two-tab online match |
| `pnpm dev:server` / `pnpm dev:client` | game server on 2567 and the Vite client (proxies `/api`, `/matchmake` and room sockets) |

Docs: `docs/spec.md` (design), `docs/characters.md` (roster), `docs/tasks.md` (slices),
`docs/decisions/` (decisions), `docs/release-checklist.md` (manual release checks).
