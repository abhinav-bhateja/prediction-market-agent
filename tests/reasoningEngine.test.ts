import { describe, expect, it } from 'vitest';
import { ReasoningEngine } from '../src/reasoning/reasoningEngine.js';
import type { IngestedSnapshot, PricePoint } from '../src/types/domain.js';

// Null LLM — forces heuristic path
const nullLlm = { isEnabled: () => false, estimateProbability: async () => null };

const market = (yesPrice = 0.5) => ({
  id: 'm1',
  question: 'Will X happen?',
  yesPrice,
  noPrice: 1 - yesPrice,
  volume24h: 200000,
  liquidity: 800000,
  tags: ['politics'],
  isResolved: false
});

const pts = (prices: number[]): PricePoint[] =>
  prices.map((price, i) => ({ price, timestamp: new Date(i * 3600000).toISOString() }));

const snap = (overrides: Partial<IngestedSnapshot> = {}): IngestedSnapshot => ({
  timestamp: new Date().toISOString(),
  market: market(),
  news: [],
  social: [],
  events: [],
  priceHistory: [],
  ...overrides
});

describe('ReasoningEngine (heuristic path, no LLM)', () => {
  it('returns estimate close to market price when no signals', async () => {
    const engine = new ReasoningEngine(nullLlm as never);
    const result = await engine.analyze(snap());
    // With no signals, estimate should be within 0.05 of market price
    expect(Math.abs(result.estimatedProbabilityYes - 0.5)).toBeLessThan(0.05);
  });

  it('nudges estimate up for rising price history', async () => {
    const engine = new ReasoningEngine(nullLlm as never);
    const flat = await engine.analyze(snap({ priceHistory: pts([0.5, 0.5, 0.5, 0.5, 0.5]) }));
    const rising = await engine.analyze(snap({ priceHistory: pts([0.3, 0.4, 0.5, 0.6, 0.7]) }));
    expect(rising.estimatedProbabilityYes).toBeGreaterThan(flat.estimatedProbabilityYes);
  });

  it('nudges estimate down for falling price history', async () => {
    const engine = new ReasoningEngine(nullLlm as never);
    const flat = await engine.analyze(snap({ priceHistory: pts([0.5, 0.5, 0.5, 0.5, 0.5]) }));
    const falling = await engine.analyze(snap({ priceHistory: pts([0.7, 0.6, 0.5, 0.4, 0.3]) }));
    expect(falling.estimatedProbabilityYes).toBeLessThan(flat.estimatedProbabilityYes);
  });

  it('reduces confidence for high-volatility price history', async () => {
    const engine = new ReasoningEngine(nullLlm as never);
    const stable = await engine.analyze(snap({ priceHistory: pts([0.5, 0.51, 0.5, 0.51, 0.5]) }));
    const volatile = await engine.analyze(snap({ priceHistory: pts([0.2, 0.8, 0.1, 0.9, 0.2]) }));
    expect(volatile.confidence).toBeLessThan(stable.confidence);
  });

  it('edge equals estimated minus market probability', async () => {
    const engine = new ReasoningEngine(nullLlm as never);
    const result = await engine.analyze(snap({ market: market(0.4) }));
    expect(result.edge).toBeCloseTo(result.estimatedProbabilityYes - result.marketProbabilityYes, 10);
  });

  it('blends LLM result when provided', async () => {
    const llmEstimate = 0.8;
    const mockLlm = {
      isEnabled: () => true,
      estimateProbability: async () => ({
        probabilityYes: llmEstimate,
        confidence: 0.9,
        rationale: 'test',
        keyDrivers: [],
        riskFlags: []
      })
    };
    const engine = new ReasoningEngine(mockLlm as never);
    const result = await engine.analyze(snap());
    // LLM weight is 0.65, so estimate should be pulled toward 0.8
    expect(result.estimatedProbabilityYes).toBeGreaterThan(0.6);
  });

  it('includes price history drivers in keyDrivers when history available', async () => {
    const engine = new ReasoningEngine(nullLlm as never);
    const result = await engine.analyze(snap({ priceHistory: pts([0.4, 0.5, 0.6, 0.7, 0.8]) }));
    const hasMomentum = result.keyDrivers.some((d) => d.toLowerCase().includes('momentum'));
    expect(hasMomentum).toBe(true);
  });

  it('flags high volatility in riskFlags', async () => {
    const engine = new ReasoningEngine(nullLlm as never);
    const result = await engine.analyze(snap({ priceHistory: pts([0.1, 0.9, 0.1, 0.9, 0.1]) }));
    const hasVolFlag = result.riskFlags.some((f) => f.toLowerCase().includes('volatility'));
    expect(hasVolFlag).toBe(true);
  });

  it('clamps estimate to [0.01, 0.99]', async () => {
    const engine = new ReasoningEngine(nullLlm as never);
    // Extreme social signals pushing toward 0 or 1
    const extremeSocial = Array.from({ length: 20 }, (_, i) => ({
      id: `s${i}`, platform: 'REDDIT' as const, topic: 'test',
      sentimentScore: 1.0, confidence: 0.9, observedAt: new Date().toISOString()
    }));
    const result = await engine.analyze(snap({ social: extremeSocial }));
    expect(result.estimatedProbabilityYes).toBeGreaterThanOrEqual(0.01);
    expect(result.estimatedProbabilityYes).toBeLessThanOrEqual(0.99);
  });
});
