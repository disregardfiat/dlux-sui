export interface SUITextObject {
  id: string;
  owner: string;
  content: string;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface SUIdApp {
  id: string;
  name: string;
  description: string;
  owner: string;
  permlink: string; // Unique identifier for URL (e.g., "mygame")
  /** Address-matched subdomain from API: "h" + hex of owner (no 0x), up to 62 chars. */
  subdomain?: string;
  version: string;
  manifest: any; // Will be DAppManifest from dapp.ts
  blobIds: string[];
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  muted?: boolean; // Whether dApp is paused/muted (hidden from listings, reduces ads/slashing)
}

export interface SUIEvent {
  id: string;
  type: string;
  packageId: string;
  transactionDigest: string;
  event: any;
  timestamp: Date;
}

export interface SUINft {
  objectId: string;
  owner: string;
  name?: string;
  description?: string;
  imageUrl?: string;
  collection?: string;
  type?: string;
}