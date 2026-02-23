import type { Order } from '../types/domain.js';
import type { ExecuteContext, ExecutionBroker } from './types.js';
import { config } from '../config/index.js';

export class PolymarketBroker implements ExecutionBroker {
  async placeOrder(ctx: ExecuteContext): Promise<Order | null> {
    if (ctx.decision.action !== 'BUY' || ctx.decision.sizeUsd <= 0) return null;

    // This endpoint shape can vary; keep this adapter isolated and easy to replace.
    const response = await fetch(`${config.POLYMARKET_API_BASE_URL}/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(config.POLYMARKET_API_KEY ? { Authorization: `Bearer ${config.POLYMARKET_API_KEY}` } : {})
      },
      body: JSON.stringify({
        marketId: ctx.market.id,
        side: ctx.decision.side,
        action: 'BUY',
        sizeUsd: ctx.decision.sizeUsd
      })
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as Partial<Order>;
    return {
      id: payload.id ?? `poly-${Date.now()}`,
      marketId: payload.marketId ?? ctx.market.id,
      action: payload.action ?? 'BUY',
      side: payload.side ?? ctx.decision.side,
      sizeUsd: payload.sizeUsd ?? ctx.decision.sizeUsd,
      price: payload.price ?? (ctx.decision.side === 'YES' ? ctx.market.yesPrice : ctx.market.noPrice),
      status: payload.status ?? 'OPEN',
      slippageBps: payload.slippageBps ?? 0,
      createdAt: payload.createdAt ?? new Date().toISOString()
    };
  }
}
