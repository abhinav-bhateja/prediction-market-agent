import { describe, expect, it } from 'vitest';
import { PaperTradingBroker } from '../src/execution/paperTradingBroker.js';
import type { DecisionResult, Order, Position } from '../src/types/domain.js';

// In-memory repo stub — no SQLite needed
const makeRepo = (initialCash = 10000) => {
  let cash = initialCash;
  const orders: Order[] = [];
  const positions: Position[] = [];
  return {
    getCashBalance: () => cash,
    setCashBalance: (v: number) => { cash = v; },
    saveOrder: (o: Order) => orders.push(o),
    upsertPosition: (p: Position) => {
      const idx = positions.findIndex((x) => x.marketId === p.marketId && x.side === p.side);
      if (idx >= 0) positions[idx] = p; else positions.push(p);
    },
    getPositions: () => positions,
    _orders: orders,
    _positions: positions
  };
};

const market = (overrides = {}) => ({
  id: 'm1',
  question: 'Test market',
  yesPrice: 0.6,
  noPrice: 0.4,
  volume24h: 100000,
  liquidity: 500000,
  tags: [],
  isResolved: false,
  ...overrides
});

const decision = (overrides: Partial<DecisionResult> = {}): DecisionResult => ({
  marketId: 'm1',
  action: 'BUY',
  side: 'YES',
  sizeUsd: 100,
  edge: 0.1,
  confidence: 0.7,
  kellyFraction: 0.1,
  reason: 'test',
  constraintsApplied: [],
  createdAt: new Date().toISOString(),
  ...overrides
});

const ctx = (overrides: { decision?: Partial<DecisionResult>; market?: object; positions?: Position[] } = {}) => ({
  decision: decision(overrides.decision),
  market: market(overrides.market),
  bankrollUsd: 10000,
  positions: overrides.positions ?? []
});

describe('PaperTradingBroker.placeOrder', () => {
  it('returns null for HOLD decisions', async () => {
    const repo = makeRepo();
    const broker = new PaperTradingBroker(repo as never);
    const result = await broker.placeOrder(ctx({ decision: { action: 'HOLD', sizeUsd: 0 } }));
    expect(result).toBeNull();
  });

  it('returns null for zero-size BUY', async () => {
    const repo = makeRepo();
    const broker = new PaperTradingBroker(repo as never);
    const result = await broker.placeOrder(ctx({ decision: { sizeUsd: 0 } }));
    expect(result).toBeNull();
  });

  it('fills order and deducts cash', async () => {
    const repo = makeRepo(10000);
    const broker = new PaperTradingBroker(repo as never);
    const order = await broker.placeOrder(ctx({ decision: { sizeUsd: 500 } }));

    expect(order).not.toBeNull();
    expect(order!.status).toBe('FILLED');
    expect(order!.action).toBe('BUY');
    expect(repo.getCashBalance()).toBeLessThan(10000);
    expect(repo.getCashBalance()).toBeCloseTo(10000 - 500, 0);
  });

  it('applies slippage — fill price is worse than base price for BUY YES', async () => {
    const repo = makeRepo();
    const broker = new PaperTradingBroker(repo as never);
    const order = await broker.placeOrder(ctx());
    // BUY YES: fill price should be >= base yesPrice (0.6)
    expect(order!.price).toBeGreaterThanOrEqual(0.6);
  });

  it('applies slippage — fill price is worse than base price for BUY NO', async () => {
    const repo = makeRepo();
    const broker = new PaperTradingBroker(repo as never);
    const order = await broker.placeOrder(ctx({ decision: { side: 'NO' } }));
    // BUY NO: fill price should be <= base noPrice (0.4) — worse fill means lower price
    expect(order!.price).toBeLessThanOrEqual(0.4);
  });

  it('creates a new position when none exists', async () => {
    const repo = makeRepo();
    const broker = new PaperTradingBroker(repo as never);
    await broker.placeOrder(ctx({ decision: { sizeUsd: 200 } }));

    const positions = repo.getPositions();
    expect(positions).toHaveLength(1);
    expect(positions[0].marketId).toBe('m1');
    expect(positions[0].side).toBe('YES');
    expect(positions[0].quantity).toBeGreaterThan(0);
  });

  it('averages into existing position', async () => {
    const repo = makeRepo();
    const broker = new PaperTradingBroker(repo as never);

    // First buy
    await broker.placeOrder(ctx({ decision: { sizeUsd: 200 } }));
    const firstQty = repo.getPositions()[0].quantity;

    // Second buy — same market/side
    await broker.placeOrder(ctx({ decision: { sizeUsd: 200 }, positions: repo.getPositions() }));
    const secondQty = repo.getPositions()[0].quantity;

    expect(secondQty).toBeGreaterThan(firstQty);
    expect(repo._orders).toHaveLength(2);
  });

  it('higher liquidity means lower slippage', async () => {
    const lowLiq = makeRepo();
    const highLiq = makeRepo();
    const brokerLow = new PaperTradingBroker(lowLiq as never);
    const brokerHigh = new PaperTradingBroker(highLiq as never);

    const orderLow = await brokerLow.placeOrder(ctx({ market: { liquidity: 10000 } }));
    const orderHigh = await brokerHigh.placeOrder(ctx({ market: { liquidity: 10000000 } }));

    expect(orderLow!.slippageBps).toBeGreaterThan(orderHigh!.slippageBps);
  });

  it('caps cash at 0 if order exceeds balance', async () => {
    const repo = makeRepo(50); // only $50
    const broker = new PaperTradingBroker(repo as never);
    await broker.placeOrder(ctx({ decision: { sizeUsd: 200 } }));
    expect(repo.getCashBalance()).toBe(0);
  });
});

describe('PaperTradingBroker.closePosition', () => {
  const openPosition = (): Position => ({
    marketId: 'm1',
    side: 'YES',
    quantity: 100,
    avgPrice: 0.55,
    markPrice: 0.6,
    unrealizedPnl: 5,
    realizedPnl: 0,
    updatedAt: new Date().toISOString()
  });

  it('returns null for zero-quantity position', async () => {
    const repo = makeRepo();
    const broker = new PaperTradingBroker(repo as never);
    const pos = { ...openPosition(), quantity: 0 };
    const result = await broker.closePosition(pos, market());
    expect(result).toBeNull();
  });

  it('creates SELL order and zeroes position quantity', async () => {
    const repo = makeRepo(5000);
    const broker = new PaperTradingBroker(repo as never);
    const pos = openPosition();
    const order = await broker.closePosition(pos, market());

    expect(order).not.toBeNull();
    expect(order!.action).toBe('SELL');
    expect(order!.status).toBe('FILLED');

    const closedPos = repo.getPositions()[0];
    expect(closedPos.quantity).toBe(0);
  });

  it('adds proceeds to cash balance', async () => {
    const repo = makeRepo(5000);
    const broker = new PaperTradingBroker(repo as never);
    const pos = openPosition();
    await broker.closePosition(pos, market());

    expect(repo.getCashBalance()).toBeGreaterThan(5000);
  });

  it('records realized PnL correctly', async () => {
    const repo = makeRepo(5000);
    const broker = new PaperTradingBroker(repo as never);
    const pos = openPosition(); // avgPrice=0.55, markPrice=0.6
    await broker.closePosition(pos, market()); // yesPrice=0.6

    const closedPos = repo.getPositions()[0];
    // Realized PnL should be positive (bought at 0.55, selling near 0.6)
    expect(closedPos.realizedPnl).toBeGreaterThan(0);
  });

  it('fill price is worse than base price for SELL (slippage)', async () => {
    const repo = makeRepo(5000);
    const broker = new PaperTradingBroker(repo as never);
    const pos = openPosition();
    const order = await broker.closePosition(pos, market());
    // SELL YES: fill price should be <= yesPrice (0.6)
    expect(order!.price).toBeLessThanOrEqual(0.6);
  });
});
