export type SafetyMetric =
  | 'nsfw'
  | 'age-restricted'
  | 'pen-test'
  | 'gdpr-compliance'
  | 'cookie-banner'
  | 'malware'
  | 'phishing'
  | 'scam'
  | 'other';

export type AgeRating = 'all' | '13+' | '16+' | '18+' | '21+';

export interface SafetyFlag {
  id: string;
  dappId: string;
  metric: SafetyMetric;
  description: string;
  flaggedBy: string; // SUI address of flagger
  createdAt: Date;
}

export interface PredictionMarket {
  id: string;
  dappId: string;
  safetyMetric: SafetyMetric;
  description: string;
  
  // Market state
  status: 'open' | 'resolved' | 'cancelled';
  resolution: 'safe' | 'unsafe' | null;
  
  // Financial
  totalPool: number; // Total SUI in the market
  safePool: number; // SUI bet on "safe"
  unsafePool: number; // SUI bet on "unsafe"
  postingFeeContribution: number; // 50% of posting fee
  
  // Age rating (for age-restricted markets)
  recommendedAge?: AgeRating;
  
  // Timing
  createdAt: Date;
  expiresAt: Date; // 3 days from creation
  resolvedAt: Date | null;
  
  // Participants
  bets: PredictionBet[];
  
  // Metadata
  triggeredBy: 'posting' | 'file-change' | 'flag';
  triggeredByAddress: string; // SUI address that triggered
}

export interface PredictionBet {
  id: string;
  marketId: string;
  bettor: string; // SUI address
  side: 'safe' | 'unsafe';
  amount: number; // SUI amount
  shares: number; // Shares purchased
  createdAt: Date;
  payout: number | null; // Payout if market resolved
}

export interface MarketStatus {
  market: PredictionMarket;
  statusColor: 'green' | 'yellow' | 'red';
  confidence: number; // 0-1, based on market odds
  daysRemaining: number;
  totalBets: number;
  activeBettors: number;
}

export interface DAppSafetyStatus {
  dappId: string;
  permlink: string;
  author: string;
  
  // Active markets
  activeMarkets: PredictionMarket[];
  
  // Overall status
  overallStatus: 'safe' | 'warning' | 'unsafe' | 'unknown';
  overallColor: 'green' | 'yellow' | 'red' | 'gray';
  
  // Resolved markets
  resolvedMarkets: PredictionMarket[];
  
  // Flags
  flags: SafetyFlag[];
  
  // Last updated
  lastChecked: Date;
}

export interface CreateMarketRequest {
  dappId: string;
  safetyMetric: SafetyMetric;
  description?: string;
  recommendedAge?: AgeRating; // For age-restricted markets
  triggeredBy: 'posting' | 'file-change' | 'flag';
  triggeredByAddress: string;
  postingFeeContribution?: number; // Optional if from posting fee
}

export interface PlaceBetRequest {
  marketId: string;
  bettor: string;
  side: 'safe' | 'unsafe';
  amount: number;
}

export interface ResolveMarketRequest {
  marketId: string;
  resolution: 'safe' | 'unsafe';
}
