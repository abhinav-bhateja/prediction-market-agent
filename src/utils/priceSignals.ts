import type { PricePoint } from '../types/domain.js';
import { clamp } from './math.js';

export const avg = (arr: number[]): number => {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
};

/**
 * Momentum: slope of a simple linear regression over recent prices, normalised to [-1, 1].
 * Positive = price trending up, negative = trending down.
 */
export function computeMomentum(history: PricePoint[]): number {
  if (history.length < 3) return 0;
  const n = history.length;
  const xs = history.map((_, i) => i);
  const ys = history.map((p) => p.price);
  const xMean = avg(xs);
  const yMean = avg(ys);
  const num = xs.reduce((s, x, i) => s + (x - xMean) * (ys[i] - yMean), 0);
  const den = xs.reduce((s, x) => s + (x - xMean) ** 2, 0);
  const slope = den === 0 ? 0 : num / den;
  return clamp(slope * n, -1, 1);
}

/**
 * Volatility: std-dev of price changes, scaled to [0, 1].
 * 0 = flat, 1 = very volatile (0.05 per-step move → ~1.0).
 */
export function computeVolatility(history: PricePoint[]): number {
  if (history.length < 2) return 0;
  const changes = history.slice(1).map((p, i) => p.price - history[i].price);
  const mean = avg(changes);
  const variance = avg(changes.map((c) => (c - mean) ** 2));
  return clamp(Math.sqrt(variance) * 20, 0, 1);
}
