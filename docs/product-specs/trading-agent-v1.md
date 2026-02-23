# Trading Agent v1 — Product Spec

## Overview

Autonomous agent that trades prediction markets (Polymarket-style) using a continuous Monitor → Analyze → Decide → Execute → Learn loop.

## Core Capabilities

### Data Ingestion
- RSS news aggregation from configurable feeds (Reuters, CNN default)
- Reddit social sentiment via public JSON API (configurable subreddits)
- X/Twitter placeholder (no live integration yet)
- Polymarket active markets via CLOB API (falls back to mock markets)
- Event calendar with built-in macro events + optional external API

### AI Reasoning
- Heuristic baseline: market-implied odds adjusted by social/news/event signals
- Optional OpenAI refinement: structured JSON probability estimate blended 65/35 with baseline
- Outputs: estimated probability, edge vs market, confidence score, rationale, key drivers, risk flags

### Decision Engine
- Minimum edge threshold (default 5%) — below this, HOLD
- Fractional Kelly sizing (default 0.5x full Kelly)
- Risk caps: max 10% bankroll per position, max 50% total portfolio exposure
- Below $1 trades filtered out

### Execution
- Paper trading broker (default): simulated fills with slippage model based on size/liquidity ratio
- Polymarket live broker: adapter stub, not validated against real API
- Position and cash tracking in SQLite

### Learning
- ROI, Sharpe ratio, win rate
- Brier score and calibration error (placeholder outcomes until market resolution tracking)
- All metrics queryable via API

### REST API
- Health/status, active markets, positions, P&L, full reasoning logs, performance metrics
- Agent control: start/stop/run-once

## Configuration
All via environment variables, validated by Zod at startup. See `.env.example`.

## Limitations (v1)
- No real X/Twitter data source
- Calendar events are hardcoded placeholders without external API
- Polymarket broker not tested against live API
- Calibration uses pseudo-outcomes (no market resolution tracking)
- No stop-loss execution (parameter exists but not enforced in broker)
- Single-threaded loop — markets processed sequentially
