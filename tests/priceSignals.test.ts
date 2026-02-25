import { describe, expect, it } from 'vitest';
import { computeMomentum, computeVolatility } from '../src/utils/priceSignals.js';
import type { PricePoint } from '../src/types/domain.js';

const pts = (prices: number[]): PricePoint[] =>
  prices.map((price, i) => ({ price, timestamp: new Date(i * 3600000).toISOString() }));

describe('computeMomentum', () => {
  it('returns 0 for fewer than 3 points', () => {
    expect(computeMomentum(pts([0.5, 0.6]))).toBe(0);
    expect(computeMomentum([])).toBe(0);
  });

  it('returns positive value for steadily rising prices', () => {
    const m = computeMomentum(pts([0.3, 0.4, 0.5, 0.6, 0.7]));
    expect(m).toBeGreaterThan(0);
  });

  it('returns negative value for steadily falling prices', () => {
    const m = computeMomentum(pts([0.7, 0.6, 0.5, 0.4, 0.3]));
    expect(m).toBeLessThan(0);
  });

  it('returns ~0 for flat prices', () => {
    const m = computeMomentum(pts([0.5, 0.5, 0.5, 0.5]));
    expect(Math.abs(m)).toBeLessThan(0.001);
  });

  it('clamps output to [-1, 1]', () => {
    // Extreme move: 0 → 1 in 3 steps
    const m = computeMomentum(pts([0, 0.5, 1]));
    expect(m).toBeGreaterThanOrEqual(-1);
    expect(m).toBeLessThanOrEqual(1);
  });
});

describe('computeVolatility', () => {
  it('returns 0 for fewer than 2 points', () => {
    expect(computeVolatility(pts([0.5]))).toBe(0);
    expect(computeVolatility([])).toBe(0);
  });

  it('returns 0 for perfectly flat prices', () => {
    expect(computeVolatility(pts([0.5, 0.5, 0.5, 0.5]))).toBe(0);
  });

  it('returns higher value for more volatile prices', () => {
    const stable = computeVolatility(pts([0.5, 0.51, 0.5, 0.51]));
    const volatile = computeVolatility(pts([0.3, 0.7, 0.2, 0.8]));
    expect(volatile).toBeGreaterThan(stable);
  });

  it('clamps output to [0, 1]', () => {
    const v = computeVolatility(pts([0, 1, 0, 1, 0, 1]));
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThanOrEqual(1);
  });
});
