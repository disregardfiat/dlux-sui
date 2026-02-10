export type SafetyMetric =
  | 'safe-and-accurate'
  | 'nsfw'
  | 'age-restricted'
  | 'pen-test'
  | 'gdpr-compliance'
  | 'cookie-banner'
  | 'malware'
  | 'phishing'
  | 'scam'
  | 'sexual'
  | 'nudity'
  | 'violence'
  | 'gore'
  | 'drugs'
  | 'gambling'
  | 'language'
  | 'politics'
  | 'religion'
  | 'brand-safety'
  | 'other';

export type AgeRating = 'all' | '13+' | '16+' | '18+' | '21+';

export type ContentFlag =
  | 'sexual'
  | 'nudity'
  | 'violence'
  | 'gore'
  | 'drugs'
  | 'gambling'
  | 'language'
  | 'politics'
  | 'religion';

export type BrandSafetyTier = 'safe' | 'restricted' | 'unsafe';

export interface ContentMetadata {
  ageRating?: AgeRating;
  flags?: ContentFlag[];
  brandSafety?: BrandSafetyTier;
  geoRestrictions?: string[]; // ISO country or region codes
  categories?: string[]; // High-level genres/taxonomy
  politicalSpectrum?: {
    economic: number; // -1..1
    social: number; // -1..1
  };
}

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
  metadataKey?: keyof ContentMetadata;
  metadataValue?: string;
  
  // Market state
  status: 'open' | 'resolved' | 'cancelled';
  resolution: 'safe' | 'unsafe' | null;
  
  // Financial
  totalPool: number; // Total SUI in the market
  safePool: number; // SUI bet on "safe"
  unsafePool: number; // SUI bet on "unsafe"
  postingFeeContribution: number; // 50% of posting fee
  minPoolForRating?: number; // SUI threshold to be considered official
  
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
  isOfficial: boolean; // true if min pool threshold met
  minPoolForRating: number;
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

// Governance entities for controlling platform variables
export interface GovernanceVariable {
  name: string; // e.g., 'foundationShare', 'pmFundShare'
  value: string; // String representation to handle different types
  valueType: 'number' | 'percentage' | 'string';
  updatedAt: Date;
  lastChangedAt: Date;
  annualCapPct: number; // Default 0.10 (10% per year)
  description: string;
}

export interface GovernanceMarket {
  id: string;
  variable: string; // Reference to GovernanceVariable.name
  proposedValue: string; // Proposed new value
  stakeYes: number; // Total SUI staked on 'yes' (approve change)
  stakeNo: number; // Total SUI staked on 'no' (reject change)
  createdAt: Date;
  expiresAt: Date; // 7 days from creation
  resolvedAt?: Date;
  resolution?: 'yes' | 'no' | 'cap-blocked'; // 'cap-blocked' if change exceeds annual cap
  triggeredBy: 'posting' | 'file-change' | 'flag' | 'governance';
  triggeredByAddress: string;
}

export interface GovernanceBet {
  id: string;
  marketId: string;
  bettor: string; // SUI address
  side: 'yes' | 'no';
  amount: number; // SUI amount
  shares: number; // Calculated shares
  createdAt: Date;
  payout?: number; // Payout after resolution
}

export interface CreateGovernanceMarketRequest {
  variable: string;
  proposedValue: string;
  triggeredBy: 'posting' | 'file-change' | 'flag' | 'governance';
  triggeredByAddress: string;
}

export interface PlaceGovernanceBetRequest {
  marketId: string;
  bettor: string;
  side: 'yes' | 'no';
  amount: number;
}

export interface ResolveGovernanceMarketRequest {
  marketId: string;
  resolution?: 'yes' | 'no'; // Optional - will be determined by stake if not provided
}
