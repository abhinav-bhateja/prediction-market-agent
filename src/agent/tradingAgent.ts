import { config } from '../config/index.js';
import { DataIngestionService } from '../data/ingestionService.js';
import { DecisionEngine } from '../decision/decisionEngine.js';
import { PaperTradingBroker } from '../execution/paperTradingBroker.js';
import { PolymarketBroker } from '../execution/polymarketBroker.js';
import type { ExecutionBroker } from '../execution/types.js';
import { LearningEngine } from '../learning/learningEngine.js';
import { ReasoningEngine } from '../reasoning/reasoningEngine.js';
import { Repository } from '../storage/repository.js';
import type { AgentCycleResult, Market } from '../types/domain.js';
import { logger } from '../utils/logger.js';

export interface AgentStatus {
  running: boolean;
  lastCycleAt?: string;
  cyclesCompleted: number;
  activeMarkets: Market[];
  mode: 'PAPER' | 'LIVE';
}

export class TradingAgent {
  private readonly ingestion = new DataIngestionService();
  private readonly reasoning = new ReasoningEngine();
  private readonly decision = new DecisionEngine();
  private readonly repo = new Repository();
  private readonly learning = new LearningEngine(this.repo);
  private readonly broker: ExecutionBroker;

  private interval?: NodeJS.Timeout;
  private isRunning = false;
  private status: AgentStatus = {
    running: false,
    cyclesCompleted: 0,
    activeMarkets: [],
    mode: config.PAPER_TRADING ? 'PAPER' : 'LIVE'
  };

  constructor() {
    this.repo.setInitialBankroll(config.STARTING_BANKROLL_USD);
    this.broker = config.PAPER_TRADING ? new PaperTradingBroker(this.repo) : new PolymarketBroker();
  }

  getStatus(): AgentStatus {
    return this.status;
  }

  getRepo(): Repository {
    return this.repo;
  }

  getLearningEngine(): LearningEngine {
    return this.learning;
  }

  /** Enforce stop-loss: close any position down more than STOP_LOSS_PCT. */
  private async enforceStopLoss(markets: Market[]): Promise<void> {
    const positions = this.repo.getPositions().filter((p) => p.quantity > 0);
    await Promise.allSettled(
      positions.map(async (pos) => {
        const market = markets.find((m) => m.id === pos.marketId);
        if (!market) return;

        const markPrice = pos.side === 'YES' ? market.yesPrice : market.noPrice;
        const pnlPct = (markPrice - pos.avgPrice) / pos.avgPrice;

        if (pnlPct <= -config.STOP_LOSS_PCT) {
          logger.warn('Stop-loss triggered', {
            marketId: pos.marketId,
            side: pos.side,
            pnlPct: pnlPct.toFixed(4),
            threshold: -config.STOP_LOSS_PCT
          });
          await this.broker.closePosition(pos, market);
        }
      })
    );
  }

  private async processMarket(market: Market): Promise<AgentCycleResult> {
    const snapshot = await this.ingestion.buildSnapshot(market);
    const reasoning = await this.reasoning.analyze(snapshot);
    const positions = this.repo.getPositions();
    const bankroll = this.repo.getCashBalance();
    const decision = this.decision.decide(reasoning, bankroll, positions);
    const order = await this.broker.placeOrder({ decision, market, bankrollUsd: bankroll, positions });

    const cycle: AgentCycleResult = {
      marketId: market.id,
      snapshot,
      reasoning,
      decision,
      order: order ?? undefined
    };

    this.repo.logCycle(cycle);
    return cycle;
  }

  async runOneCycle(): Promise<AgentCycleResult[]> {
    const markets = await this.ingestion.getMarkets(15);
    this.status.activeMarkets = markets;

    // Enforce stop-loss before placing new orders
    await this.enforceStopLoss(markets);

    // Process all markets in parallel
    const settled = await Promise.allSettled(markets.map((m) => this.processMarket(m)));

    const cycleResults: AgentCycleResult[] = [];
    for (const result of settled) {
      if (result.status === 'fulfilled') {
        cycleResults.push(result.value);
      } else {
        logger.error('Market cycle failed', { reason: result.reason });
      }
    }

    this.status.cyclesCompleted += 1;
    this.status.lastCycleAt = new Date().toISOString();

    return cycleResults;
  }

  async start(): Promise<void> {
    if (this.isRunning) return;

    this.isRunning = true;
    this.status.running = true;

    await this.runOneCycle();

    this.interval = setInterval(async () => {
      try {
        await this.runOneCycle();
      } catch (error) {
        logger.error('Agent interval run failed', error);
      }
    }, config.AGENT_LOOP_INTERVAL_MS);

    logger.info(`Trading agent started in ${this.status.mode} mode`, {
      intervalMs: config.AGENT_LOOP_INTERVAL_MS
    });
  }

  stop(): void {
    if (this.interval) clearInterval(this.interval);
    this.interval = undefined;
    this.isRunning = false;
    this.status.running = false;
    logger.info('Trading agent stopped');
  }
}
