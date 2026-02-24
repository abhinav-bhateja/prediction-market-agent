import express, { type NextFunction, type Request, type Response } from 'express';
import { config } from '../config/index.js';
import type { TradingAgent } from '../agent/tradingAgent.js';

const requireApiKey = (req: Request, res: Response, next: NextFunction): void => {
  if (!config.API_KEY) { next(); return; }
  const provided = req.headers['x-api-key'] ?? req.query['api_key'];
  if (provided !== config.API_KEY) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
};

export const createApiServer = (agent: TradingAgent) => {
  const app = express();
  app.use(express.json());

  // Health is always public
  app.get('/health', (_req, res) => {
    const status = agent.getStatus();
    res.json({
      ok: true,
      running: status.running,
      mode: status.mode,
      lastCycleAt: status.lastCycleAt,
      cyclesCompleted: status.cyclesCompleted,
      timestamp: new Date().toISOString()
    });
  });

  // All other routes require API key when configured
  app.use(requireApiKey);

  app.get('/markets', (_req, res) => {
    res.json({ markets: agent.getStatus().activeMarkets });
  });

  app.get('/positions', (_req, res) => {
    const repo = agent.getRepo();
    res.json({
      cashUsd: repo.getCashBalance(),
      positions: repo.getPositions(),
      orders: repo.getOrders(100)
    });
  });

  app.get('/pnl', (_req, res) => {
    const repo = agent.getRepo();
    const cash = repo.getCashBalance();
    const positions = repo.getPositions();
    const unrealized = positions.reduce((acc, p) => acc + p.unrealizedPnl, 0);
    const realized = positions.reduce((acc, p) => acc + p.realizedPnl, 0);

    res.json({
      cashUsd: cash,
      unrealizedPnl: unrealized,
      realizedPnl: realized,
      netPnl: unrealized + realized
    });
  });

  app.get('/reasoning', (_req, res) => {
    const logs = agent.getRepo().getRecentCycleLogs(100);
    const parsed = logs.map((row) => ({
      marketId: row.market_id,
      createdAt: row.created_at,
      snapshot: JSON.parse(String(row.snapshot_json)),
      reasoning: JSON.parse(String(row.reasoning_json)),
      decision: JSON.parse(String(row.decision_json)),
      order: row.order_json ? JSON.parse(String(row.order_json)) : null
    }));

    res.json({ decisions: parsed });
  });

  app.get('/metrics', (_req, res) => {
    const metrics = agent.getLearningEngine().getPerformanceMetrics();
    res.json({ metrics });
  });

  app.post('/agent/run-once', async (_req, res) => {
    const result = await agent.runOneCycle();
    res.json({ ran: true, marketsProcessed: result.length });
  });

  app.post('/agent/start', async (_req, res) => {
    await agent.start();
    res.json({ started: true });
  });

  app.post('/agent/stop', (_req, res) => {
    agent.stop();
    res.json({ stopped: true });
  });

  const server = app.listen(config.PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`API listening on http://localhost:${config.PORT}`);
  });

  return { app, server };
};
