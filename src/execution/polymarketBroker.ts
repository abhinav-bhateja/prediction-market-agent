import type { Order, Position } from '../types/domain.js';
import type { ExecuteContext, ExecutionBroker } from './types.js';
import { config } from '../config/index.js';

export class PolymarketBroker implements ExecutionBroker {
  private async post(path: string, body: unknown): Promise<Response> {
    return fetch(`${config.POLYMARKET_API_BASE_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(config.POLYMARKET_API_KEY ? { Authorization: `Bearer ${config.POLYMARKET_API_KEY}` } : {})
      },
      body: JSON.stringify(body)
    });
  }

  async placeOrder(ctx: ExecuteContext): Promise<Order | null> {
    if (ctx.decision.action !== 'BUY' || ctx.decision.sizeUsd <= 0) return null;

    const response = await this.post('/orders', {
      marketId: ctx.market.id,
      side: ctx.decision.side,
      action: 'BUY',
      sizeUsd: ctx.decision.sizeUsd
    });

    if (!response.ok) return null;

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

  async closePosition(position: Position, market: { id: string; yesPrice: number; noPrice: number }): Promise<Order | null> {
    if (position.quantity <= 0) return null;

    const price = position.side === 'YES' ? market.yesPrice : market.noPrice;
    const response = await this.post('/orders', {
      marketId: position.marketId,
      side: position.side,
      action: 'SELL',
      quantity: position.quantity
    });

    if (!response.ok) return null;

    const payload = (await response.json()) as Partial<Order>;
    return {
      id: payload.id ?? `poly-close-${Date.now()}`,
      marketId: position.marketId,
      action: 'SELL',
      side: position.side,
      sizeUsd: position.quantity * price,
      price: payload.price ?? price,
      status: payload.status ?? 'OPEN',
      slippageBps: payload.slippageBps ?? 0,
      createdAt: payload.createdAt ?? new Date().toISOString()
    };
  }
}
