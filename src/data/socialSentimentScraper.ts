import { config } from '../config/index.js';
import type { SocialSignal } from '../types/domain.js';

interface RedditListing {
  data: {
    children: Array<{
      data: {
        id: string;
        title: string;
        permalink: string;
        score: number;
        created_utc: number;
      };
    }>;
  };
}

const normalizeScore = (raw: number): number => {
  if (raw <= 0) return 0;
  return Math.min(1, Math.log10(raw + 1) / 3);
};

export class SocialSentimentScraper {
  private readonly subreddits: string[];

  constructor(subreddits?: string[]) {
    this.subreddits = subreddits ?? config.REDDIT_SUBREDDITS.split(',').map((s) => s.trim());
  }

  async fetchSignals(limitPerSub = 10): Promise<SocialSignal[]> {
    const signals: SocialSignal[] = [];

    for (const sub of this.subreddits) {
      try {
        const res = await fetch(`https://www.reddit.com/r/${sub}/hot.json?limit=${limitPerSub}`);
        if (!res.ok) continue;
        const payload = (await res.json()) as RedditListing;

        for (const child of payload.data.children) {
          const post = child.data;
          const score = normalizeScore(post.score);
          signals.push({
            id: `reddit:${post.id}`,
            platform: 'REDDIT',
            topic: post.title,
            sentimentScore: score,
            confidence: 0.55,
            url: `https://www.reddit.com${post.permalink}`,
            observedAt: new Date(post.created_utc * 1000).toISOString()
          });
        }
      } catch {
        // Ignore failures.
      }
    }

    // Placeholder for X/Twitter trending integration.
    signals.push({
      id: `x:placeholder:${Date.now()}`,
      platform: 'X',
      topic: 'No X API configured; using placeholder trend signal',
      sentimentScore: 0.5,
      confidence: 0.1,
      observedAt: new Date().toISOString()
    });

    return signals;
  }
}
