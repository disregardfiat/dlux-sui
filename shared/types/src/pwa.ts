export interface WebAppManifest {
  name: string;
  short_name: string;
  description: string;
  start_url: string;
  display: 'standalone' | 'fullscreen' | 'minimal-ui' | 'browser';
  background_color: string;
  theme_color: string;
  orientation: 'portrait' | 'landscape' | 'any';
  icons: ManifestIcon[];
  categories: string[];
  screenshots?: ManifestScreenshot[];
  related_applications?: RelatedApplication[];
  prefer_related_applications?: boolean;
  scope: string;
  share_target?: ShareTarget;
}

export interface ManifestIcon {
  src: string;
  sizes: string;
  type: string;
  purpose?: 'any' | 'maskable' | 'monochrome';
}

export interface ManifestScreenshot {
  src: string;
  sizes: string;
  type: string;
  label?: string;
}

export interface RelatedApplication {
  platform: string;
  url: string;
  id?: string;
}

export interface ShareTarget {
  action: string;
  method: 'GET' | 'POST';
  enctype?: string;
  params: {
    title?: string;
    text?: string;
    url?: string;
    files?: Array<{
      name: string;
      accept: string[];
    }>;
  };
}

export interface DAppMetadata {
  // SUI blockchain data
  suiAddress: string;
  author: string;
  permlink: string;
  tag?: string;
  
  // dApp information
  title: string;
  description: string;
  version: string;
  thumbnail?: string;
  icon?: string;
  
  // Content references
  blobIds: string[];
  entryPoint: string;
  assets: string[];
  
  // PWA configuration
  display?: 'standalone' | 'fullscreen' | 'minimal-ui' | 'browser';
  themeColor?: string;
  backgroundColor?: string;
  
  // Metadata for crawlers
  ogImage?: string;
  ogTitle?: string;
  ogDescription?: string;
  
  // Timestamps
  createdAt: string;
  updatedAt: string;
}
