import { config } from '../config/index.js';
import type { NewsItem } from '../types/domain.js';

const parseRssItems = (xml: string, source: string): NewsItem[] => {
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  const titleRegex = /<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/;
  const linkRegex = /<link>(.*?)<\/link>/;
  const dateRegex = /<pubDate>(.*?)<\/pubDate>/;
  const descRegex = /<description><!\[CDATA\[(.*?)\]\]><\/description>|<description>(.*?)<\/description>/;

  const items: NewsItem[] = [];
  let match: RegExpExecArray | null;
  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const titleMatch = block.match(titleRegex);
    const linkMatch = block.match(linkRegex);
    const dateMatch = block.match(dateRegex);
    const descMatch = block.match(descRegex);
    const title = titleMatch?.[1] ?? titleMatch?.[2] ?? 'Untitled';
    const url = linkMatch?.[1] ?? '';
    if (!url) continue;
    items.push({
      id: `${source}:${url}`,
      title,
      source,
      url,
      publishedAt: dateMatch?.[1] ? new Date(dateMatch[1]).toISOString() : new Date().toISOString(),
      summary: descMatch?.[1] ?? descMatch?.[2] ?? ''
    });
  }
  return items;
};

export class NewsFeedAggregator {
  private readonly feeds = config.NEWS_RSS_FEEDS.split(',').map((s) => s.trim());

  async fetchLatest(limit = 30): Promise<NewsItem[]> {
    const all: NewsItem[] = [];
    await Promise.all(
      this.feeds.map(async (feedUrl) => {
        try {
          const res = await fetch(feedUrl);
          if (!res.ok) return;
          const xml = await res.text();
          all.push(...parseRssItems(xml, new URL(feedUrl).hostname));
        } catch {
          // Ignore failed feed.
        }
      })
    );
    return all
      .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))
      .slice(0, limit);
  }
}
