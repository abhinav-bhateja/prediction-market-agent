# Prediction Market Agent (Node.js/TypeScript)

Agentic system for Polymarket-style trading with a continuous loop:

`Monitor -> Analyze -> Decide -> Execute -> Learn`

## Features

- Modular architecture by layer (`src/agent`, `src/data`, `src/reasoning`, `src/decision`, `src/execution`, `src/learning`, `src/api`)
- Data ingestion from RSS, Reddit, market API, and event calendar
- AI reasoning engine with probability estimate, confidence, edge detection, and rationale logging
- Decision engine with edge threshold, Kelly sizing, and risk limits
- Paper trading mode by default (safe local testing)
- SQLite persistence of cycles, orders, positions, and bankroll
- REST API for health, markets, positions, P&L, reasoning logs, and performance metrics
- Unit tests for Kelly sizing and risk/decision constraints

## Setup

1. Install dependencies:

```bash
npm install
```

2. Configure environment:

```bash
cp .env.example .env
```

3. Start in development mode:

```bash
npm run dev
```

API runs on `http://localhost:3000` by default.

## API Endpoints

- `GET /health` - service/agent status
- `GET /markets` - currently tracked markets
- `GET /positions` - cash, positions, recent orders
- `GET /pnl` - realized/unrealized/net P&L
- `GET /reasoning` - full decision + reasoning logs
- `GET /metrics` - ROI, Sharpe, win rate, Brier, calibration
- `POST /agent/run-once` - force one loop cycle
- `POST /agent/start` - start loop
- `POST /agent/stop` - stop loop

## Core Architecture

- `src/data`: ingestion adapters and snapshot builder
- `src/reasoning`: probability estimation using heuristic baseline + optional OpenAI refinement
- `src/decision`: edge gating + Kelly sizing + risk controls
- `src/execution`: broker abstraction with paper-trading implementation
- `src/learning`: performance and calibration metrics
- `src/storage`: SQLite schema/repository
- `src/agent`: orchestration and loop scheduler

## Notes

- `PAPER_TRADING=true` by default; keep it enabled unless your live execution adapter is fully validated.
- Every cycle logs snapshot, reasoning, decision, and optional order JSON in SQLite (`cycle_logs`).
- The Polymarket execution adapter is isolated in `src/execution/polymarketBroker.ts` for easier hardening.

## Testing

```bash
npm test
```

Tests are focused on decision logic and risk constraints.

## Documentation

- [AGENTS.md](./AGENTS.md) — agent entry point, module map, rules
- [ARCHITECTURE.md](./ARCHITECTURE.md) — domain map and data flow diagram
- [Design Decisions](./docs/design-docs/index.md) — ADRs (Kelly, SQLite, paper-first, etc.)
- [Product Spec v1](./docs/product-specs/trading-agent-v1.md) — feature spec
- [Tech Debt](./docs/exec-plans/tech-debt-tracker.md) — known gaps and priorities
- [Quality Grades](./docs/QUALITY.md) — per-module assessment
- [Reliability](./docs/RELIABILITY.md) — failure modes and monitoring needs
- [Security](./docs/SECURITY.md) — API keys, paper vs live safeguards
- [External References](./docs/references/index.md) — Polymarket, OpenAI, Reddit APIs
- [Risk Policy](./risk-policy.json) — high/low risk tier definitions
