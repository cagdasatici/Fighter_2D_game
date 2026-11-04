import type { Fighter, MoveDef } from '@kb/shared';
import { getPose, lerpPose, windOf, type Pose } from './poses.js';

/** Which two keys to blend and how far (0..1). Chosen only from sim frame counters, never a render clock. */
export interface Clip { pose: string; nextPose: string; t: number; moveId: string | null; active: boolean }

const hold = (pose: string, moveId: string | null = null, active = false): Clip => ({ pose, nextPose: pose, t: 0, moveId, active });
const blend = (pose: string, nextPose: string, t: number, moveId: string | null = null): Clip =>
  ({ pose, nextPose, t: Math.max(0, Math.min(1, t)), moveId, active: false });

/** Looping clip of `[pose, frames]` keys; interpolates towards the following key. */
function loop(keys: readonly [string, number][], frame: number): Clip {
  const total = keys.reduce((n, k) => n + k[1], 0);
  let f = ((frame % total) + total) % total;
  for (let i = 0; i < keys.length; i++) {
    const [pose, len] = keys[i]!;
    if (f < len) return blend(pose, keys[(i + 1) % keys.length]![0], f / len);
    f -= len;
  }
  return hold(keys[0]![0]);
}

function moveClip(f: Fighter, m: MoveDef): Clip {
  const pose = m.id === 'throw' ? 'throwGrab' : m.pose;
  const rest = m.input.stance === 'crouch' ? 'crouch' : m.input.stance === 'air' ? 'jumpUp' : 'idle';
  const fr = f.moveFrame;
  if (fr <= m.startup) return blend(rest, windOf(pose), m.startup > 0 ? fr / m.startup : 1, m.id);
  if (fr <= m.startup + m.active) return hold(pose, m.id, true);
  return blend(pose, rest, m.recovery > 0 ? (fr - m.startup - m.active) / m.recovery : 1, m.id);
}

/** Clip timing rule, spec §9.3. `move` is the fighter's current MoveDef (null when not attacking). */
export function clipFor(f: Fighter, move: MoveDef | null): Clip {
  const sf = f.stateFrame;
  switch (f.state) {
    case 'attack': return move ? moveClip(f, move) : hold('idle');
    case 'walkF': return loop([['walk1', 8], ['walk2', 8]], sf);
    case 'walkB': return loop([['walk2', 8], ['walk1', 8]], sf);
    case 'crouch': case 'jumpSquat': case 'land': return hold('crouch');
    case 'air': return hold(f.vy > 0 ? 'jumpUp' : 'jumpTuck');
    case 'dashF': return hold('walk2');
    case 'dashB': return hold('walk1');
    case 'hitstun': case 'thrown': return hold(f.crouching ? 'hitLow' : 'hitHigh');
    case 'blockstun': return hold(f.crouching ? 'blockLow' : 'blockHigh');
    case 'techSep': return hold('blockHigh');
    case 'juggle': return hold('fall');
    case 'knockdown': case 'ko': return f.airborne ? hold('fall') : blend('fall', 'lying', sf / 8);
    case 'getup': return blend('lying', 'crouch', sf / 20);
    case 'throwing': return sf < 10 ? hold('throwGrab') : hold('throwToss');
    case 'win': return blend('idle', 'victory', sf / 20);
    case 'idle': default: return loop([['idle', 30], ['idle2', 30]], sf);
  }
}

/** Smoothstep easing for pose blends: keys ease in and out instead of moving at constant speed. */
export function ease(t: number): number { const c = Math.max(0, Math.min(1, t)); return c * c * (3 - 2 * c); }

/** Resolve a clip into a concrete pose (eased between keys). */
export function poseOf(clip: Clip): Pose {
  return clip.t === 0 ? getPose(clip.pose) : lerpPose(getPose(clip.pose), getPose(clip.nextPose), ease(clip.t));
}

/**
 * Render-only squash (+) / stretch (−) from sim counters: impact squash on hit/block/landing, crouch-down
 * before a jump, stretch while rising. Never feeds back into the sim.
 */
export function squashFor(f: Pick<Fighter, 'state' | 'stateFrame' | 'vy' | 'airborne'>): number {
  const decay = (peak: number, frames: number): number => (f.stateFrame < frames ? peak * (1 - f.stateFrame / frames) : 0);
  switch (f.state) {
    case 'hitstun': case 'thrown': return decay(0.12, 8);
    case 'blockstun': return decay(0.06, 6);
    case 'land': return decay(0.14, 6);
    case 'jumpSquat': return 0.1;
    case 'air': return f.vy > 600 ? -0.07 : 0;
    case 'knockdown': return f.airborne ? 0 : decay(0.12, 6);
    default: return 0;
  }
}

/** Face expression for the shared eye helper. */
export function moodFor(f: Pick<Fighter, 'state'>): 'normal' | 'hurt' | 'fierce' {
  switch (f.state) {
    case 'hitstun': case 'juggle': case 'thrown': case 'knockdown': case 'ko': return 'hurt';
    case 'attack': case 'throwing': return 'fierce';
    default: return 'normal';
  }
}
