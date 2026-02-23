# Tech Debt Tracker

## Critical

| Item | Location | Impact |
|------|----------|--------|
| No X/Twitter integration | `src/data/socialSentimentScraper.ts` | Missing major sentiment signal source |
| Polymarket broker untested | `src/execution/polymarketBroker.ts` | Cannot go live without validation |
| No market resolution tracking | `src/learning/` | Calibration metrics use pseudo-outcomes, not real results |

## High

| Item | Location | Impact |
|------|----------|--------|
| Stop-loss not enforced | `src/execution/` | Config param exists but broker doesn't check it |
| Calendar events hardcoded | `src/data/eventCalendarTracker.ts` | Only 2 placeholder events without external API |
| No authentication on API | `src/api/server.ts` | Anyone on the network can start/stop agent |
| Sequential market processing | `src/agent/tradingAgent.ts` | Slow with many markets; should parallelize |

## Medium

| Item | Location | Impact |
|------|----------|--------|
| RSS XML parsing is regex-based | `src/data/newsFeedAggregator.ts` | Fragile; should use proper XML parser |
| No retry/backoff on API calls | `src/data/` | Transient failures silently swallowed |
| LLM prompt not tuned | `src/reasoning/llmClient.ts` | Default prompt may produce inconsistent JSON |
| No database migrations | `src/storage/database.ts` | Schema changes require manual intervention |

## Low

| Item | Location | Impact |
|------|----------|--------|
| Logger is console-only | `src/utils/logger.ts` | No structured logging, no log levels |
| No graceful shutdown for in-flight cycles | `src/agent/tradingAgent.ts` | Interval clear doesn't wait for current cycle |
