import { describe, expect, it, vi, afterEach } from 'vitest';
import { MarketDataFetcher } from '../src/data/marketDataFetcher.js';

afterEach(() => vi.restoreAllMocks());

const mockFetch = (body: unknown, ok = true) => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok,
    status: ok ? 200 : 500,
    json: async () => body
  }));
};

const rawMarket = (overrides = {}) => ({
  id: 'mkt-1',
  question: 'Will X happen?',
  volume: 100000,
  liquidity: 500000,
  outcomePrices: [0.6, 0.4],
  endDate: '2025-12-31T00:00:00Z',
  tags: ['politics'],
  active: true,
  closed: false,
  ...overrides
});

const noRetry = { attempts: 1, baseDelayMs: 0 };

describe('MarketDataFetcher', () => {
  it('returns sample markets when API returns non-ok', async () => {
    mockFetch({}, false);
    const fetcher = new MarketDataFetcher(noRetry);
    const markets = await fetcher.getActiveMarkets();
    expect(markets.length).toBeGreaterThan(0);
    // Sample markets have known IDs
    expect(markets.some((m) => m.id.startsWith('mock-'))).toBe(true);
  });

  it('returns sample markets when fetch throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));
    const fetcher = new MarketDataFetcher(noRetry);
    const markets = await fetcher.getActiveMarkets();
    expect(markets.some((m) => m.id.startsWith('mock-'))).toBe(true);
  });

  it('parses market fields correctly', async () => {
    mockFetch([rawMarket()]);
    const fetcher = new MarketDataFetcher(noRetry);
    const [m] = await fetcher.getActiveMarkets();

    expect(m.id).toBe('mkt-1');
    expect(m.question).toBe('Will X happen?');
    expect(m.yesPrice).toBeCloseTo(0.6);
    expect(m.noPrice).toBeCloseTo(0.4);
    expect(m.volume24h).toBe(100000);
    expect(m.liquidity).toBe(500000);
    expect(m.tags).toEqual(['politics']);
    expect(m.isResolved).toBe(false);
  });

  it('filters out closed and inactive markets', async () => {
    mockFetch([
      rawMarket({ id: 'active', active: true, closed: false }),
      rawMarket({ id: 'closed', active: true, closed: true }),
      rawMarket({ id: 'inactive', active: false, closed: false })
    ]);
    const fetcher = new MarketDataFetcher(noRetry);
    const markets = await fetcher.getActiveMarkets();
    expect(markets).toHaveLength(1);
    expect(markets[0].id).toBe('active');
  });

  it('extracts clobTokenId from clobTokenIds array', async () => {
    mockFetch([rawMarket({ clobTokenIds: ['yes-token-123', 'no-token-456'] })]);
    const fetcher = new MarketDataFetcher(noRetry);
    const [m] = await fetcher.getActiveMarkets();
    expect(m.clobTokenId).toBe('yes-token-123');
  });

  it('extracts clobTokenId from tokens array (YES outcome)', async () => {
    mockFetch([rawMarket({
      tokens: [
        { token_id: 'no-tok', outcome: 'No' },
        { token_id: 'yes-tok', outcome: 'Yes' }
      ]
    })]);
    const fetcher = new MarketDataFetcher(noRetry);
    const [m] = await fetcher.getActiveMarkets();
    expect(m.clobTokenId).toBe('yes-tok');
  });

  it('prefers clobTokenIds over tokens array', async () => {
    mockFetch([rawMarket({
      clobTokenIds: ['preferred-yes'],
      tokens: [{ token_id: 'fallback-yes', outcome: 'Yes' }]
    })]);
    const fetcher = new MarketDataFetcher(noRetry);
    const [m] = await fetcher.getActiveMarkets();
    expect(m.clobTokenId).toBe('preferred-yes');
  });

  it('sets clobTokenId to undefined when neither field present', async () => {
    mockFetch([rawMarket()]);
    const fetcher = new MarketDataFetcher(noRetry);
    const [m] = await fetcher.getActiveMarkets();
    expect(m.clobTokenId).toBeUndefined();
  });

  it('respects limit parameter', async () => {
    const many = Array.from({ length: 20 }, (_, i) => rawMarket({ id: `m${i}` }));
    mockFetch(many);
    const fetcher = new MarketDataFetcher(noRetry);
    const markets = await fetcher.getActiveMarkets(5);
    expect(markets).toHaveLength(5);
  });

  it('falls back to sample markets when API returns empty array', async () => {
    mockFetch([]);
    const fetcher = new MarketDataFetcher(noRetry);
    const markets = await fetcher.getActiveMarkets();
    expect(markets.some((m) => m.id.startsWith('mock-'))).toBe(true);
  });

  it('defaults yesPrice to 0.5 when outcomePrices missing', async () => {
    mockFetch([rawMarket({ outcomePrices: undefined })]);
    const fetcher = new MarketDataFetcher(noRetry);
    const [m] = await fetcher.getActiveMarkets();
    expect(m.yesPrice).toBe(0.5);
  });
});
