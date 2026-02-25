import type { PricePoint } from '../types/domain.js';
import { config } from '../config/index.js';
import { fetchWithRetry, type RetryOptions } from '../utils/retry.js';
import { logger } from '../utils/logger.js';

interface ClobHistoryEntry {
  t: number; // unix timestamp
  p: number; // price
}

interface ClobHistoryResponse {
  history?: ClobHistoryEntry[];
}

/**
 * Fetches recent YES-outcome price history from the Polymarket CLOB API.
 * Returns an empty array on any failure — callers treat missing history gracefully.
 */
export class PriceHistoryFetcher {
  constructor(private readonly retryOpts: RetryOptions = { attempts: 2, baseDelayMs: 500 }) {}

  async fetch(clobTokenId: string, interval = '1h', fidelity = 24): Promise<PricePoint[]> {
    const url = `${config.POLYMARKET_API_BASE_URL}/prices-history?tokenID=${encodeURIComponent(clobTokenId)}&interval=${interval}&fidelity=${fidelity}`;

    try {
      const res = await fetchWithRetry(
        url,
        { headers: config.POLYMARKET_API_KEY ? { Authorization: `Bearer ${config.POLYMARKET_API_KEY}` } : undefined },
        this.retryOpts
      );

      if (!res.ok) return [];

      const data = (await res.json()) as ClobHistoryResponse;
      const entries = data.history ?? [];

      return entries.map((e) => ({
        timestamp: new Date(e.t * 1000).toISOString(),
        price: e.p
      }));
    } catch (err) {
      logger.debug('Price history fetch failed', { clobTokenId, err });
      return [];
    }
  }
}
