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
  version: string;
  manifest: any; // Will be DAppManifest from dapp.ts
  blobIds: string[];
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface SUIEvent {
  id: string;
  type: string;
  packageId: string;
  transactionDigest: string;
  event: any;
  timestamp: Date;
}