// Billing and monetization types
export interface BillingOverview {
  owner: string;
  subscription: SubscriptionStatus;
  suins: SuiNSTerm;
  payouts: PayoutBalances;
  storageFunding: StorageFundingStatus[];
}

export interface SubscriptionStatus {
  active: boolean;
  level?: 'basic' | 'premium' | 'enterprise';
  expiresAt?: Date;
  autoRenew?: boolean;
  suiBalance: number; // SUI amount
}

export interface SuiNSTerm {
  active: boolean;
  domain?: string;
  expiresAt?: Date;
  daysRemaining?: number;
  suiBalance: number; // SUI amount
}

export interface PayoutBalances {
  adShare: number; // SUI amount
  subscriptionShare: number; // SUI amount
  pmShare: number; // SUI amount
  premiumShare: number; // SUI amount from premium content sales
  total: number; // SUI amount
}

export interface StorageFundingStatus {
  dappId: string;
  dappName: string;
  blobId: string;
  termStart: Date;
  termEnd: Date;
  termLengthDays: number;
  storageCost: number; // SUI amount per term
  funded: number; // SUI amount funded so far
  coveragePercent: number;
  termProgressPercent: number;
  precarious: boolean; // At risk of expiration
  autoRenewEligible: boolean;
  pmContribution: number; // SUI from PM fees
  adContribution: number; // SUI from ad revenue
  fundingSource: 'pm' | 'ads' | 'mixed' | 'manual';
}

export interface ClaimPayoutRequest {
  owner: string;
  buckets: PayoutBucket[];
  recipientAddress: string;
}

export interface PayoutBucket {
  type: 'adShare' | 'subscriptionShare' | 'pmShare';
  amount: number; // SUI amount to claim
}

export interface ClaimPayoutResponse {
  transactionId: string;
  claimed: Record<string, number>; // bucket -> amount claimed
  total: number; // SUI total claimed
}

export interface BlobBillingInfo {
  blobId: string;
  termStart: Date;
  termEnd: Date;
  termLengthDays: number;
  storageCost: number; // SUI amount
  renewalCost: number; // SUI amount for next term
  funded: number; // SUI amount currently funded
  coveragePercent: number;
  termProgressPercent: number;
  precarious: boolean;
  autoRenewEligible: boolean;
}