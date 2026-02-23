import { randomUUID } from 'node:crypto';
import type { Order, Position } from '../types/domain.js';
import type { ExecuteContext, ExecutionBroker } from './types.js';
import { Repository } from '../storage/repository.js';
import { nowIso } from '../utils/time.js';

const estimateSlippageBps = (sizeUsd: number, liquidity: number): number => {
  if (liquidity <= 0) return 200;
  const impact = (sizeUsd / liquidity) * 10000;
  return Math.max(5, Math.min(250, impact));
};

const applySlippage = (price: number, side: 'YES' | 'NO', action: 'BUY' | 'SELL', slippageBps: number): number => {
  const slip = slippageBps / 10000;
  const direction = action === 'BUY' ? 1 : -1;
  const adjusted = side === 'YES' ? price + direction * slip : price + direction * slip;
  return Math.min(0.999, Math.max(0.001, adjusted));
};

export class PaperTradingBroker implements ExecutionBroker {
  constructor(private readonly repo: Repository) {}

  async placeOrder(ctx: ExecuteContext): Promise<Order | null> {
    if (ctx.decision.action !== 'BUY' || ctx.decision.sizeUsd <= 0) return null;

    const basePrice = ctx.decision.side === 'YES' ? ctx.market.yesPrice : ctx.market.noPrice;
    const slippageBps = estimateSlippageBps(ctx.decision.sizeUsd, ctx.market.liquidity);
    const fillPrice = applySlippage(basePrice, ctx.decision.side, 'BUY', slippageBps);

    const order: Order = {
      id: randomUUID(),
      marketId: ctx.market.id,
      action: 'BUY',
      side: ctx.decision.side,
      sizeUsd: ctx.decision.sizeUsd,
      price: fillPrice,
      status: 'FILLED',
      slippageBps,
      createdAt: nowIso()
    };

    const quantity = order.sizeUsd / order.price;
    const existing = ctx.positions.find((p) => p.marketId === order.marketId && p.side === order.side);

    const next: Position = existing
      ? {
          ...existing,
          quantity: existing.quantity + quantity,
          avgPrice: (existing.avgPrice * existing.quantity + quantity * fillPrice) / (existing.quantity + quantity),
          markPrice: fillPrice,
          unrealizedPnl: (fillPrice - existing.avgPrice) * existing.quantity,
          updatedAt: nowIso()
        }
      : {
          marketId: order.marketId,
          side: order.side,
          quantity,
          avgPrice: fillPrice,
          markPrice: fillPrice,
          unrealizedPnl: 0,
          realizedPnl: 0,
          updatedAt: nowIso()
        };

    const nextCash = Math.max(0, this.repo.getCashBalance() - order.sizeUsd);

    this.repo.saveOrder(order);
    this.repo.upsertPosition(next);
    this.repo.setCashBalance(nextCash);

    return order;
  }
}
