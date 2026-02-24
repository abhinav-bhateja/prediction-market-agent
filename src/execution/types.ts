import type { DecisionResult, Market, Order, Position } from '../types/domain.js';

export interface ExecuteContext {
  decision: DecisionResult;
  market: Market;
  bankrollUsd: number;
  positions: Position[];
}

export interface ExecutionBroker {
  placeOrder(ctx: ExecuteContext): Promise<Order | null>;
  closePosition(position: Position, market: Market): Promise<Order | null>;
}
