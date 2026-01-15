export interface User {
  suiAddress: string;
  vanityAddress?: string; // Optional vanity address (3-20 chars, URL-safe)
  linkedZKPs: ZKLink[];
  profile?: UserProfile;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserProfile {
  displayName?: string;
  bio?: string;
  avatar?: string; // URL to profile picture
  banner?: string; // URL to banner image
  website?: string;
  location?: string;
  verified?: boolean; // Whether the vanity address is verified/paid
}

export interface VanityAddress {
  address: string; // The vanity address (3-20 chars)
  owner: string; // SUI address of owner
  price: number; // Price paid in SUI
  purchasedAt: Date;
  expiresAt?: Date; // Optional expiration for rented addresses
  verified: boolean;
}

export interface ZKLink {
  provider: ZKProvider;
  proof: string;
  linkedAt: Date;
}

export type ZKProvider = 'github' | 'gmail' | 'facebook';

export interface AuthChallenge {
  id: string;
  suiAddress: string;
  challenge: string;
  expiresAt: Date;
}

export interface AuthToken {
  userId: string;
  suiAddress: string;
  token: string;
  expiresAt: Date;
}

export interface ZKLoginRequest {
  suiAddress: string;
  signature: string;
  proof: string;
  provider?: ZKProvider;
}

export interface ZKLinkRequest {
  suiAddress: string;
  provider: ZKProvider;
  challengeId: string;
  proof: string;
}