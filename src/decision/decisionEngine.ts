import { config } from '../config/index.js';
import type { DecisionResult, MarketSide, Position, ReasoningResult } from '../types/domain.js';
import { nowIso } from '../utils/time.js';
import { kellyFractionBinary } from './kelly.js';
import { RiskManager } from './riskManager.js';

export class DecisionEngine {
  constructor(private readonly riskManager = new RiskManager()) {}

  decide(reasoning: ReasoningResult, bankrollUsd: number, existingPositions: Position[]): DecisionResult {
    const absEdge = Math.abs(reasoning.edge);
    const side: MarketSide = reasoning.edge >= 0 ? 'YES' : 'NO';

    if (absEdge < config.MIN_EDGE_THRESHOLD) {
      return {
        marketId: reasoning.marketId,
        action: 'HOLD',
        side,
        sizeUsd: 0,
        edge: reasoning.edge,
        confidence: reasoning.confidence,
        kellyFraction: 0,
        reason: `Edge ${absEdge.toFixed(4)} below threshold ${config.MIN_EDGE_THRESHOLD}`,
        constraintsApplied: ['Min edge filter'],
        createdAt: nowIso()
      };
    }

    const probWin = side === 'YES' ? reasoning.estimatedProbabilityYes : 1 - reasoning.estimatedProbabilityYes;
    const marketProb = side === 'YES' ? reasoning.marketProbabilityYes : 1 - reasoning.marketProbabilityYes;

    const payoutOdds = marketProb <= 0 ? 1 : 1 / marketProb;
    const fullKelly = kellyFractionBinary(probWin, payoutOdds);
    const fractionalKelly = fullKelly * config.KELLY_FRACTION;
    const proposedSize = bankrollUsd * fractionalKelly;

    const risk = this.riskManager.check({
      bankrollUsd,
      proposedSizeUsd: proposedSize,
      existingPositions
    });

    if (risk.allowedSizeUsd <= 0) {
      return {
        marketId: reasoning.marketId,
        action: 'HOLD',
        side,
        sizeUsd: 0,
        edge: reasoning.edge,
        confidence: reasoning.confidence,
        kellyFraction: fractionalKelly,
        reason: 'Risk constraints blocked trade',
        constraintsApplied: risk.constraintsApplied,
        createdAt: nowIso()
      };
    }

    return {
      marketId: reasoning.marketId,
      action: 'BUY',
      side,
      sizeUsd: risk.allowedSizeUsd,
      edge: reasoning.edge,
      confidence: reasoning.confidence,
      kellyFraction: fractionalKelly,
      reason: `Edge ${absEdge.toFixed(4)} passed threshold; fractional Kelly ${fractionalKelly.toFixed(4)}`,
      constraintsApplied: risk.constraintsApplied,
      createdAt: nowIso()
    };
  }
}
