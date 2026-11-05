import { describe, expect, it } from 'vitest';
import { drawOrder, yawScale } from '../../apps/client/src/render/Puppet.js';
import { ringDelta, ringSlots, ringTween, RING_TWEEN_FRAMES, turntableYaw } from '../../apps/client/src/render/Turntable.js';

describe('SEL turntable ring', () => {
  it('focused index has z = 1 and is drawn last', () => {
    for (let f = 0; f < 5; f++) {
      const s = ringSlots(5, f, 100);
      const last = s[s.length - 1]!;
      expect(last.i).toBe(f);
      expect(last.z).toBeCloseTo(1, 9);
      expect(last.scale).toBeCloseTo(1, 9);
      for (let k = 1; k < s.length; k++) expect(s[k]!.z).toBeGreaterThanOrEqual(s[k - 1]!.z);
    }
  });
  it('rotating 5 steps returns to the start', () => {
    let to = 2, last = 2;
    for (let k = 0; k < 5; k++) { const next = (last + 1) % 5; to += ringDelta(last, next, 5); last = next; }
    expect(last).toBe(2);
    const a = ringSlots(5, 2, 100), b = ringSlots(5, to, 100);
    a.forEach(sl => { const m = b.find(q => q.i === sl.i)!; expect(m.x).toBeCloseTo(sl.x, 9); expect(m.z).toBeCloseTo(sl.z, 9); });
    expect(b[b.length - 1]!.i).toBe(2);
    expect(ringTween(0, 5, RING_TWEEN_FRAMES)).toBe(5);
    expect(ringTween(0, 5, 0)).toBe(0);
    expect(ringDelta(4, 0, 5)).toBe(1);
    expect(ringDelta(0, 4, 5)).toBe(-1);
  });
  it('yaw flip rule: cos < 0 inverts facing, |sx| floored at 0.08', () => {
    expect(yawScale(0, 1)).toEqual({ sx: 1, facing: 1 });
    expect(yawScale(Math.PI, 1).facing).toBe(-1);
    expect(yawScale(Math.PI, -1).facing).toBe(1);
    expect(yawScale(Math.PI / 2, 1).sx).toBeCloseTo(0.08, 9);
    expect(yawScale(0.3, -1).facing).toBe(-1);
  });
  it('draw order with yaw 0 matches the current order; sin < 0 swaps near/far limbs', () => {
    expect(drawOrder(0)).toEqual(['scarf', 'tail', 'drawBack', 'armB', 'legB', 'torso', 'legF', 'head', 'armF', 'drawFront']);
    expect(drawOrder()).toBe(drawOrder(0));
    expect(drawOrder(-0.5)).toEqual(['scarf', 'tail', 'drawBack', 'armF', 'legF', 'torso', 'legB', 'head', 'armB', 'drawFront']);
  });
  it('picked fighter eases to face the camera within 20 frames', () => {
    expect(turntableYaw(100, null)).toBeCloseTo(2, 9);
    const y = turntableYaw(400 + 20, 400);
    expect(Math.abs(y)).toBeLessThan(1e-9);
  });
});
