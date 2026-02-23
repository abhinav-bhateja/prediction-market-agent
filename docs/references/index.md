# External References

## Polymarket CLOB API
- Base URL: `https://clob.polymarket.com`
- Docs: https://docs.polymarket.com/
- Used by: `src/data/marketDataFetcher.ts`, `src/execution/polymarketBroker.ts`
- Auth: Bearer token (optional for reads, required for orders)

## OpenAI Responses API
- Docs: https://platform.openai.com/docs/api-reference
- Used by: `src/reasoning/llmClient.ts`
- Model: configurable via `OPENAI_MODEL` (default: `gpt-4o-mini`)
- Output: structured JSON probability estimates

## Reddit JSON API
- Pattern: `https://www.reddit.com/r/{subreddit}/hot.json?limit=N`
- Used by: `src/data/socialSentimentScraper.ts`
- Auth: none (public endpoint, rate-limited)

## RSS Feeds
- Default: Reuters World News, CNN Edition
- Used by: `src/data/newsFeedAggregator.ts`
- Parsed with regex (no XML library dependency)
