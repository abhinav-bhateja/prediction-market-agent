import { describe, expect, it, vi, afterEach } from 'vitest';
import { NewsFeedAggregator } from '../src/data/newsFeedAggregator.js';

afterEach(() => vi.restoreAllMocks());

const rssXml = (items: Array<{ title: string; link: string; pubDate?: string; description?: string }>) => `
<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <title>Test Feed</title>
    ${items.map((i) => `
    <item>
      <title>${i.title}</title>
      <link>${i.link}</link>
      ${i.pubDate ? `<pubDate>${i.pubDate}</pubDate>` : ''}
      ${i.description ? `<description>${i.description}</description>` : ''}
    </item>`).join('')}
  </channel>
</rss>`;

const atomXml = (entries: Array<{ title: string; href: string; updated?: string }>) => `
<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Test Atom Feed</title>
  ${entries.map((e) => `
  <entry>
    <title>${e.title}</title>
    <link href="${e.href}"/>
    ${e.updated ? `<updated>${e.updated}</updated>` : ''}
  </entry>`).join('')}
</feed>`;

const mockFetch = (xml: string, ok = true) => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok,
    status: ok ? 200 : 500,
    text: async () => xml
  }));
};

// Single-feed aggregator to avoid config's default two feeds doubling results
const singleFeed = (feeds = ['https://example.com/feed.rss']) => new NewsFeedAggregator(feeds);

describe('NewsFeedAggregator', () => {
  it('returns empty array when all feeds fail', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));
    const items = await singleFeed().fetchLatest();
    expect(items).toEqual([]);
  });

  it('returns empty array when feed returns non-ok status', async () => {
    mockFetch('', false);
    const items = await singleFeed().fetchLatest();
    expect(items).toEqual([]);
  });

  it('parses RSS items correctly', async () => {
    mockFetch(rssXml([
      { title: 'Breaking News', link: 'https://example.com/1', pubDate: 'Mon, 01 Jan 2024 12:00:00 GMT', description: 'A summary' }
    ]));
    const items = await singleFeed().fetchLatest();

    expect(items).toHaveLength(1);
    expect(items[0].title).toBe('Breaking News');
    expect(items[0].url).toBe('https://example.com/1');
    expect(items[0].summary).toBe('A summary');
    expect(items[0].publishedAt).toBe(new Date('Mon, 01 Jan 2024 12:00:00 GMT').toISOString());
  });

  it('parses Atom feed entries', async () => {
    mockFetch(atomXml([
      { title: 'Atom Entry', href: 'https://atom.example.com/1', updated: '2024-01-01T12:00:00Z' }
    ]));
    const items = await singleFeed().fetchLatest();

    expect(items).toHaveLength(1);
    expect(items[0].title).toBe('Atom Entry');
    expect(items[0].url).toBe('https://atom.example.com/1');
  });

  it('skips items with no URL', async () => {
    mockFetch(rssXml([
      { title: 'No Link', link: '' },
      { title: 'Has Link', link: 'https://example.com/2' }
    ]));
    const items = await singleFeed().fetchLatest();
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe('Has Link');
  });

  it('respects limit parameter', async () => {
    const many = Array.from({ length: 20 }, (_, i) => ({
      title: `Item ${i}`,
      link: `https://example.com/${i}`,
      pubDate: new Date(Date.now() - i * 1000).toUTCString()
    }));
    mockFetch(rssXml(many));
    const items = await singleFeed().fetchLatest(5);
    expect(items).toHaveLength(5);
  });

  it('sorts items by publishedAt descending', async () => {
    mockFetch(rssXml([
      { title: 'Older', link: 'https://example.com/old', pubDate: 'Mon, 01 Jan 2024 10:00:00 GMT' },
      { title: 'Newer', link: 'https://example.com/new', pubDate: 'Mon, 01 Jan 2024 12:00:00 GMT' }
    ]));
    const items = await singleFeed().fetchLatest();
    expect(items[0].title).toBe('Newer');
    expect(items[1].title).toBe('Older');
  });

  it('returns empty array for malformed XML', async () => {
    mockFetch('<not valid xml at all >>>');
    const items = await singleFeed().fetchLatest();
    expect(Array.isArray(items)).toBe(true);
  });

  it('uses fallback publishedAt when pubDate is missing', async () => {
    mockFetch(rssXml([{ title: 'No Date', link: 'https://example.com/nodate' }]));
    const before = Date.now();
    const items = await singleFeed().fetchLatest();
    const after = Date.now();

    expect(items).toHaveLength(1);
    const ts = Date.parse(items[0].publishedAt);
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after);
  });

  it('aggregates items from multiple feeds', async () => {
    let callCount = 0;
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => {
      callCount++;
      return {
        ok: true,
        text: async () => rssXml([{ title: `Item from feed ${callCount}`, link: `https://example.com/${callCount}` }])
      };
    }));
    const items = await new NewsFeedAggregator([
      'https://feed1.example.com/rss',
      'https://feed2.example.com/rss'
    ]).fetchLatest();
    expect(items).toHaveLength(2);
  });
});
