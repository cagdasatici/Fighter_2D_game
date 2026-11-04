import type { StageId } from '@kb/shared';

/** Spec §13: one procedural four-bar bass + drum loop per stage. Original patterns, rendered to a mono buffer. */
export interface StageTheme {
  bpm: number;
  /** Bass note per eighth (32 eighths = 4 bars of 4/4), Hz; 0 = rest. */
  bass: number[];
  bassWave: 'square' | 'saw' | 'triangle';
  /** 16-step drum masks per bar, repeated: K kick, S snare, H hat, '.' rest. */
  drums: string;
}

const A2 = 110, C3 = 130.81, D3 = 146.83, E2 = 82.41, G2 = 98, F2 = 87.31, B2 = 123.47;
const bar = (notes: number[]): number[] => notes.flatMap((n) => [n, n]); // 4 quarter notes -> 8 eighths

export const STAGE_THEMES: Record<StageId, StageTheme> = {
  rooftop: { bpm: 124, bassWave: 'square', drums: 'K.H.S.H.K.KHS.H.',
    bass: [...bar([A2, A2, C3, D3]), ...bar([A2, A2, G2, E2]), ...bar([F2, F2, G2, A2]), ...bar([E2, G2, A2, 0])] },
  bamboo: { bpm: 96, bassWave: 'triangle', drums: 'K..HS..HK.K.S.H.',
    bass: [...bar([D3, 0, A2, C3]), ...bar([D3, 0, G2, A2]), ...bar([C3, 0, G2, F2]), ...bar([G2, A2, D3, 0])] },
  volcano: { bpm: 140, bassWave: 'saw', drums: 'KKH.S.HKK.H.S.SH',
    bass: [...bar([E2, E2, G2, E2]), ...bar([B2, A2, G2, E2]), ...bar([E2, E2, G2, A2]), ...bar([B2, B2, A2, G2])] },
};

export const LOOP_BARS = 4;
export function loopSeconds(stage: StageId): number { return (LOOP_BARS * 4 * 60) / STAGE_THEMES[stage].bpm; }

function osc(wave: StageTheme['bassWave'], phase: number): number {
  const p = phase - Math.floor(phase);
  if (wave === 'square') return p < 0.5 ? 1 : -1;
  if (wave === 'saw') return 2 * p - 1;
  return 1 - 4 * Math.abs(p - 0.5);
}

/** Render one loop of `stage` at `rate` Hz. Deterministic (xorshift noise), peak kept under 1. */
export function renderStageLoop(stage: StageId, rate: number): Float32Array {
  const th = STAGE_THEMES[stage];
  const len = Math.floor(loopSeconds(stage) * rate);
  const out = new Float32Array(len);
  const eighth = 30 / th.bpm, step16 = 15 / th.bpm;
  let s = 24680;
  for (let i = 0; i < len; i++) {
    const t = i / rate;
    const ei = Math.min(th.bass.length - 1, Math.floor(t / eighth));
    const f = th.bass[ei]!, te = t - ei * eighth;
    let v = f > 0 ? 0.18 * osc(th.bassWave, f * t) * Math.exp(-te * 6) : 0;
    const si = Math.floor(t / step16), ts = t - si * step16;
    const hitc = th.drums[si % 16];
    s ^= s << 13; s ^= s >>> 17; s ^= s << 5;
    const noise = ((s >>> 0) / 0xffffffff) * 2 - 1;
    if (hitc === 'K') v += 0.5 * Math.sin(2 * Math.PI * (50 + 90 * Math.exp(-ts * 30)) * ts) * Math.exp(-ts * 18);
    else if (hitc === 'S') v += 0.25 * noise * Math.exp(-ts * 22);
    else if (hitc === 'H') v += 0.08 * noise * Math.exp(-ts * 60);
    out[i] = Math.max(-0.95, Math.min(0.95, v));
  }
  return out;
}
