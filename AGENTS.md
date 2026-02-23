# AGENTS.md — Prediction Market Agent

## What Is This

Agentic trading system for Polymarket-style prediction markets. TypeScript/Node.js. Paper trading by default.

## Quick Start

```bash
npm install
cp .env.example .env
npm run dev          # starts agent loop + API on :3000
npm test             # vitest
```

## Module Map

| Directory | Purpose |
|-----------|---------|
| `src/agent/` | Core loop orchestration (Monitor → Analyze → Decide → Execute → Learn) |
| `src/data/` | Data ingestion — RSS news, Reddit sentiment, market prices, event calendar |
| `src/reasoning/` | Probability estimation — heuristic baseline + optional OpenAI refinement |
| `src/decision/` | Edge gating, Kelly sizing, risk limits |
| `src/execution/` | Broker abstraction — paper trading (default) + Polymarket adapter |
| `src/learning/` | Performance metrics — ROI, Sharpe, Brier score, calibration |
| `src/api/` | REST API — health, positions, P&L, reasoning logs, metrics |
| `src/storage/` | SQLite schema + repository |
| `src/config/` | Zod-validated env config |
| `src/types/` | Shared domain types |
| `src/utils/` | Logger, math helpers, time |

## Docs

- [Architecture](./ARCHITECTURE.md) — domain map and data flow
- [Design Decisions](./docs/design-docs/index.md)
- [Product Spec v1](./docs/product-specs/trading-agent-v1.md)
- [Execution Plans](./docs/exec-plans/)
- [Tech Debt](./docs/exec-plans/tech-debt-tracker.md)
- [Quality Grades](./docs/QUALITY.md)
- [Reliability](./docs/RELIABILITY.md)
- [Security](./docs/SECURITY.md)
- [External References](./docs/references/)

## Risk Policy

See [risk-policy.json](./risk-policy.json). High-risk paths: execution, config, database schema.

## Tests

Decision engine and Kelly sizing covered in `tests/`. Run `npm test`.

## Rules for Agents

- Do not change risk parameters without human approval.
- Paper trading must stay default. Flipping `PAPER_TRADING=false` is a high-risk change.
- Every trade decision is logged with full reasoning. Do not bypass logging.
- Read `ARCHITECTURE.md` before touching data flow.
- Read `docs/SECURITY.md` before touching API keys or broker code.
