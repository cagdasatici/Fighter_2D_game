import { CHARS, PX, getMove, type MatchState } from '@kb/shared';
import { hurtboxes, type WorldBox } from '@kb/shared/sim/hit';
import { strikeBoxes, strikeReady } from '@kb/shared/sim/specials';
import { GROUND } from './Canvas.js';
import type { Camera } from './Camera.js';

export function drawDebug(ctx: CanvasRenderingContext2D, state: MatchState, previous: MatchState, alpha: number, camera: Camera, boxes: boolean): void {
  ctx.fillStyle = '#141a29'; ctx.fillRect(0, 0, 640, 360);
  const screenX = (x: number): number => 320 + x / PX - camera.x + camera.shakeX;
  const screenY = (y: number): number => GROUND - y / PX + camera.y + camera.shakeY;
  ctx.strokeStyle = '#596579'; ctx.beginPath(); ctx.moveTo(0, screenY(0)); ctx.lineTo(640, screenY(0)); ctx.stroke();
  const rect = (box: WorldBox, color: string, dx = 0, dy = 0): void => {
    const x = screenX(box.left + dx), y = screenY(box.top + dy);
    const w = (box.right - box.left) / PX, h = (box.top - box.bottom) / PX;
    ctx.fillStyle = color; ctx.globalAlpha = 0.18; ctx.fillRect(x, y, w, h);
    ctx.globalAlpha = 1; ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.strokeRect(x, y, w, h);
  };
  state.fighters.forEach((f, i) => {
    const old = previous.fighters[i]!;
    const dx = (old.x - f.x) * (1 - alpha), dy = (old.y - f.y) * (1 - alpha);
    // Only fighter positions interpolate; move/state selection always uses the latest tick.
    const hurt = hurtboxes(f);
    if (boxes) {
      for (const box of hurt) rect(box, '#59a8ff', dx, dy);
      const half = CHARS[f.char].pushWidth * PX / 2;
      rect({ left: f.x - half, right: f.x + half, bottom: f.y, top: f.y + 70 * PX }, '#55ed92', dx, dy);
      const move = f.state === 'attack' && f.move ? getMove(f.char, f.move) : null;
      move?.hits.forEach((hit, k) => {
        if (f.moveFrame >= hit.frames[0] && f.moveFrame <= hit.frames[1] && strikeReady(f, move, k)) {
          for (const box of strikeBoxes(f, move, hit)) rect(box, '#ff5268', dx, dy);
        }
      });
    } else if (hurt[0]) {
      // S8 placeholder bodies remain visible with the collision overlay disabled.
      const b = hurt[0]; ctx.fillStyle = '#3974ad';
      ctx.fillRect(screenX(b.left + dx), screenY(b.top + dy), (b.right - b.left) / PX, (b.top - b.bottom) / PX);
    }
    ctx.fillStyle = '#fff'; ctx.font = '11px system-ui'; ctx.textAlign = 'center';
    ctx.fillText(`P${i + 1} ${f.state}${f.move ? ` · ${f.move}` : ''}`, screenX(f.x + dx), screenY(f.y + dy) + 15);
  });
  for (const p of state.projectiles) rect({ left: p.x - p.w * PX / 2, right: p.x + p.w * PX / 2, bottom: p.y - p.h * PX / 2, top: p.y + p.h * PX / 2 }, '#ffe14d');
  ctx.fillStyle = '#edf4ff'; ctx.font = 'bold 16px system-ui'; ctx.textAlign = 'left';
  ctx.fillText(`P1 ${CHARS[state.fighters[0].char].name} · HP ${state.fighters[0].hp}`, 12, 24);
  ctx.textAlign = 'right'; ctx.fillText(`P2 ${CHARS[state.fighters[1].char].name} · HP ${state.fighters[1].hp}`, 628, 24);
  ctx.textAlign = 'center'; ctx.fillText(String(Math.ceil(state.timer / 60)).padStart(2, '0'), 320, 48);
  ctx.font = '12px system-ui';
  ctx.fillText(`Round ${state.round} · ${state.phase} · ${state.fighters[0].wins}:${state.fighters[1].wins}`, 320, 68);
  if (state.phase === 'matchEnd') ctx.fillText(`P${(state.winner ?? 0) + 1} wins`, 320, 110);
  ctx.font = '10px system-ui';
  ctx.fillText('P1 WASD · U/I/J/K   |   P2 Arrows · Num 4/5/1/2   |   Throw LP+LK   |   F1 boxes', 320, 354);
}
