import { describe, expect, it, vi, afterEach } from 'vitest';
import { PriceHistoryFetcher } from '../src/data/priceHistoryFetcher.js';

afterEach(() => vi.restoreAllMocks());

const noRetry = { attempts: 1, baseDelayMs: 0 };

const mockFetch = (body: unknown, ok = true) => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok,
    status: ok ? 200 : 500,
    json: async () => body
  }));
};

describe('PriceHistoryFetcher', () => {
  it('returns empty array when clobTokenId is empty string', async () => {
    mockFetch({ history: [] });
    const fetcher = new PriceHistoryFetcher(noRetry);
    const result = await fetcher.fetch('');
    expect(result).toEqual([]);
  });

  it('parses history entries into PricePoints', async () => {
    mockFetch({
      history: [
        { t: 1700000000, p: 0.45 },
        { t: 1700003600, p: 0.50 },
        { t: 1700007200, p: 0.55 }
      ]
    });
    const fetcher = new PriceHistoryFetcher(noRetry);
    const result = await fetcher.fetch('token-abc');

    expect(result).toHaveLength(3);
    expect(result[0].price).toBe(0.45);
    expect(result[1].price).toBe(0.50);
    expect(result[2].price).toBe(0.55);
    expect(result[0].timestamp).toBe(new Date(1700000000 * 1000).toISOString());
  });

  it('returns empty array when API returns non-ok status', async () => {
    mockFetch({}, false);
    const fetcher = new PriceHistoryFetcher(noRetry);
    const result = await fetcher.fetch('token-abc');
    expect(result).toEqual([]);
  });

  it('returns empty array when history field is missing', async () => {
    mockFetch({});
    const fetcher = new PriceHistoryFetcher(noRetry);
    const result = await fetcher.fetch('token-abc');
    expect(result).toEqual([]);
  });

  it('returns empty array when fetch throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')));
    const fetcher = new PriceHistoryFetcher(noRetry);
    const result = await fetcher.fetch('token-abc');
    expect(result).toEqual([]);
  });

  it('passes interval and fidelity params in URL', async () => {
    const spy = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ history: [] }) });
    vi.stubGlobal('fetch', spy);
    const fetcher = new PriceHistoryFetcher(noRetry);
    await fetcher.fetch('tok123', '6h', 48);

    const calledUrl: string = spy.mock.calls[0][0];
    expect(calledUrl).toContain('interval=6h');
    expect(calledUrl).toContain('fidelity=48');
    expect(calledUrl).toContain('tokenID=tok123');
  });

  it('handles empty history array gracefully', async () => {
    mockFetch({ history: [] });
    const fetcher = new PriceHistoryFetcher(noRetry);
    const result = await fetcher.fetch('token-abc');
    expect(result).toEqual([]);
  });
});
