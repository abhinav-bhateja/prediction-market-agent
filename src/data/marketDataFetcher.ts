import { config } from '../config/index.js';
import type { Market } from '../types/domain.js';
import { fetchWithRetry, type RetryOptions } from '../utils/retry.js';

interface PolymarketRawMarket {
  id?: string;
  slug?: string;
  question?: string;
  volume?: number;
  liquidity?: number;
  outcomePrices?: number[];
  endDate?: string;
  tags?: string[];
  active?: boolean;
  closed?: boolean;
  clobTokenIds?: string[]; // [yesTokenId, noTokenId]
  tokens?: Array<{ token_id?: string; outcome?: string }>;
}

const sampleMarkets: Market[] = [
  {
    id: 'mock-us-election-2028',
    question: 'Will Candidate X win the 2028 US election?',
    yesPrice: 0.43,
    noPrice: 0.57,
    volume24h: 550000,
    liquidity: 1800000,
    tags: ['politics', 'us'],
    eventDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365).toISOString(),
    isResolved: false
  },
  {
    id: 'mock-fed-cut-june',
    question: 'Will the Fed cut rates by June?',
    yesPrice: 0.61,
    noPrice: 0.39,
    volume24h: 210000,
    liquidity: 900000,
    tags: ['macro', 'rates'],
    eventDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 120).toISOString(),
    isResolved: false
  }
];

export class MarketDataFetcher {
  constructor(private readonly retryOpts: RetryOptions = { attempts: 3, baseDelayMs: 1000 }) {}

  async getActiveMarkets(limit = 20): Promise<Market[]> {
    const url = `${config.POLYMARKET_API_BASE_URL}/markets?closed=false&limit=${limit}`;

    try {
      const res = await fetchWithRetry(
        url,
        { headers: config.POLYMARKET_API_KEY ? { Authorization: `Bearer ${config.POLYMARKET_API_KEY}` } : undefined },
        this.retryOpts
      );

      if (!res.ok) return sampleMarkets;

      const data = (await res.json()) as PolymarketRawMarket[];
      const parsed = data
        .filter((m) => m.active !== false && m.closed !== true && m.question)
        .map<Market>((m) => {
          const yes = Number(m.outcomePrices?.[0] ?? 0.5);
          const no = Number(m.outcomePrices?.[1] ?? 1 - yes);

          // Extract YES token ID — try clobTokenIds array first, then tokens array
          const clobTokenId =
            m.clobTokenIds?.[0] ??
            m.tokens?.find((t) => t.outcome?.toUpperCase() === 'YES')?.token_id ??
            undefined;

          return {
            id: m.id ?? m.slug ?? crypto.randomUUID(),
            question: m.question ?? 'Unknown market',
            yesPrice: yes,
            noPrice: no,
            volume24h: Number(m.volume ?? 0),
            liquidity: Number(m.liquidity ?? 0),
            eventDate: m.endDate,
            tags: m.tags ?? [],
            isResolved: m.closed ?? false,
            clobTokenId
          };
        })
        .slice(0, limit);

      return parsed.length ? parsed : sampleMarkets;
    } catch {
      return sampleMarkets;
    }
  }
}
