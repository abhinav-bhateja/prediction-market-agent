import { db } from './database.js';
import type { AgentCycleResult, Order, Position } from '../types/domain.js';
import { nowIso } from '../utils/time.js';

export class Repository {
  setInitialBankroll(amountUsd: number): void {
    const current = this.getCashBalance();
    if (current === 0) {
      db.prepare('UPDATE bankroll SET cash_usd = ?, updated_at = ? WHERE id = 1').run(amountUsd, nowIso());
    }
  }

  getCashBalance(): number {
    const row = db.prepare('SELECT cash_usd FROM bankroll WHERE id = 1').get() as { cash_usd: number };
    return row?.cash_usd ?? 0;
  }

  setCashBalance(amountUsd: number): void {
    db.prepare('UPDATE bankroll SET cash_usd = ?, updated_at = ? WHERE id = 1').run(amountUsd, nowIso());
  }

  logCycle(cycle: AgentCycleResult): void {
    db.prepare(
      `INSERT INTO cycle_logs (market_id, snapshot_json, reasoning_json, decision_json, order_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(
      cycle.marketId,
      JSON.stringify(cycle.snapshot),
      JSON.stringify(cycle.reasoning),
      JSON.stringify(cycle.decision),
      cycle.order ? JSON.stringify(cycle.order) : null,
      nowIso()
    );
  }

  saveOrder(order: Order): void {
    db.prepare(
      `INSERT OR REPLACE INTO orders (id, market_id, action, side, size_usd, price, status, slippage_bps, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      order.id,
      order.marketId,
      order.action,
      order.side,
      order.sizeUsd,
      order.price,
      order.status,
      order.slippageBps,
      order.createdAt
    );
  }

  upsertPosition(position: Position): void {
    db.prepare(
      `INSERT OR REPLACE INTO positions (market_id, side, quantity, avg_price, mark_price, unrealized_pnl, realized_pnl, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      position.marketId,
      position.side,
      position.quantity,
      position.avgPrice,
      position.markPrice,
      position.unrealizedPnl,
      position.realizedPnl,
      position.updatedAt
    );
  }

  getPositions(): Position[] {
    return db
      .prepare(
        `SELECT market_id as marketId, side, quantity, avg_price as avgPrice, mark_price as markPrice,
                unrealized_pnl as unrealizedPnl, realized_pnl as realizedPnl, updated_at as updatedAt
         FROM positions`
      )
      .all() as Position[];
  }

  getOrders(limit = 100): Order[] {
    return db
      .prepare(
        `SELECT id, market_id as marketId, action, side, size_usd as sizeUsd, price, status,
                slippage_bps as slippageBps, created_at as createdAt
         FROM orders
         ORDER BY created_at DESC
         LIMIT ?`
      )
      .all(limit) as Order[];
  }

  getRecentCycleLogs(limit = 50): Array<Record<string, unknown>> {
    return db
      .prepare('SELECT * FROM cycle_logs ORDER BY created_at DESC LIMIT ?')
      .all(limit) as Array<Record<string, unknown>>;
  }
}
