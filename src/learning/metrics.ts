import { safeDivide } from '../utils/math.js';

export interface PerformanceMetrics {
  totalTrades: number;
  winRate: number;
  roi: number;
  sharpe: number;
  brierScore: number;
  calibrationError: number;
}

const stdDev = (values: number[]): number => {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
};

export const calculateSharpe = (returns: number[], riskFree = 0): number => {
  if (!returns.length) return 0;
  const excess = returns.map((r) => r - riskFree);
  const mean = excess.reduce((a, b) => a + b, 0) / excess.length;
  const sigma = stdDev(excess);
  return sigma === 0 ? 0 : mean / sigma;
};

export const brierScore = (forecasts: number[], outcomes: number[]): number => {
  if (!forecasts.length || forecasts.length !== outcomes.length) return 0;
  const total = forecasts.reduce((acc, p, i) => acc + (p - outcomes[i]) ** 2, 0);
  return total / forecasts.length;
};

export const calibrationError = (forecasts: number[], outcomes: number[]): number => {
  if (!forecasts.length || forecasts.length !== outcomes.length) return 0;
  const bins = 10;
  let weightedError = 0;

  for (let i = 0; i < bins; i++) {
    const low = i / bins;
    const high = (i + 1) / bins;
    const idx = forecasts
      .map((p, n) => ({ p, n }))
      .filter((x) => (x.p >= low && x.p < high) || (i === bins - 1 && x.p === 1))
      .map((x) => x.n);

    if (!idx.length) continue;
    const avgForecast = idx.reduce((acc, n) => acc + forecasts[n], 0) / idx.length;
    const empirical = idx.reduce((acc, n) => acc + outcomes[n], 0) / idx.length;
    weightedError += (idx.length / forecasts.length) * Math.abs(avgForecast - empirical);
  }

  return weightedError;
};

export const summarizePerformance = (args: {
  pnlSeries: number[];
  tradeReturns: number[];
  wins: number;
  forecasts: number[];
  outcomes: number[];
}): PerformanceMetrics => {
  const totalTrades = args.tradeReturns.length;
  const totalPnl = args.pnlSeries.reduce((a, b) => a + b, 0);
  const deployed = args.tradeReturns.reduce((a, b) => a + Math.abs(b), 0) || 1;

  return {
    totalTrades,
    winRate: safeDivide(args.wins, totalTrades),
    roi: totalPnl / deployed,
    sharpe: calculateSharpe(args.tradeReturns),
    brierScore: brierScore(args.forecasts, args.outcomes),
    calibrationError: calibrationError(args.forecasts, args.outcomes)
  };
};
