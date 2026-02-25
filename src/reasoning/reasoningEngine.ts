import type { IngestedSnapshot, PricePoint, ReasoningResult } from '../types/domain.js';
import { clamp } from '../utils/math.js';
import { nowIso } from '../utils/time.js';
import { LlmClient } from './llmClient.js';

const avg = (arr: number[]): number => {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
};

/**
 * Momentum: slope of a simple linear regression over recent prices, normalised to [-1, 1].
 * Positive = price trending up (bullish), negative = trending down (bearish).
 */
function computeMomentum(history: PricePoint[]): number {
  if (history.length < 3) return 0;
  const n = history.length;
  const xs = history.map((_, i) => i);
  const ys = history.map((p) => p.price);
  const xMean = avg(xs);
  const yMean = avg(ys);
  const num = xs.reduce((s, x, i) => s + (x - xMean) * (ys[i] - yMean), 0);
  const den = xs.reduce((s, x) => s + (x - xMean) ** 2, 0);
  const slope = den === 0 ? 0 : num / den; // price change per step
  // Normalise: max plausible slope over n steps is ~1/n (full 0→1 move)
  return clamp(slope * n, -1, 1);
}

/**
 * Volatility: std-dev of price changes. High vol → lower confidence.
 * Returns a value in [0, 1] where 0 = flat, 1 = very volatile.
 */
function computeVolatility(history: PricePoint[]): number {
  if (history.length < 2) return 0;
  const changes = history.slice(1).map((p, i) => p.price - history[i].price);
  const mean = avg(changes);
  const variance = avg(changes.map((c) => (c - mean) ** 2));
  const stdDev = Math.sqrt(variance);
  return clamp(stdDev * 20, 0, 1); // scale: 0.05 daily move → 1.0
}

export class ReasoningEngine {
  constructor(private readonly llmClient = new LlmClient()) {}

  private buildPrompt(snapshot: IngestedSnapshot): string {
    const news = snapshot.news.slice(0, 10).map((n) => `- ${n.title} (${n.source})`).join('\n');
    const social = snapshot.social.slice(0, 10).map((s) => `- [${s.platform}] ${s.topic} (score=${s.sentimentScore.toFixed(2)})`).join('\n');
    const events = snapshot.events.slice(0, 10).map((e) => `- ${e.title} on ${e.date}`).join('\n');

    const momentum = computeMomentum(snapshot.priceHistory);
    const volatility = computeVolatility(snapshot.priceHistory);
    const priceHistorySummary = snapshot.priceHistory.length >= 2
      ? `Price history (${snapshot.priceHistory.length} points): momentum=${momentum.toFixed(3)}, volatility=${volatility.toFixed(3)}, oldest=${snapshot.priceHistory[0].price.toFixed(3)}, latest=${snapshot.priceHistory[snapshot.priceHistory.length - 1].price.toFixed(3)}`
      : 'Price history: unavailable';

    return [
      `Market Question: ${snapshot.market.question}`,
      `Current YES price: ${snapshot.market.yesPrice}`,
      `Current NO price: ${snapshot.market.noPrice}`,
      `Volume 24h: ${snapshot.market.volume24h}`,
      `Liquidity: ${snapshot.market.liquidity}`,
      priceHistorySummary,
      'News context:',
      news || '- none',
      'Social context:',
      social || '- none',
      'Event calendar context:',
      events || '- none',
      'Estimate fair probability for YES and confidence.'
    ].join('\n');
  }

  async analyze(snapshot: IngestedSnapshot): Promise<ReasoningResult> {
    const marketProbability = snapshot.market.yesPrice;
    const newsSignal = avg(snapshot.news.map((n) => (n.summary?.length ?? 0) > 160 ? 0.02 : 0));
    const socialSignal = avg(snapshot.social.map((s) => s.sentimentScore - 0.5));
    const eventSignal = avg(snapshot.events.map((e) => (e.relevanceScore - 0.5) * 0.1));

    const momentum = computeMomentum(snapshot.priceHistory);
    const volatility = computeVolatility(snapshot.priceHistory);
    // Momentum nudges estimate; weight scales with history length (max 0.08)
    const momentumWeight = Math.min(0.08, snapshot.priceHistory.length * 0.003);
    const momentumSignal = momentum * momentumWeight;

    const baseline = clamp(
      marketProbability + socialSignal * 0.25 + eventSignal + newsSignal + momentumSignal,
      0.01,
      0.99
    );
    // High volatility reduces confidence
    const baselineConfidence = clamp(
      0.45 + snapshot.news.length * 0.01 + snapshot.social.length * 0.008 - volatility * 0.15,
      0.3,
      0.8
    );

    const llm = await this.llmClient.estimateProbability(this.buildPrompt(snapshot));

    const estimated = llm ? clamp(baseline * 0.35 + llm.probabilityYes * 0.65, 0.01, 0.99) : baseline;
    const confidence = llm ? clamp(baselineConfidence * 0.4 + llm.confidence * 0.6, 0.1, 0.99) : baselineConfidence;

    const priceHistoryDrivers = snapshot.priceHistory.length >= 3
      ? [`Price momentum: ${momentum >= 0 ? '+' : ''}${(momentum * 100).toFixed(1)}%`, `Price volatility: ${(volatility * 100).toFixed(1)}%`]
      : [];

    return {
      marketId: snapshot.market.id,
      estimatedProbabilityYes: estimated,
      marketProbabilityYes: marketProbability,
      edge: estimated - marketProbability,
      confidence,
      rationale:
        llm?.rationale ??
        `Baseline estimate from market-implied odds plus signal blend. social=${socialSignal.toFixed(3)} event=${eventSignal.toFixed(3)} news=${newsSignal.toFixed(3)} momentum=${momentumSignal.toFixed(3)} volatility=${volatility.toFixed(3)}`,
      keyDrivers: llm?.keyDrivers ?? [
        'Market-implied probability',
        `Social sentiment sample (${snapshot.social.length})`,
        `News relevance sample (${snapshot.news.length})`,
        ...priceHistoryDrivers
      ],
      riskFlags: llm?.riskFlags ?? [
        snapshot.market.liquidity < 100000 ? 'Low liquidity' : 'Liquidity acceptable',
        confidence < 0.55 ? 'Model confidence below preferred threshold' : 'Confidence acceptable',
        volatility > 0.5 ? `High price volatility (${(volatility * 100).toFixed(0)}%)` : 'Volatility normal'
      ],
      createdAt: nowIso()
    };
  }
}
