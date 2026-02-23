export type MarketSide = 'YES' | 'NO';
export type TradeAction = 'BUY' | 'SELL' | 'HOLD';

export interface Market {
  id: string;
  question: string;
  eventDate?: string;
  yesPrice: number;
  noPrice: number;
  volume24h: number;
  liquidity: number;
  tags: string[];
  isResolved: boolean;
}

export interface NewsItem {
  id: string;
  title: string;
  source: string;
  url: string;
  publishedAt: string;
  summary?: string;
}

export interface SocialSignal {
  id: string;
  platform: 'X' | 'REDDIT';
  topic: string;
  sentimentScore: number;
  confidence: number;
  url?: string;
  observedAt: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  category: string;
  relevanceScore: number;
}

export interface IngestedSnapshot {
  timestamp: string;
  market: Market;
  news: NewsItem[];
  social: SocialSignal[];
  events: CalendarEvent[];
}

export interface ReasoningResult {
  marketId: string;
  estimatedProbabilityYes: number;
  marketProbabilityYes: number;
  edge: number;
  confidence: number;
  rationale: string;
  keyDrivers: string[];
  riskFlags: string[];
  createdAt: string;
}

export interface DecisionResult {
  marketId: string;
  action: TradeAction;
  side: MarketSide;
  sizeUsd: number;
  edge: number;
  confidence: number;
  kellyFraction: number;
  reason: string;
  constraintsApplied: string[];
  createdAt: string;
}

export interface Order {
  id: string;
  marketId: string;
  action: 'BUY' | 'SELL';
  side: MarketSide;
  sizeUsd: number;
  price: number;
  status: 'OPEN' | 'FILLED' | 'REJECTED';
  slippageBps: number;
  createdAt: string;
}

export interface Position {
  marketId: string;
  side: MarketSide;
  quantity: number;
  avgPrice: number;
  markPrice: number;
  unrealizedPnl: number;
  realizedPnl: number;
  updatedAt: string;
}

export interface AgentCycleResult {
  marketId: string;
  snapshot: IngestedSnapshot;
  reasoning: ReasoningResult;
  decision: DecisionResult;
  order?: Order;
}
