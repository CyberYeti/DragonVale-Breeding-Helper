import { describe, expect, it } from 'vitest';
import { cubicBezier, easeInOut } from './motion';

describe('easeInOut (CSS ease-in-out)', () => {
  it('starts at 0, ends at 1 and is symmetric about the middle', () => {
    expect(easeInOut(0)).toBe(0);
    expect(easeInOut(1)).toBe(1);
    expect(easeInOut(0.5)).toBeCloseTo(0.5, 5);
    for (const t of [0.1, 0.25, 0.4]) expect(easeInOut(t) + easeInOut(1 - t)).toBeCloseTo(1, 5);
  });

  it('matches cubic-bezier(0.42, 0, 0.58, 1) as browsers draw it', () => {
    // Reference values from the curve, solved numerically.
    expect(easeInOut(0.25)).toBeCloseTo(0.1291, 3);
    expect(easeInOut(0.75)).toBeCloseTo(0.8709, 3);
    expect(easeInOut(0.1)).toBeLessThan(0.1);
  });

  it('is linear for a linear curve and never decreases', () => {
    const linear = cubicBezier(0.25, 0.25, 0.75, 0.75);
    for (const t of [0.1, 0.33, 0.9]) expect(linear(t)).toBeCloseTo(t, 5);
    let last = 0;
    for (let t = 0; t <= 1; t += 0.01) {
      const y = easeInOut(t);
      expect(y).toBeGreaterThanOrEqual(last - 1e-9);
      last = y;
    }
  });
});
