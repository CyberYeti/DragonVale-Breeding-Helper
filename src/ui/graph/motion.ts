// How graph nodes and the view move together: one duration and one easing
// for the nodes' CSS transform transition and the viewport's transition, so
// pulling a tree, going back and Reset arrangement read as one motion.

/** How long a move takes, in ms. GraphCanvas's `.moving` CSS transition uses the same. */
export const MOVE_MS = 600;

/** The CSS easing of a move. */
export const MOVE_EASING = 'ease-in-out';

/**
 * CSS `cubic-bezier(x1, y1, x2, y2)` as a function of time 0..1, for the
 * viewport transition to follow the nodes' CSS one.
 */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): (t: number) => number {
  // Each coordinate is a cubic in the curve parameter s: a*s^3 + b*s^2 + c*s.
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const xAt = (s: number) => ((ax * s + bx) * s + cx) * s;
  const yAt = (s: number) => ((ay * s + by) * s + cy) * s;
  const dxAt = (s: number) => (3 * ax * s + 2 * bx) * s + cx;
  return (t) => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    // Newton's method for the s where x(s) = t, then bisection if it stalls.
    let s = t;
    for (let i = 0; i < 8; i++) {
      const err = xAt(s) - t;
      if (Math.abs(err) < 1e-6) return yAt(s);
      const d = dxAt(s);
      if (Math.abs(d) < 1e-6) break;
      s -= err / d;
    }
    let lo = 0;
    let hi = 1;
    s = t;
    for (let i = 0; i < 30; i++) {
      if (xAt(s) < t) lo = s;
      else hi = s;
      s = (lo + hi) / 2;
    }
    return yAt(s);
  };
}

/** CSS `ease-in-out`. */
export const easeInOut = cubicBezier(0.42, 0, 0.58, 1);

/** The player asked for less motion: moves and fits jump. */
export function reducedMotion(): boolean {
  const { matchMedia } = globalThis as { matchMedia?: (query: string) => { matches: boolean } };
  return matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}
