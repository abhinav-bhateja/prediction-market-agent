import { describe, expect, it, vi, afterEach } from 'vitest';
import { SocialSentimentScraper } from '../src/data/socialSentimentScraper.js';

afterEach(() => vi.restoreAllMocks());

const redditListing = (posts: Array<{ id: string; title: string; score: number; permalink?: string; created_utc?: number }>) => ({
  data: {
    children: posts.map((p) => ({
      data: {
        id: p.id,
        title: p.title,
        score: p.score,
        permalink: p.permalink ?? `/r/test/comments/${p.id}`,
        created_utc: p.created_utc ?? 1700000000
      }
    }))
  }
});

const mockFetch = (body: unknown, ok = true) => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok,
    status: ok ? 200 : 500,
    json: async () => body
  }));
};

describe('SocialSentimentScraper', () => {
  it('always includes X placeholder signal', async () => {
    mockFetch(redditListing([]));
    const scraper = new SocialSentimentScraper(['politics']);
    const signals = await scraper.fetchSignals();
    const xSignal = signals.find((s) => s.platform === 'X');
    expect(xSignal).toBeDefined();
    expect(xSignal!.sentimentScore).toBe(0.5);
    expect(xSignal!.confidence).toBe(0.1);
  });

  it('parses reddit posts into signals', async () => {
    mockFetch(redditListing([
      { id: 'abc', title: 'Big news today', score: 1000, created_utc: 1700000000 }
    ]));
    const scraper = new SocialSentimentScraper(['politics']);
    const signals = await scraper.fetchSignals();
    const reddit = signals.filter((s) => s.platform === 'REDDIT');

    expect(reddit).toHaveLength(1);
    expect(reddit[0].id).toBe('reddit:abc');
    expect(reddit[0].topic).toBe('Big news today');
    expect(reddit[0].sentimentScore).toBeGreaterThan(0);
    expect(reddit[0].sentimentScore).toBeLessThanOrEqual(1);
    expect(reddit[0].url).toContain('/r/test/comments/abc');
    expect(reddit[0].observedAt).toBe(new Date(1700000000 * 1000).toISOString());
  });

  it('normalizes score: 0 or negative → 0', async () => {
    mockFetch(redditListing([
      { id: 'neg', title: 'Downvoted', score: -50 },
      { id: 'zero', title: 'Zero', score: 0 }
    ]));
    const scraper = new SocialSentimentScraper(['test']);
    const signals = await scraper.fetchSignals();
    const reddit = signals.filter((s) => s.platform === 'REDDIT');
    expect(reddit.every((s) => s.sentimentScore === 0)).toBe(true);
  });

  it('normalizes score: high score → close to 1 but capped', async () => {
    mockFetch(redditListing([{ id: 'viral', title: 'Viral post', score: 100000 }]));
    const scraper = new SocialSentimentScraper(['test']);
    const signals = await scraper.fetchSignals();
    const reddit = signals.filter((s) => s.platform === 'REDDIT');
    expect(reddit[0].sentimentScore).toBeLessThanOrEqual(1);
    expect(reddit[0].sentimentScore).toBeGreaterThan(0.9);
  });

  it('skips subreddit when fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));
    const scraper = new SocialSentimentScraper(['politics']);
    const signals = await scraper.fetchSignals();
    // Only X placeholder should remain
    expect(signals.filter((s) => s.platform === 'REDDIT')).toHaveLength(0);
    expect(signals.find((s) => s.platform === 'X')).toBeDefined();
  });

  it('skips subreddit when response is non-ok', async () => {
    mockFetch({}, false);
    const scraper = new SocialSentimentScraper(['politics']);
    const signals = await scraper.fetchSignals();
    expect(signals.filter((s) => s.platform === 'REDDIT')).toHaveLength(0);
  });

  it('aggregates posts from multiple subreddits', async () => {
    let callCount = 0;
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => {
      callCount++;
      return {
        ok: true,
        json: async () => redditListing([{ id: `post${callCount}`, title: `Post ${callCount}`, score: 100 }])
      };
    }));
    const scraper = new SocialSentimentScraper(['politics', 'economics']);
    const signals = await scraper.fetchSignals();
    expect(signals.filter((s) => s.platform === 'REDDIT')).toHaveLength(2);
  });

  it('respects limitPerSub parameter in URL', async () => {
    const spy = vi.fn().mockResolvedValue({ ok: true, json: async () => redditListing([]) });
    vi.stubGlobal('fetch', spy);
    const scraper = new SocialSentimentScraper(['politics']);
    await scraper.fetchSignals(5);
    expect(spy.mock.calls[0][0]).toContain('limit=5');
  });
});
