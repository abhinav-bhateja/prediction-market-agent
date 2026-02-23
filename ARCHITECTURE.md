# ARCHITECTURE.md — Prediction Market Agent

## System Overview

A continuous-loop trading agent that monitors prediction markets, estimates fair probabilities, sizes bets using Kelly criterion, and executes trades (paper or live).

## Data Flow

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   INGEST    │───▶│   REASON    │───▶│   DECIDE    │───▶│   EXECUTE   │───▶│    LEARN    │
│             │    │             │    │             │    │             │    │             │
│ News (RSS)  │    │ Heuristic   │    │ Edge gate   │    │ Paper broker│    │ ROI, Sharpe │
│ Reddit      │    │ + LLM blend │    │ Kelly size  │    │ or Polymarket│   │ Brier score │
│ Market API  │    │ Confidence  │    │ Risk caps   │    │ Slippage    │    │ Calibration │
│ Calendar    │    │ Edge calc   │    │ Position lim│    │ Position upd│    │ Cycle logs  │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
                                                                │
                                                                ▼
                                                         ┌─────────────┐
                                                         │   STORAGE   │
                                                         │   (SQLite)  │
                                                         │ cycle_logs  │
                                                         │ positions   │
                                                         │ orders      │
                                                         │ bankroll    │
                                                         └─────────────┘
                                                                │
                                                                ▼
                                                         ┌─────────────┐
                                                         │  REST API   │
                                                         │  (Express)  │
                                                         │ /health     │
                                                         │ /positions  │
                                                         │ /reasoning  │
                                                         │ /metrics    │
                                                         └─────────────┘
```

## Package Map

### `src/agent/`
Orchestration. `TradingAgent` owns the loop interval, wires all components, exposes status. Entry point: `src/index.ts` starts the agent + API server.

### `src/data/`
Four ingestion adapters + one orchestrator:
- `NewsFeedAggregator` — RSS feeds, regex XML parsing
- `SocialSentimentScraper` — Reddit JSON API, X placeholder
- `MarketDataFetcher` — Polymarket CLOB API with fallback mock markets
- `EventCalendarTracker` — external API or built-in macro events
- `DataIngestionService` — builds per-market `IngestedSnapshot` with relevance filtering

### `src/reasoning/`
- `ReasoningEngine` — blends heuristic baseline (social/news/event signals) with optional LLM estimate
- `LlmClient` — OpenAI Responses API, structured JSON output, graceful degradation when no key

### `src/decision/`
- `DecisionEngine` — edge threshold check → Kelly sizing → risk check → BUY/HOLD
- `kellyFractionBinary` — pure Kelly math for binary outcomes
- `RiskManager` — max position %, portfolio exposure cap, minimum size filter

### `src/execution/`
- `ExecutionBroker` interface — `placeOrder(ctx) → Order | null`
- `PaperTradingBroker` — simulates fills with slippage, updates positions/cash in SQLite
- `PolymarketBroker` — live adapter stub, isolated for hardening

### `src/learning/`
- `LearningEngine` — queries cycle logs, computes performance summary
- `metrics.ts` — Sharpe ratio, Brier score, calibration error, win rate, ROI

### `src/storage/`
- `database.ts` — SQLite init, WAL mode, schema (cycle_logs, positions, orders, bankroll)
- `repository.ts` — typed read/write layer over all tables

### `src/api/`
Express server. Endpoints: `/health`, `/markets`, `/positions`, `/pnl`, `/reasoning`, `/metrics`, `/agent/run-once`, `/agent/start`, `/agent/stop`.

### `src/config/`
Zod schema validates all env vars at startup. Fails fast on bad config.

### `src/types/`
`domain.ts` — `Market`, `NewsItem`, `SocialSignal`, `CalendarEvent`, `IngestedSnapshot`, `ReasoningResult`, `DecisionResult`, `Order`, `Position`, `AgentCycleResult`.

## Key Design Choices

See [docs/design-docs/index.md](./docs/design-docs/index.md) for rationale.
