# Reliability

## What Can Break

### Data Ingestion Failures
- RSS feeds go down or change format → regex parser returns empty
- Reddit rate-limits or blocks → no social signals
- Polymarket API changes or is unreachable → falls back to mock markets (safe but stale)
- All failures are silently caught — agent continues with degraded data

### LLM Failures
- OpenAI API down or key invalid → falls back to heuristic-only (designed for this)
- Malformed JSON response → returns null, heuristic takes over
- Slow response → blocks the cycle for that market (no timeout configured)

### Database
- SQLite WAL corruption (rare, usually hardware) → agent crashes on next query
- Disk full → writes fail silently or crash
- No backup strategy configured

### Agent Loop
- Unhandled exception in one market cycle → caught, logged, continues to next market
- Interval drift under load — if a cycle takes longer than the interval, cycles can overlap
- No mutex on concurrent cycles

## What Needs Monitoring

- Cycle completion rate (are cycles finishing?)
- Edge distribution (is the model finding any edge, or always HOLD?)
- Cash balance trend (is paper bankroll growing or bleeding?)
- API response times from external sources
- LLM fallback rate (how often is heuristic-only running?)

## Current Gaps

- No health check beyond `/health` endpoint
- No alerting
- No structured logs for aggregation
- No metrics export (Prometheus, etc.)
- No circuit breaker on external API calls
