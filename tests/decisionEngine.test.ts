import { describe, expect, it } from 'vitest';
import { DecisionEngine } from '../src/decision/decisionEngine.js';
import type { ReasoningResult } from '../src/types/domain.js';

const reasoning = (overrides: Partial<ReasoningResult> = {}): ReasoningResult => ({
  marketId: 'm1',
  estimatedProbabilityYes: 0.62,
  marketProbabilityYes: 0.5,
  edge: 0.12,
  confidence: 0.7,
  rationale: 'test',
  keyDrivers: [],
  riskFlags: [],
  createdAt: new Date().toISOString(),
  ...overrides
});

describe('DecisionEngine', () => {
  it('holds when edge is below threshold', () => {
    const engine = new DecisionEngine();
    const result = engine.decide(reasoning({ edge: 0.01 }), 10000, []);

    expect(result.action).toBe('HOLD');
    expect(result.sizeUsd).toBe(0);
  });

  it('buys when edge clears threshold and risk allows', () => {
    const engine = new DecisionEngine();
    const result = engine.decide(reasoning({ edge: 0.2, estimatedProbabilityYes: 0.7 }), 10000, []);

    expect(result.action).toBe('BUY');
    expect(result.sizeUsd).toBeGreaterThan(0);
  });

  it('caps position by risk limits', () => {
    const engine = new DecisionEngine();
    const result = engine.decide(reasoning({ edge: 0.45, estimatedProbabilityYes: 0.95 }), 10000, []);

    expect(result.sizeUsd).toBeLessThanOrEqual(1000);
  });
});
