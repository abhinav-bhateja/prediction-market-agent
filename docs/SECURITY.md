# Security

## API Keys

All secrets via environment variables. Never committed to repo.

| Key | Used By | Risk |
|-----|---------|------|
| `OPENAI_API_KEY` | `src/reasoning/llmClient.ts` | Cost exposure if leaked. No data exfil risk. |
| `POLYMARKET_API_KEY` | `src/data/marketDataFetcher.ts`, `src/execution/polymarketBroker.ts` | Financial risk if leaked — can place real orders. |

### Rules
- `.env` is gitignored
- `.env.example` contains only placeholder values
- Config validation fails at startup if required keys are missing format (but keys themselves are optional)

## Paper vs Live Safeguards

- `PAPER_TRADING=true` is the default. Changing to `false` is a high-risk action.
- Paper broker never makes network calls — all simulated locally
- Live broker (`polymarketBroker.ts`) is the only file that sends authenticated requests to external APIs
- Risk policy marks `src/execution/**` as high-risk tier

## API Server

- No authentication on REST endpoints
- Anyone with network access can hit `/agent/start`, `/agent/stop`, `/agent/run-once`
- In paper mode this is low risk; in live mode this is critical

### Recommendations (not yet implemented)
- Add bearer token auth to API endpoints
- Bind API to localhost only by default
- Add rate limiting on control endpoints
- Log all API requests with source IP

## Data Handling

- No PII collected or stored
- Market data, news, and social signals are public information
- Cycle logs contain LLM reasoning text — review before sharing externally
- SQLite database file (`agent.db`) contains full trade history and reasoning
