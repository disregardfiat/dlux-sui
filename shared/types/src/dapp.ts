export interface DApp {
  id: string;
  name: string;
  description: string;
  owner: string;
  version: string;
  manifest: DAppManifest;
  blobIds: string[];
  tags: string[];
  category: DAppCategory;
  rating: number;
  downloadCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface DAppManifest {
  entryPoint: string;
  assets: string[];
  dependencies: string[];
  permissions: DAppPermission[];
  metadata: {
    title: string;
    description: string;
    author: string;
    version: string;
    license?: string;
    thumbnail?: string;
  };
}

export type DAppCategory =
  | 'social'
  | 'gaming'
  | 'productivity'
  | 'finance'
  | 'education'
  | 'entertainment'
  | 'utility'
  | 'other';

export type DAppPermission =
  | 'wallet:read'
  | 'wallet:sign'
  | 'storage:read'
  | 'storage:write'
  | 'presence:read'
  | 'presence:write'
  | 'network:fetch'
  | 'camera'
  | 'microphone'
  | 'geolocation';

export interface DAppSearchQuery {
  query?: string;
  category?: DAppCategory;
  tags?: string[];
  owner?: string;
  limit?: number;
  offset?: number;
  sortBy?: 'rating' | 'downloads' | 'created' | 'updated';
  sortOrder?: 'asc' | 'desc';
}

export interface DAppSearchResult {
  dapps: DApp[];
  total: number;
  hasMore: boolean;
}