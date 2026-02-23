import Database from 'better-sqlite3';
import { config } from '../config/index.js';

export const db = new Database(config.DATABASE_PATH);

db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS cycle_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  market_id TEXT NOT NULL,
  snapshot_json TEXT NOT NULL,
  reasoning_json TEXT NOT NULL,
  decision_json TEXT NOT NULL,
  order_json TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS positions (
  market_id TEXT NOT NULL,
  side TEXT NOT NULL,
  quantity REAL NOT NULL,
  avg_price REAL NOT NULL,
  mark_price REAL NOT NULL,
  unrealized_pnl REAL NOT NULL,
  realized_pnl REAL NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (market_id, side)
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  market_id TEXT NOT NULL,
  action TEXT NOT NULL,
  side TEXT NOT NULL,
  size_usd REAL NOT NULL,
  price REAL NOT NULL,
  status TEXT NOT NULL,
  slippage_bps REAL NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS bankroll (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  cash_usd REAL NOT NULL,
  updated_at TEXT NOT NULL
);

INSERT OR IGNORE INTO bankroll (id, cash_usd, updated_at) VALUES (1, 0, datetime('now'));
`);
