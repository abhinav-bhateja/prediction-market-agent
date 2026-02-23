import { z } from 'zod';

export const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3000),
  DATABASE_PATH: z.string().default('./agent.db'),

  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default('gpt-4o-mini'),
  ANTHROPIC_API_KEY: z.string().optional(),

  POLYMARKET_API_BASE_URL: z.string().url().default('https://clob.polymarket.com'),
  POLYMARKET_API_KEY: z.string().optional(),

  PAPER_TRADING: z.coerce.boolean().default(true),
  STARTING_BANKROLL_USD: z.coerce.number().positive().default(10000),
  AGENT_LOOP_INTERVAL_MS: z.coerce.number().int().positive().default(30000),

  MIN_EDGE_THRESHOLD: z.coerce.number().min(0).max(1).default(0.05),
  KELLY_FRACTION: z.coerce.number().min(0).max(1).default(0.5),
  MAX_POSITION_PCT: z.coerce.number().min(0).max(1).default(0.1),
  MAX_PORTFOLIO_EXPOSURE_PCT: z.coerce.number().min(0).max(1).default(0.5),
  STOP_LOSS_PCT: z.coerce.number().min(0).max(1).default(0.2),

  NEWS_RSS_FEEDS: z
    .string()
    .default('https://feeds.reuters.com/reuters/worldNews,https://rss.cnn.com/rss/edition.rss'),
  REDDIT_SUBREDDITS: z.string().default('news,politics,worldnews'),
  EVENT_CALENDAR_API_URL: z.string().url().optional()
});

export type AppConfig = z.infer<typeof configSchema>;
