# Deployment runbook — fighter.cagdasatici.com

Live setup on the owner's Mac (2026-11-05):
- Code: `.worktrees/prod` (detached checkout of main). Env: `~/kb-env` (chmod 600, from `ops/deploy/env.example`). Data: `~/kb-data`. Logs: `~/kb-logs/`.
- Server: LaunchAgent `com.knockoutbash.server` (`ops/deploy/com.knockoutbash.server.plist`) runs `ops/deploy/run-prod.sh` on `127.0.0.1:2568`.
- Public HTTPS: the existing Cloudflare tunnel `battlegrounds` (`/etc/cloudflared/config.yml`, LaunchDaemon `com.cloudflare.cloudflared`) has an ingress rule `fighter.cagdasatici.com → http://127.0.0.1:2568`; DNS CNAME created with `cloudflared tunnel route dns battlegrounds fighter.cagdasatici.com`.

## Update to the latest main
```
cd .worktrees/prod && git fetch && git checkout --detach origin/main && pnpm install --frozen-lockfile && pnpm build
sed -i '' "s/^BUILD_ID=.*/BUILD_ID=$(git rev-parse --short HEAD)/" ~/kb-env
launchctl kickstart -k gui/$(id -u)/com.knockoutbash.server
curl -s http://127.0.0.1:2568/healthz
```

## Invitations and admin
- Invite: `cd .worktrees/prod && DATA_DIR=~/kb-data pnpm --filter @kb/server exec tsx ../../ops/scripts/invite.ts https://fighter.cagdasatici.com 168 10`
- Admin password (once, interactive): `DATA_DIR=~/kb-data pnpm --filter @kb/server exec tsx ../../ops/scripts/admin-setup.ts`, then `https://fighter.cagdasatici.com/admin.html`.

## Stop
`launchctl bootout gui/$(id -u)/com.knockoutbash.server`
