import { XMLParser } from 'fast-xml-parser';
import { config } from '../config/index.js';
import type { NewsItem } from '../types/domain.js';

const parser = new XMLParser({ ignoreAttributes: false, cdataPropName: '__cdata' });

const parseRssItems = (xml: string, source: string): NewsItem[] => {
  try {
    const doc = parser.parse(xml);
    const channel = doc?.rss?.channel ?? doc?.feed;
    if (!channel) return [];

    const rawItems: unknown[] = Array.isArray(channel.item)
      ? channel.item
      : channel.item
        ? [channel.item]
        : Array.isArray(channel.entry)
          ? channel.entry
          : channel.entry
            ? [channel.entry]
            : [];

    return rawItems.flatMap((item) => {
      if (typeof item !== 'object' || item === null) return [];
      const i = item as Record<string, unknown>;

      const asObj = (v: unknown): Record<string, unknown> => (typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : {});
      const title = String(asObj(i['title'])['__cdata'] ?? i['title'] ?? 'Untitled');
      const linkObj = asObj(i['link']);
      const url = String(linkObj['#text'] ?? linkObj['@_href'] ?? i['link'] ?? '');
      if (!url) return [];

      const pubDate = String(i['pubDate'] ?? i['published'] ?? i['updated'] ?? '');
      const summary = String(asObj(i['description'])['__cdata'] ?? i['description'] ?? i['summary'] ?? '');

      return [{
        id: `${source}:${url}`,
        title,
        source,
        url,
        publishedAt: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
        summary
      } satisfies NewsItem];
    });
  } catch {
    return [];
  }
};

export class NewsFeedAggregator {
  private readonly feeds: string[];

  constructor(feeds?: string[]) {
    this.feeds = feeds ?? config.NEWS_RSS_FEEDS.split(',').map((s) => s.trim()).filter(Boolean);
  }

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
