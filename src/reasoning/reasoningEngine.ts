import type { IngestedSnapshot, ReasoningResult } from '../types/domain.js';
import { clamp } from '../utils/math.js';
import { nowIso } from '../utils/time.js';
import { LlmClient } from './llmClient.js';

const avg = (arr: number[]): number => {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
};

export class ReasoningEngine {
  constructor(private readonly llmClient = new LlmClient()) {}

  private buildPrompt(snapshot: IngestedSnapshot): string {
    const news = snapshot.news.slice(0, 10).map((n) => `- ${n.title} (${n.source})`).join('\n');
    const social = snapshot.social.slice(0, 10).map((s) => `- [${s.platform}] ${s.topic} (score=${s.sentimentScore.toFixed(2)})`).join('\n');
    const events = snapshot.events.slice(0, 10).map((e) => `- ${e.title} on ${e.date}`).join('\n');

    return [
      `Market Question: ${snapshot.market.question}`,
      `Current YES price: ${snapshot.market.yesPrice}`,
      `Current NO price: ${snapshot.market.noPrice}`,
      `Volume 24h: ${snapshot.market.volume24h}`,
      `Liquidity: ${snapshot.market.liquidity}`,
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

    const baseline = clamp(marketProbability + socialSignal * 0.25 + eventSignal + newsSignal, 0.01, 0.99);
    const baselineConfidence = clamp(0.45 + snapshot.news.length * 0.01 + snapshot.social.length * 0.008, 0.3, 0.8);

    const llm = await this.llmClient.estimateProbability(this.buildPrompt(snapshot));

    const estimated = llm ? clamp(baseline * 0.35 + llm.probabilityYes * 0.65, 0.01, 0.99) : baseline;
    const confidence = llm ? clamp(baselineConfidence * 0.4 + llm.confidence * 0.6, 0.1, 0.99) : baselineConfidence;

    return {
      marketId: snapshot.market.id,
      estimatedProbabilityYes: estimated,
      marketProbabilityYes: marketProbability,
      edge: estimated - marketProbability,
      confidence,
      rationale:
        llm?.rationale ??
        `Baseline estimate from market-implied odds plus social/news/event signal blend. social=${socialSignal.toFixed(3)} event=${eventSignal.toFixed(3)} news=${newsSignal.toFixed(3)}`,
      keyDrivers: llm?.keyDrivers ?? [
        'Market-implied probability',
        `Social sentiment sample (${snapshot.social.length})`,
        `News relevance sample (${snapshot.news.length})`
      ],
      riskFlags: llm?.riskFlags ?? [
        snapshot.market.liquidity < 100000 ? 'Low liquidity' : 'Liquidity acceptable',
        confidence < 0.55 ? 'Model confidence below preferred threshold' : 'Confidence acceptable'
      ],
      createdAt: nowIso()
    };
  }
}
