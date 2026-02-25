import { describe, expect, it } from 'vitest';
import { RiskManager } from '../src/decision/riskManager.js';
import type { Position } from '../src/types/domain.js';

const pos = (marketId: string, quantity: number, markPrice: number): Position => ({
  marketId,
  side: 'YES',
  quantity,
  avgPrice: markPrice,
  markPrice,
  unrealizedPnl: 0,
  realizedPnl: 0,
  updatedAt: new Date().toISOString()
});

describe('RiskManager', () => {
  it('allows full proposed size when no constraints triggered', () => {
    const rm = new RiskManager();
    const result = rm.check({ bankrollUsd: 10000, proposedSizeUsd: 100, existingPositions: [] });
    expect(result.allowedSizeUsd).toBe(100);
    expect(result.constraintsApplied).toHaveLength(0);
  });

  it('caps by max position pct (default 10%)', () => {
    const rm = new RiskManager();
    // Propose 20% of bankroll — should be capped at 10%
    const result = rm.check({ bankrollUsd: 10000, proposedSizeUsd: 2000, existingPositions: [] });
    expect(result.allowedSizeUsd).toBe(1000);
    expect(result.constraintsApplied.some((c) => c.includes('max position pct'))).toBe(true);
  });

  it('caps by portfolio exposure when existing positions fill most of the limit', () => {
    const rm = new RiskManager();
    // Existing exposure: 4500 (45% of 10k). Max is 50% = 5000. Remaining = 500.
    const existing = [pos('m1', 100, 45)]; // 100 * 45 = 4500
    const result = rm.check({ bankrollUsd: 10000, proposedSizeUsd: 1000, existingPositions: existing });
    expect(result.allowedSizeUsd).toBeLessThanOrEqual(500);
    expect(result.constraintsApplied.some((c) => c.includes('portfolio exposure'))).toBe(true);
  });

  it('blocks trade when portfolio is fully exposed', () => {
    const rm = new RiskManager();
    // Existing exposure: 5000 = 50% of 10k. No room left.
    const existing = [pos('m1', 100, 50)];
    const result = rm.check({ bankrollUsd: 10000, proposedSizeUsd: 500, existingPositions: existing });
    expect(result.allowedSizeUsd).toBe(0);
  });

  it('blocks trade below minimum executable size ($1)', () => {
    const rm = new RiskManager();
    const result = rm.check({ bankrollUsd: 10000, proposedSizeUsd: 0.5, existingPositions: [] });
    expect(result.allowedSizeUsd).toBe(0);
    expect(result.constraintsApplied.some((c) => c.includes('minimum'))).toBe(true);
  });

  it('applies multiple constraints in order', () => {
    const rm = new RiskManager();
    // Propose 15% of bankroll with 45% already exposed
    const existing = [pos('m1', 100, 45)];
    const result = rm.check({ bankrollUsd: 10000, proposedSizeUsd: 1500, existingPositions: existing });
    // First capped to 1000 (max position), then to 500 (remaining exposure)
    expect(result.allowedSizeUsd).toBeLessThanOrEqual(500);
    expect(result.constraintsApplied.length).toBeGreaterThanOrEqual(2);
  });
});
