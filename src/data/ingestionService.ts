import type { IngestedSnapshot, Market } from '../types/domain.js';
import { nowIso } from '../utils/time.js';
import { EventCalendarTracker } from './eventCalendarTracker.js';
import { MarketDataFetcher } from './marketDataFetcher.js';
import { NewsFeedAggregator } from './newsFeedAggregator.js';
import { PriceHistoryFetcher } from './priceHistoryFetcher.js';
import { SocialSentimentScraper } from './socialSentimentScraper.js';

export class DataIngestionService {
  constructor(
    private readonly news = new NewsFeedAggregator(),
    private readonly social = new SocialSentimentScraper(),
    private readonly markets = new MarketDataFetcher(),
    private readonly calendar = new EventCalendarTracker(),
    private readonly priceHistory = new PriceHistoryFetcher()
  ) {}

  async getMarkets(limit = 20): Promise<Market[]> {
    return this.markets.getActiveMarkets(limit);
  }

  async buildSnapshot(market: Market): Promise<IngestedSnapshot> {
    const [news, social, events, priceHistory] = await Promise.all([
      this.news.fetchLatest(),
      this.social.fetchSignals(),
      this.calendar.upcoming(),
      market.clobTokenId ? this.priceHistory.fetch(market.clobTokenId) : Promise.resolve([])
    ]);

    const lowerQ = market.question.toLowerCase();
    const relevantNews = news.filter((item) => {
      const blob = `${item.title} ${item.summary ?? ''}`.toLowerCase();
      return market.tags.some((tag) => blob.includes(tag.toLowerCase())) || blob.includes(lowerQ.slice(0, 12));
    });

    const relevantSocial = social.filter((s) => {
      const t = s.topic.toLowerCase();
      return market.tags.some((tag) => t.includes(tag.toLowerCase())) || t.includes(lowerQ.slice(0, 12));
    });

    const relevantEvents = events.filter((e) => {
      const t = e.title.toLowerCase();
      return market.tags.some((tag) => t.includes(tag.toLowerCase()));
    });

    return {
      timestamp: nowIso(),
      market,
      news: relevantNews.slice(0, 15),
      social: relevantSocial.slice(0, 15),
      events: relevantEvents.slice(0, 10),
      priceHistory
    };
  }
}
