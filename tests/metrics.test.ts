import { describe, expect, it } from 'vitest';
import { calculateSharpe, brierScore, calibrationError, summarizePerformance } from '../src/learning/metrics.js';

describe('calculateSharpe', () => {
  it('returns 0 for empty returns', () => {
    expect(calculateSharpe([])).toBe(0);
  });

  it('returns 0 when all returns are equal (zero std dev)', () => {
    expect(calculateSharpe([0.01, 0.01, 0.01])).toBe(0);
  });

  it('returns positive for consistently positive returns', () => {
    const s = calculateSharpe([0.05, 0.06, 0.04, 0.07, 0.05]);
    expect(s).toBeGreaterThan(0);
  });

  it('returns negative for consistently negative returns', () => {
    const s = calculateSharpe([-0.05, -0.06, -0.04, -0.07]);
    expect(s).toBeLessThan(0);
  });
});

describe('brierScore', () => {
  it('returns 0 for empty inputs', () => {
    expect(brierScore([], [])).toBe(0);
  });

  it('returns 0 for perfect forecasts', () => {
    expect(brierScore([1, 0, 1], [1, 0, 1])).toBeCloseTo(0);
  });

  it('returns 1 for worst-case forecasts', () => {
    expect(brierScore([1, 0], [0, 1])).toBeCloseTo(1);
  });

  it('returns 0.25 for uninformative 0.5 forecasts', () => {
    expect(brierScore([0.5, 0.5, 0.5, 0.5], [1, 0, 1, 0])).toBeCloseTo(0.25);
  });

  it('returns 0 for mismatched lengths', () => {
    expect(brierScore([0.5, 0.5], [1])).toBe(0);
  });
});

describe('calibrationError', () => {
  it('returns 0 for empty inputs', () => {
    expect(calibrationError([], [])).toBe(0);
  });

  it('returns low error for well-calibrated forecasts', () => {
    // 10 forecasts of 0.7, 7 of which resolve YES → perfectly calibrated
    const forecasts = Array(10).fill(0.7);
    const outcomes = [...Array(7).fill(1), ...Array(3).fill(0)];
    expect(calibrationError(forecasts, outcomes)).toBeCloseTo(0, 5);
  });

  it('returns higher error for poorly calibrated forecasts', () => {
    // Forecast 0.9 but only 10% resolve YES
    const forecasts = Array(10).fill(0.9);
    const outcomes = [1, ...Array(9).fill(0)];
    const err = calibrationError(forecasts, outcomes);
    expect(err).toBeGreaterThan(0.5);
  });
});

describe('summarizePerformance', () => {
  it('returns zero metrics for empty inputs', () => {
    const m = summarizePerformance({ pnlSeries: [], tradeReturns: [], wins: 0, forecasts: [], outcomes: [] });
    expect(m.totalTrades).toBe(0);
    expect(m.winRate).toBe(0);
    expect(m.roi).toBe(0);
  });

  it('computes winRate correctly', () => {
    const m = summarizePerformance({
      pnlSeries: [10, -5, 10],
      tradeReturns: [10, -5, 10],
      wins: 2,
      forecasts: [0.6, 0.4, 0.7],
      outcomes: [1, 0, 1]
    });
    expect(m.totalTrades).toBe(3);
    expect(m.winRate).toBeCloseTo(2 / 3);
  });
});
