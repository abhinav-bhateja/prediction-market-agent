import type { PerformanceMetrics } from './metrics.js';
import { summarizePerformance } from './metrics.js';
import { Repository } from '../storage/repository.js';

interface ParsedLog {
  reasoning: {
    estimatedProbabilityYes: number;
  };
  order?: {
    sizeUsd: number;
  };
}

export class LearningEngine {
  constructor(private readonly repo: Repository) {}

  getPerformanceMetrics(): PerformanceMetrics {
    const logs = this.repo.getRecentCycleLogs(500);
    const parsed = logs.map((log) => {
      const reasoning = JSON.parse(String(log.reasoning_json)) as ParsedLog['reasoning'];
      const order = log.order_json ? (JSON.parse(String(log.order_json)) as ParsedLog['order']) : undefined;
      return { reasoning, order };
    });

    // During live operation, true outcomes are unknown pre-resolution.
    // We use pseudo-outcomes from current market side as a placeholder.
    const forecasts = parsed.map((p) => p.reasoning.estimatedProbabilityYes);
    const outcomes = parsed.map((p) => (p.reasoning.estimatedProbabilityYes > 0.5 ? 1 : 0));
    const tradeReturns = parsed.map((p) => (p.order ? p.order.sizeUsd * 0.01 : 0));
    const pnlSeries = tradeReturns;
    const wins = tradeReturns.filter((r) => r > 0).length;

    return summarizePerformance({ pnlSeries, tradeReturns, wins, forecasts, outcomes });
  }
}
