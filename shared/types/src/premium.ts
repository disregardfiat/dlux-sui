// Premium content types
export interface PremiumContent {
  id: string;
  name: string;
  description: string;
  price: number; // SUI amount
  contentType: string;
  originalSize: number;
  owner: string;
  dappId: string;
  sealObjectId: string;
  status: 'active' | 'inactive';
  createdAt: Date;
  updatedAt: Date;
}

export interface PremiumPurchase {
  id: string;
  contentId: string;
  buyer: string;
  paymentTxId: string;
  accessGrantId: string;
  price: number;
  purchasedAt: Date;
}

export interface CreatePremiumContentRequest {
  name: string;
  description?: string;
  price: number;
  contentType?: string;
  owner: string;
  dappId: string;
  file: File;
}

export interface PurchasePremiumContentRequest {
  contentId: string;
  buyer: string;
  paymentTxId: string;
}

export interface PremiumContentAccess {
  contentId: string;
  user: string;
  hasAccess: boolean;
  canPurchase: boolean;
}