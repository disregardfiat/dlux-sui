import brandLogoMarkUrl from '@/brand-logo-mark.svg';
import brandLogoSquareUrl from '@/brand-logo-square.svg';

const env = (import.meta as any).env ?? {};
const isBrowser = typeof window !== 'undefined';

const normalizeProtocol = (value: string): string => {
  if (!value) return 'https';
  return value.replace(':', '');
};

const inferRootDomain = (host: string): string => {
  if (!host) return 'dlux.io';
  if (host === 'localhost' || host === '127.0.0.1') return host;
  if (host === 'test.dlux.io' || host.endsWith('.test.dlux.io')) return 'test.dlux.io';
  if (host.endsWith('.dlux.io')) return 'dlux.io';
  const parts = host.split('.');
  if (parts.length < 2) return host;
  return parts.slice(-2).join('.');
};

const runtimeHost = isBrowser ? window.location.hostname : '';

export const ROOT_DOMAIN = env.VITE_APP_ROOT_DOMAIN || env.VITE_APP_HOST || inferRootDomain(runtimeHost);
export const APP_PROTOCOL = normalizeProtocol(env.VITE_APP_PROTOCOL || (isBrowser ? window.location.protocol : 'https'));
export const APP_ORIGIN = env.VITE_APP_ORIGIN || (isBrowser ? window.location.origin : `${APP_PROTOCOL}://${ROOT_DOMAIN}`);
export const WALRUS_DOMAIN = env.VITE_WALRUS_DOMAIN || `walrus.${ROOT_DOMAIN}`;

/** For sandbox/dApp links: use walrus.dlux.io (production sandbox) when on test.dlux.io, since Caddy wildcard is *.walrus.dlux.io. */
export const SANDBOX_WALRUS_DOMAIN = env.VITE_SANDBOX_WALRUS_DOMAIN || (ROOT_DOMAIN === 'test.dlux.io' ? 'walrus.dlux.io' : WALRUS_DOMAIN);

export const BRAND_NAME = env.VITE_BRAND_NAME || 'DLUX';
export const BRAND_LONG_NAME = env.VITE_BRAND_LONG_NAME || 'Decentralized Limitless User eXperiences';
export const BRAND_TAGLINE = env.VITE_BRAND_TAGLINE || 'Decentralized Metaverse Platform';
export const BRAND_LOGO_URL = env.VITE_BRAND_LOGO_URL || '';
export const BRAND_LOGO_MARK_URL = env.VITE_BRAND_LOGO_MARK_URL || brandLogoMarkUrl;
export const BRAND_LOGO_SQUARE_URL = env.VITE_BRAND_LOGO_SQUARE_URL || brandLogoSquareUrl;
export const BRAND_LOGO_DARK_URL = env.VITE_BRAND_LOGO_DARK_URL || '';
export const BRAND_LOGO_LIGHT_URL = env.VITE_BRAND_LOGO_LIGHT_URL || '';

export const buildAccountPath = (identifier: string): string => `/@${identifier}`;

export const buildDappHost = (subdomain: string): string => `${subdomain}.${SANDBOX_WALRUS_DOMAIN}`;

export const buildDappUrl = (subdomain: string, permlink: string): string =>
  `${APP_PROTOCOL}://${buildDappHost(subdomain)}/${permlink}`;

/** Remix URL: /@owner/permlink/remix — serves remix.html from dApp blobs when present. */
export const buildDappRemixUrl = (owner: string, permlink: string, subdomain?: string): string =>
  buildSandboxUrl(owner, permlink, subdomain) + '/remix';

/** Sandbox URL for address-matched dApp (h+hex subdomain). Use subdomain from API when available. */
export const buildSandboxUrl = (owner: string, permlink: string, subdomain?: string): string => {
  const host = subdomain
    ? `${subdomain}.${SANDBOX_WALRUS_DOMAIN}`
    : buildDappHost(owner.startsWith('0x') ? 'h' + owner.slice(2).toLowerCase().replace(/^0x/, '').slice(0, 62) : permlink);
  return `${APP_PROTOCOL}://${host}/@${encodeURIComponent(owner)}/${encodeURIComponent(permlink)}`;
};

/** SUI network for explorer (mainnet | testnet). Inferred from host when not set. */
export const SUI_NETWORK = env.VITE_SUI_NETWORK || (ROOT_DOMAIN === 'test.dlux.io' || ROOT_DOMAIN === 'localhost' ? 'testnet' : 'mainnet');

/** Wallet Standard chain identifier for the current network (e.g. sui:testnet, sui:mainnet). */
export const SUI_CHAIN_ID = SUI_NETWORK === 'testnet' ? 'sui:testnet' : 'sui:mainnet';

/** Base URL for SUI block explorer (transaction pages). Use with buildExplorerTxUrl(digest). */
export const SUI_EXPLORER_BASE = env.VITE_SUI_EXPLORER_URL || `https://suiscan.xyz/${SUI_NETWORK}`;

/** Link to a transaction on the SUI explorer. */
export const buildExplorerTxUrl = (digest: string): string =>
  `${SUI_EXPLORER_BASE}/tx/${encodeURIComponent(digest)}`;

/** Link to an account/address on the SUI explorer. */
export const buildExplorerAddressUrl = (address: string): string =>
  `${SUI_EXPLORER_BASE}/account/${encodeURIComponent(address)}`;

/** Link to an object on the SUI explorer. */
export const buildExplorerObjectUrl = (objectId: string): string =>
  `${SUI_EXPLORER_BASE}/object/${encodeURIComponent(objectId)}`;

/** API domain for backend services (gql, sui, walrus). On test.dlux.io or *.dlux.io use dlux.io subdomains; on localhost use localhost. */
const apiDomain = (): string => {
  if (env.VITE_DGRAPH_SERVICE_URL) return ''; // env set; callers use env URLs
  if (ROOT_DOMAIN === 'localhost' || ROOT_DOMAIN === '127.0.0.1') return '';
  return 'dlux.io';
};

/** DGraph/GraphQL API base (no path). Prefer VITE_*; when served from test.dlux.io use https://gql.dlux.io. */
export const getDgraphServiceUrl = (): string => {
  const u = env.VITE_DGRAPH_SERVICE_URL || env.VITE_GRAPHQL_SERVICE_URL;
  if (u) return String(u).replace(/\/$/, '');
  const domain = apiDomain();
  if (domain) return `${APP_PROTOCOL}://gql.${domain}`;
  return 'http://localhost:3003';
};

/** SUI service API base (no path). Prefer VITE_*; when served from test.dlux.io use https://sui.dlux.io. */
export const getSuiServiceUrl = (): string => {
  const u = env.VITE_SUI_SERVICE_URL;
  if (u) return String(u).replace(/\/$/, '');
  const domain = apiDomain();
  if (domain) return `${APP_PROTOCOL}://sui.${domain}`;
  return 'http://localhost:3001';
};

/** Walrus service API base (no path). Prefer VITE_*; when served from test.dlux.io use https://walrus.dlux.io. */
export const getWalrusServiceUrl = (): string => {
  const u = env.VITE_WALRUS_SERVICE_URL;
  if (u) return String(u).replace(/\/$/, '');
  const domain = apiDomain();
  if (domain) return `${APP_PROTOCOL}://walrus.${domain}`;
  return 'http://localhost:3002';
};

/** Resolve /walrus/:blobId to absolute Walrus URL (e.g. https://walrus.dlux.io/blobs/:blobId). Use this so blob requests go to walrus.dlux.io, not the current origin (avoids 404 on test.dlux.io). Blob IDs may be hex or base64url (letters, digits, hyphen, underscore). */
export function resolveWalrusUrl(path: string | undefined): string {
  if (!path) return '';
  const m = path.match(/^\/walrus\/([a-zA-Z0-9_-]+)$/);
  if (m) return `${getWalrusServiceUrl()}/blobs/${m[1]}`;
  if (path.startsWith('http')) return path;
  return path;
}

/** URL for ads/consent. In dev (Walrus on localhost), uses /walrus proxy for same-origin cookie setting. */
export const getWalrusConsentUrl = (): string => {
  const base = getWalrusServiceUrl();
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(new URL(base).origin)) {
    return '/walrus/ads/consent';
  }
  return `${base}/ads/consent`;
};

/** Privacy policy URL. Defaults to walrus.dlux.io/privacy (or Walrus base in current env). */
export const PRIVACY_POLICY_URL = env.VITE_PRIVACY_POLICY_URL || `${getWalrusServiceUrl()}/privacy`;

/**
 * Link for users to acquire SUI (swaps, direct buys, on-ramps).
 * Prefer platforms with affiliate/referral programs—set VITE_GET_SUI_URL to your partner link.
 * Affiliate-capable: MoonPay (impact.com), Transak (transak.com/referral-program),
 * Coinbase, Binance, OKX, Robinhood. Default: Sui official hub.
 */
export const GET_SUI_URL =
  env.VITE_GET_SUI_URL || 'https://www.sui.io/get-started';

/** ZK service API base (no path). Prefer VITE_*; when served from dlux.io use https (if deployed); else localhost. */
export const getZKServiceUrl = (): string => {
  const u = env.VITE_ZK_SERVICE_URL;
  if (u) return String(u).replace(/\/$/, '');
  const domain = apiDomain();
  if (domain) return `${APP_PROTOCOL}://zk.${domain}`;
  return 'http://localhost:3010';
};

