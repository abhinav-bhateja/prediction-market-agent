import { describe, expect, it } from 'vitest';
import { kellyFractionBinary } from '../src/decision/kelly.js';

describe('kellyFractionBinary', () => {
  it('returns zero for negative edge scenarios', () => {
    const f = kellyFractionBinary(0.4, 2);
    expect(f).toBe(0);
  });

  it('returns positive fraction for positive edge scenarios', () => {
    const f = kellyFractionBinary(0.6, 2);
    expect(f).toBeGreaterThan(0);
    expect(f).toBeLessThanOrEqual(1);
  });

  it('caps at 1 when odds imply oversized fraction', () => {
    const f = kellyFractionBinary(0.99, 100);
    expect(f).toBeLessThanOrEqual(1);
  });
});
