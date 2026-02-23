# Design Decisions Index

## ADR-001: Kelly Criterion for Bet Sizing

Kelly maximizes long-term growth rate of bankroll. We use fractional Kelly (default 0.5x) to reduce variance at the cost of slightly lower expected growth. Full Kelly is too aggressive for a system where probability estimates have meaningful uncertainty.

Alternative considered: fixed percentage sizing. Rejected because it ignores edge magnitude — a 20% edge should size larger than a 6% edge.

## ADR-002: SQLite for Storage

Single-file database, zero ops overhead, WAL mode for concurrent reads. This is a single-agent system — no need for Postgres. SQLite handles the write volume (one cycle every 30s) without breaking a sweat.

Alternative considered: JSON files. Rejected because querying historical performance across thousands of cycles needs SQL.

## ADR-003: Paper Trading as Default

`PAPER_TRADING=true` ships as default. Live trading requires explicit opt-in. The paper broker simulates slippage and tracks positions/cash identically to live — same code paths, same logging, same metrics. This means paper results are a reasonable proxy for live behavior minus real liquidity dynamics.

## ADR-004: Heuristic + LLM Hybrid Reasoning

The reasoning engine runs a deterministic heuristic baseline (market-implied odds + social/news/event signal blend) that works without any API key. When an OpenAI key is configured, LLM estimates are blended in (65% LLM, 35% heuristic). This means:
- System works out of the box with zero external dependencies
- LLM adds nuanced reasoning about complex events
- Heuristic provides a sanity anchor so a hallucinating LLM can't go fully off the rails

## ADR-005: Modular Broker Interface

Execution is behind an interface (`ExecutionBroker`). Paper and live brokers implement the same contract. This isolates all real-money risk to a single file (`polymarketBroker.ts`) and makes testing trivial.

## ADR-006: Full Cycle Logging

Every agent cycle logs the complete snapshot, reasoning, decision, and order as JSON in SQLite. This is non-negotiable — you can't improve what you can't measure, and you can't debug trading decisions without the full context that produced them.
