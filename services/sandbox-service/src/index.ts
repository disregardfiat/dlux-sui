import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { logger } from './utils/logger';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3007;

const SUI_SERVICE_URL = process.env.SUI_SERVICE_URL || 'http://localhost:3001';
const DGRAPH_SERVICE_URL = process.env.DGRAPH_SERVICE_URL || 'http://localhost:3003';
const WALRUS_SERVICE_URL = process.env.WALRUS_SERVICE_URL || 'http://localhost:3002';
const ZK_SERVICE_URL = process.env.ZK_SERVICE_URL || 'http://localhost:3010';

const HTTP_TIMEOUT_MS = parseInt(process.env.HTTP_TIMEOUT_MS || '1500', 10);

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json());

function firstHostLabel(hostname: string | undefined): string {
  if (!hostname) return 'dapp';
  const parts = hostname.split('.');
  return parts[0] || 'dapp';
}

/** DNS label max 63 chars (RFC 1035). Subdomain = "h" + hex (no 0x), so h + up to 62 hex = 63 chars. */
const SUBDOMAIN_HEX_MAX = 62;

/** Normalized subdomain for a SUI address: "h" + hex (no 0x), up to 62 hex chars (63 chars total). */
function addressSubdomain(addr: string): string {
  const normalized = (addr || '').toLowerCase().replace(/^0x/, '');
  const hex = normalized.replace(/[^a-f0-9]/g, '').slice(0, SUBDOMAIN_HEX_MAX);
  return hex ? `h${hex}` : '';
}

/** True if subdomain looks like address subdomain (h + 1..62 hex chars). */
function isAddressSubdomain(subdomain: string): boolean {
  return /^h[a-f0-9]{1,62}$/i.test((subdomain || '').trim());
}

/** Resolve SuiNS subdomain (e.g. "disregardfiat") to owner address. Returns null if not a SuiNS or resolve fails. */
async function resolveSuinsSubdomainToAddress(subdomain: string): Promise<string | null> {
  if (!subdomain || subdomain.length > 63) return null;
  const name = subdomain.includes('.') ? subdomain : `${subdomain}.sui`;
  try {
    const res = await axios.get(`${SUI_SERVICE_URL}/suins/resolve/${encodeURIComponent(name)}`, {
      timeout: HTTP_TIMEOUT_MS,
      validateStatus: (s) => s === 200 || s === 404
    });
    if (res.status === 200 && res.data?.address) return String(res.data.address).toLowerCase();
  } catch { /* ignore */ }
  return null;
}

function parseDappContext(req: express.Request): { author: string | null; permlink: string | null; dappId: string } {
  const subdomain = firstHostLabel(req.hostname);
  const match = req.path.match(/^\/@([^/]+)\/([^/]+)/);
  const author = match?.[1] || null;
  const permlink = match?.[2] || (subdomain || null);
  const dappId = author && permlink ? `${author}_${permlink}` : subdomain;
  return { author, permlink, dappId };
}

function escapeForInlineJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

/** Check if the <head> section of an HTML string already contains a tag matching the pattern (case-insensitive). */
function headHasTag(html: string, pattern: RegExp): boolean {
  const headMatch = html.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
  if (!headMatch) return false;
  return pattern.test(headMatch[1]);
}

/** Escape a string for safe embedding inside an HTML attribute (double-quoted). */
function escapeAttr(s: string): string {
  return String(s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Infer MIME type from file path for asset responses (when Walrus omits or sends wrong Content-Type). */
function mimeTypeFromPath(filePath: string): string | null {
  const ext = path.extname(filePath).toLowerCase();
  const mime: Record<string, string> = {
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.mjs': 'application/javascript',
    '.json': 'application/json',
    '.html': 'text/html',
    '.htm': 'text/html',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.wasm': 'application/wasm'
  };
  return mime[ext] ?? null;
}

/** Fetch prediction-market safety for dApp and return HTML banner for gateway (negative accuracy, less tested, overall status). */
async function fetchSafetyBannerHtml(dappId: string): Promise<string> {
  try {
    const safetyRes = await axios.get(`${DGRAPH_SERVICE_URL}/safety/dapp/${encodeURIComponent(dappId)}`, {
      timeout: HTTP_TIMEOUT_MS
    });
    const s = safetyRes.data;
    const status = String(s?.overallStatus || 'unknown').toUpperCase();
    const negativeAccuracy = s?.negativeAccuracy === true;
    const lessTested = s?.lessTested === true;
    const hasMeaningfulSignal = status !== 'UNKNOWN' || negativeAccuracy || lessTested;
    if (!hasMeaningfulSignal) return '';
    const color =
      s?.overallColor === 'red'
        ? '#7f1d1d'
        : s?.overallColor === 'yellow'
          ? '#713f12'
          : s?.overallColor === 'green'
            ? '#14532d'
            : '#1e293b';
    const borderColor =
      s?.overallColor === 'red'
        ? 'rgba(248,113,113,0.4)'
        : s?.overallColor === 'yellow'
          ? 'rgba(251,191,36,0.4)'
          : 'rgba(148,163,184,0.25)';
    const parts: string[] = [`<strong>Safety status:</strong> ${status}`];
    if (negativeAccuracy) parts.push('Market currently in negative accuracy range.');
    if (lessTested) parts.push('This content is less tested.');
    const text = parts.join(' ');
    return `<div class="dlux-safety-banner" style="background:${color};color:#e5e7eb;border:1px solid ${borderColor};padding:12px;border-radius:10px;margin:12px 0;">
  ${text}
</div>`;
  } catch {
    return '';
  }
}

function buildServiceWorker(subdomain: string): string {
  // Minimal offline caching of "/" for PWA install UX.
  return `const C='dlux-${subdomain}-v1';
self.addEventListener('install',e=>e.waitUntil(caches.open(C).then(c=>c.addAll(['/']))));
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('fetch',e=>e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request))));`;
}

function buildWalletScript(): string {
  // Minimal wallet standard + common fallbacks.
  return `(() => {
  const getStandardWallet = () => {
    try {
      const anyWindow = window;
      const wallets = anyWindow?.suiWallets?.get?.();
      if (Array.isArray(wallets) && wallets.length) return wallets[0];
    } catch {}
    return null;
  };

  const getLegacyWallet = () => {
    const anyWindow = window;
    return anyWindow?.suiWallet || anyWindow?.SuiWallet || anyWindow?.slush || anyWindow?.slushWallet || null;
  };

  const connect = async () => {
    const standard = getStandardWallet();
    if (standard?.features?.['standard:connect']?.connect) {
      const result = await standard.features['standard:connect'].connect();
      const address = result?.accounts?.[0]?.address || null;
      if (!address) throw new Error('No accounts returned from wallet');
      sessionStorage.setItem('suiAddress', address);
      return address;
    }
    const legacy = getLegacyWallet();
    if (legacy?.connect) {
      const result = await legacy.connect();
      const address = result?.accounts?.[0]?.address || result?.[0]?.address || result?.address || null;
      if (!address) throw new Error('No accounts returned from wallet');
      sessionStorage.setItem('suiAddress', address);
      return address;
    }
    throw new Error('SUI wallet not available');
  };

  const signMessage = async (message) => {
    const encoded = typeof message === 'string' ? new TextEncoder().encode(message) : message;
    const standard = getStandardWallet();
    if (standard?.features?.['sui:signPersonalMessage']?.signPersonalMessage) {
      const result = await standard.features['sui:signPersonalMessage'].signPersonalMessage({ message: encoded });
      return result?.signature || result?.signatureBytes || result?.bytes || result;
    }
    const legacy = getLegacyWallet();
    if (legacy?.signPersonalMessage) {
      const result = await legacy.signPersonalMessage({ message: encoded });
      return result?.signature || result;
    }
    if (legacy?.signMessage) {
      const result = await legacy.signMessage({ message: encoded });
      return result?.signature || result;
    }
    throw new Error('Wallet does not support personal message signing');
  };

  window.dluxWallet = { connect, signMessage };
})();`;
}

function buildNavScript(): string {
  return `window.dluxNav={navigate:(p)=>window.location.href=p,update:()=>{if(window.dluxNavUpdateCallback)window.dluxNavUpdateCallback();},onUpdate:(cb)=>{window.dluxNavUpdateCallback=cb;}};`;
}

function buildSocialScript() {
  const safeConfig = escapeForInlineJson({
    DGRAPH_SERVICE_URL,
    SUI_SERVICE_URL,
    WALRUS_SERVICE_URL,
    ZK_SERVICE_URL
  });

  return `(() => {
  const cfg = ${safeConfig};
  const DGRAPH = cfg.DGRAPH_SERVICE_URL;
  const SUI = cfg.SUI_SERVICE_URL;
  const PM = cfg.DGRAPH_SERVICE_URL;
  const WALRUS = cfg.WALRUS_SERVICE_URL;

  const parseContext = () => {
    const host = window.location.hostname;
    const subdomain = host.split('.')[0];
    const match = window.location.pathname.match(/^\\/@([^/]+)\\/([^/]+)/);
    const author = match?.[1] || null;
    const permlink = match?.[2] || subdomain;
    const dappId = author && permlink ? (author + '_' + permlink) : subdomain;
    return { author, permlink, dappId };
  };

  const requireWallet = async () => {
    if (!window.dluxWallet?.connect) throw new Error('Wallet connection required');
    const address = await window.dluxWallet.connect();
    if (!address) throw new Error('Wallet connection required');
    return address;
  };

  const createPost = async ({ content, dappId, parentId, contentType }) => {
    const address = await requireWallet();
    const message = JSON.stringify({ action: 'createPost', author: address, content, dappId, parentId, ts: Date.now() });
    const signature = await window.dluxWallet.signMessage(message);
    const res = await fetch(DGRAPH + '/social/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ author: address, content, dappId, parentId, contentType, signature })
    });
    if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || 'Failed to create post');
    return res.json();
  };

  const listPosts = async ({ dappId, limit = 50, offset = 0 }) => {
    const params = new URLSearchParams({ dappId, limit: String(limit), offset: String(offset) });
    const res = await fetch(DGRAPH + '/social/posts?' + params.toString());
    if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || 'Failed to load posts');
    return res.json();
  };

  const createInteraction = async ({ type, targetId, targetType = 'post' }) => {
    const address = await requireWallet();
    const message = JSON.stringify({ action: 'createInteraction', user: address, type, targetId, ts: Date.now() });
    const signature = await window.dluxWallet.signMessage(message);
    const res = await fetch(DGRAPH + '/social/interactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user: address, type, targetId, targetType, signature })
    });
    if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || 'Failed to create interaction');
    return res.json();
  };

  const openProfile = (identifier) => { window.location.href = '/@' + identifier; };

  window.dluxSocial = { getContext: parseContext, listPosts, createPost, createInteraction, openProfile };

  // Minimal ad hook (cooldown handled in dApp if desired).
  window.dluxAds = {
    showAd: async ({ type = 'slip', cooldownMs = 10 * 60 * 1000 } = {}) => {
      // For MVP, just show a lightweight overlay and resolve on continue.
      return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.style.position = 'fixed';
        overlay.style.inset = '0';
        overlay.style.zIndex = '9999';
        overlay.style.display = 'flex';
        overlay.style.alignItems = 'center';
        overlay.style.justifyContent = 'center';
        overlay.style.background = 'rgba(0,0,0,0.85)';
        overlay.innerHTML = \`
          <div style="background:#111827;color:#e5e7eb;padding:1.5rem;border-radius:12px;max-width:520px;width:90%;text-align:center;">
            <h3 style="margin-top:0;">Sponsored Content</h3>
            <p style="color:#9ca3af;">Ad type: \${type}</p>
            <button id="dlux-ad-continue" style="background:#6366f1;color:white;border:none;padding:0.75rem 1.5rem;border-radius:6px;cursor:pointer;">Continue</button>
          </div>\`;
        document.body.appendChild(overlay);
        overlay.querySelector('#dlux-ad-continue').onclick = () => {
          overlay.remove();
          resolve({ shown: true });
        };
      });
    },
    getCooldown: () => ({ last: 0, remainingMs: 0 })
  };

  // Premium helper (thin wrapper around walrus-service).
  window.dluxPremium = {
    async getContent(dappId, userAddress) {
      const params = userAddress ? ('?user=' + encodeURIComponent(userAddress)) : '';
      const res = await fetch(WALRUS + '/premium/content/' + encodeURIComponent(dappId) + params);
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || 'Failed to load premium content');
      return res.json();
    }
  };

})();`;
}

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'sandbox-service',
    timestamp: new Date().toISOString()
  });
});

// Metadata endpoint for bots/crawlers (Caddy rewrite target) – returns HTML with OG/Twitter meta tags
app.get('/metadata', async (req, res) => {
  try {
    const author = typeof req.query.author === 'string' ? req.query.author : '';
    const permlink = typeof req.query.permlink === 'string' ? req.query.permlink : '';
    const tag = typeof req.query.tag === 'string' ? req.query.tag : '';

    if (!author || !permlink) {
      return res.status(400).send('author and permlink are required');
    }

    // Best-effort enrich with dApp lookup (never hard-fail).
    let title = `dApp: ${permlink}`;
    let description = `Decentralized application by ${author}`;
    let canonicalUrl = `https://${permlink}.walrus.dlux.io/@${author}/${permlink}`;
    let thumbnail = '';
    try {
      const lookupRes = await axios.get(`${SUI_SERVICE_URL}/dapps/lookup`, {
        params: { author, permlink },
        timeout: HTTP_TIMEOUT_MS
      });
      const meta = lookupRes.data;
      if (typeof meta?.name === 'string' && meta.name.trim()) {
        title = meta.name.trim();
      }
      if (typeof meta?.description === 'string' && meta.description.trim()) {
        description = meta.description.trim();
      }
      if (meta?.manifest?.metadata?.thumbnail) {
        thumbnail = String(meta.manifest.metadata.thumbnail);
      }
      if (meta?.subdomain) {
        canonicalUrl = `https://${meta.subdomain}.walrus.dlux.io/@${author}/${permlink}`;
      } else if (meta?.owner) {
        const sub = addressSubdomain(meta.owner);
        if (sub) canonicalUrl = `https://${sub}.walrus.dlux.io/@${author}/${permlink}`;
      }
    } catch {
      // ignore
    }

    const safeTitle = escapeAttr(title);
    const safeDesc = escapeAttr(description.slice(0, 200));
    const safeUrl = escapeAttr(canonicalUrl);
    const safeThumbnail = thumbnail ? escapeAttr(thumbnail) : '';

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${safeTitle}</title>
  <meta name="description" content="${safeDesc}">
  <meta property="og:title" content="${safeTitle}">
  <meta property="og:description" content="${safeDesc}">
  <meta property="og:url" content="${safeUrl}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="DLUX-SUI">${safeThumbnail ? `\n  <meta property="og:image" content="${safeThumbnail}">` : ''}
  <meta name="twitter:card" content="${safeThumbnail ? 'summary_large_image' : 'summary'}">
  <meta name="twitter:title" content="${safeTitle}">
  <meta name="twitter:description" content="${safeDesc}">${safeThumbnail ? `\n  <meta name="twitter:image" content="${safeThumbnail}">` : ''}
  <link rel="canonical" href="${safeUrl}">
</head>
<body>
  <h1>${safeTitle}</h1>
  <p>${safeDesc}</p>
  <p><a href="${safeUrl}">Open dApp</a></p>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (error) {
    logger.error('Failed to generate metadata', error);
    res.status(500).send('Error generating metadata');
  }
});

// Dynamic manifest for PWA install – dApp-aware via query params from injected <link>
app.get('/manifest.json', async (req, res) => {
  const subdomain = firstHostLabel(req.hostname);
  const author = typeof req.query.author === 'string' ? req.query.author : '';
  const permlink = typeof req.query.permlink === 'string' ? req.query.permlink : '';

  let name = `dApp: ${subdomain}`;
  let shortName = subdomain.substring(0, 12);
  let description = 'DLUX-SUI dApp';
  let startUrl = '/';
  let icons: Array<{ src: string; sizes: string; type: string }> = [
    { src: '/icon-192.png', sizes: '192x192', type: 'image/png' }
  ];

  // Enrich from dApp metadata when author + permlink are provided
  if (author && permlink) {
    startUrl = `/@${author}/${permlink}/`;
    try {
      const lookupRes = await axios.get(`${SUI_SERVICE_URL}/dapps/lookup`, {
        params: { author, permlink },
        timeout: HTTP_TIMEOUT_MS
      });
      const dapp = lookupRes.data;
      if (dapp?.name) name = dapp.name;
      if (dapp?.name) shortName = dapp.name.substring(0, 12);
      if (dapp?.description) description = dapp.description.slice(0, 200);
      // Use dApp thumbnail as icon if available
      const thumb = dapp?.manifest?.metadata?.thumbnail;
      if (thumb) {
        icons = [
          { src: thumb, sizes: '512x512', type: 'image/png' },
          { src: thumb, sizes: '192x192', type: 'image/png' }
        ];
      }
    } catch {
      // fall through to defaults
    }
  }

  const manifest = {
    name,
    short_name: shortName,
    description,
    start_url: startUrl,
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#667eea',
    orientation: 'any',
    scope: '/',
    icons
  };

  res.setHeader('Content-Type', 'application/manifest+json');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.json(manifest);
});

// Service worker
app.get('/sw.js', (req, res) => {
  const subdomain = firstHostLabel(req.hostname);
  res.setHeader('Content-Type', 'application/javascript');
  res.send(buildServiceWorker(subdomain));
});

// Injected scripts
app.get('/wallet-script.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.send(buildWalletScript());
});

app.get('/nav-script.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.send(buildNavScript());
});

app.get('/social-script.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.send(buildSocialScript());
});

// Proxy Walrus blobs for same-origin dApp assets (e.g. /walrus/:blobId)
app.get('/walrus/:blobId', async (req, res) => {
  try {
    const { blobId } = req.params;
    // Try to get blob info first to get filename/contentType hint
    let inferredMime: string | null = null;
    let filename: string | null = null;
    try {
      const infoRes = await axios.get(`${WALRUS_SERVICE_URL}/blobs/${encodeURIComponent(blobId)}/info`, {
        timeout: HTTP_TIMEOUT_MS,
        validateStatus: (s) => s === 200
      });
      filename = infoRes.data?.filename || infoRes.data?.name || null;
      if (filename) {
        inferredMime = mimeTypeFromPath(filename);
      }
      // Also check contentType from info if available
      if (!inferredMime && infoRes.data?.contentType) {
        const infoCt = String(infoRes.data.contentType).split(';')[0].trim().toLowerCase();
        if (infoCt && infoCt !== 'text/plain' && infoCt !== 'application/octet-stream') {
          inferredMime = infoCt;
        }
      }
    } catch {
      // Ignore info fetch failures, proceed with blob fetch
    }
    
    const response = await axios({
      method: 'GET',
      url: `${WALRUS_SERVICE_URL}/blobs/${encodeURIComponent(blobId)}`,
      responseType: 'arraybuffer',
      timeout: HTTP_TIMEOUT_MS,
      validateStatus: () => true
    });
    if (response.status !== 200) {
      const body = response.data;
      if (body && typeof body === 'object' && !Buffer.isBuffer(body) && !(body instanceof ArrayBuffer)) {
        return res.status(response.status).json(body);
      }
      return res.status(response.status).send(body ?? 'Blob not found');
    }
    let contentType = (response.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
    // Override incorrect MIME types (text/plain) with inferred type from filename or blob info
    if ((!contentType || contentType === 'text/plain' || contentType === 'application/octet-stream') && inferredMime) {
      contentType = inferredMime;
    }
    res.setHeader('Content-Type', contentType || 'application/octet-stream');
    const contentLength = response.headers['content-length'];
    if (contentLength) res.setHeader('Content-Length', contentLength);
    res.setHeader('Cache-Control', 'public, max-age=31536000');
    res.send(Buffer.from(response.data));
  } catch (error) {
    logger.error('Error proxying Walrus blob', { blobId: req.params.blobId, error });
    res.status(502).json({ error: 'Failed to load blob' });
  }
});

// Serve dApp content (address-matched subdomain + Walrus fetch, or local dapps / shell)
app.use(async (req, res) => {
  try {
    const subdomain = firstHostLabel(req.hostname);
    const { author, permlink, dappId } = parseDappContext(req);
    const contentId = dappId;

    // Address-matched subdomain: subdomain = h + hex of owner (DNS-safe), or SuiNS name (e.g. disregardfiat).
    const pathMatch = req.path.match(/^\/@([^/]+)\/([^/]+)(\/.*)?$/);
    const pathAuthor = pathMatch?.[1];
    const pathPermlink = pathMatch?.[2];
    const pathSuffix = pathMatch?.[3]; // e.g. "/js/app.js" for asset requests
    const isExactDappPath =
      req.path === `/@${pathAuthor}/${pathPermlink}` ||
      req.path === `/@${pathAuthor}/${pathPermlink}/`;
    const isHexSubdomain = isAddressSubdomain(subdomain);
    const isSuinsLikeSubdomain = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}$/.test((subdomain || '').trim());
    
    // Redirect subdomain-only requests (no permlink) to dlux.io/@subdomain
    if ((isHexSubdomain || isSuinsLikeSubdomain) && !pathAuthor && !pathPermlink && req.path === '/') {
      const redirectUrl = `https://dlux.io/@${subdomain}`;
      return res.redirect(302, redirectUrl);
    }
    
    const isDappPath = (isHexSubdomain || isSuinsLikeSubdomain) && pathAuthor && pathPermlink && (isExactDappPath || pathSuffix);
    if (isDappPath) {
      try {
        const lookupRes = await axios.get(`${SUI_SERVICE_URL}/dapps/lookup`, {
          params: { author: pathAuthor, permlink: pathPermlink },
          timeout: HTTP_TIMEOUT_MS
        });
        const dapp = lookupRes.data;
        const owner = (dapp?.owner || '').toLowerCase();
        const expectedHexSub = addressSubdomain(owner);
        const subdomainNorm = (subdomain || '').toLowerCase().trim();
        // Allow hex subdomain (h+hex) or SuiNS subdomain that resolves to owner
        const hexMatch = expectedHexSub === subdomainNorm;
        let suinsMatch = false;
        if (!hexMatch && isSuinsLikeSubdomain) {
          const resolvedAddr = await resolveSuinsSubdomainToAddress(subdomainNorm);
          suinsMatch = !!resolvedAddr && resolvedAddr === owner;
        }
        if (!hexMatch && !suinsMatch) {
          res.status(403).send('Subdomain does not match dApp owner. Use h{hex} or your SuiNS subdomain.');
          return;
        }

        const blobIds: string[] = Array.isArray(dapp?.blobIds) ? dapp.blobIds : [];
        const manifest = dapp?.manifest;

        // Asset request via pathMap: /@owner/permlink/js/app.js -> path "js/app.js", /@owner/permlink/dir/ -> try "dir/index.html" etc.
        // Also: /@owner/permlink/remix -> lookup path "remix.html" (remix UI for swapping assets)
        const assetPathRaw = pathSuffix && pathSuffix.length > 1 ? pathSuffix.replace(/^\//, '') : '';
        const assetPath = assetPathRaw === 'remix' ? 'remix.html' : assetPathRaw;
        // pathMap may arrive as a JSON string (DGraph resolver stringifies it) or as an object (in-memory / Walrus-resolved)
        let pathMap: Record<string, string> | undefined;
        const rawPathMap = manifest?.pathMap;
        if (rawPathMap && typeof rawPathMap === 'object') {
          pathMap = rawPathMap as Record<string, string>;
        } else if (typeof rawPathMap === 'string') {
          try {
            const parsed = JSON.parse(rawPathMap);
            if (parsed && typeof parsed === 'object') pathMap = parsed;
          } catch {
            // not valid JSON – ignore
          }
        }
        if (assetPath) {
          // Resolve blobId: exact key first, then permlink-prefixed (pathMap often has "folder/file" when uploaded as folder "folder")
          const pathCandidatesForAsset: string[] = [
            assetPath,
            pathPermlink ? `${pathPermlink}/${assetPath}` : ''
          ].filter(Boolean);
          let assetBlobId: string | undefined =
            pathMap ? pathCandidatesForAsset.map((p) => pathMap[p]).find((id): id is string => typeof id === 'string') : undefined;
          
          // Also try matching any pathMap key that ends with the asset filename (handles folder prefixes)
          if (!assetBlobId && pathMap) {
            const assetBasename = assetPath.split('/').pop() || assetPath;
            for (const [key, blobId] of Object.entries(pathMap)) {
              if (key.endsWith('/' + assetPath) || key.endsWith('/' + assetBasename) || key === assetBasename) {
                assetBlobId = blobId;
                break;
              }
            }
          }
          
          if (!assetBlobId && pathMap) {
            const dirIndexCandidates = [
              assetPath.replace(/\/?$/, '/index.html'),
              assetPath.replace(/\/$/, '') + '/index.html'
            ];
            assetBlobId = dirIndexCandidates.map((p) => pathMap[p]).find((id): id is string => typeof id === 'string');
          }
          // Fallback for old dApps without pathMap: try to match asset path to blob filenames
          if (!assetBlobId && blobIds.length > 0) {
            try {
              const assetBasename = assetPath.split('/').pop() || assetPath;
              const assetExt = path.extname(assetPath).toLowerCase();
              const assetBasenameLower = assetBasename.toLowerCase();
              
              // Fetch blob info for all blobs to find filename matches (with longer timeout for fallback)
              const infoPromises = blobIds.slice(0, 50).map(async (bid) => {
                try {
                  const infoRes = await axios.get(`${WALRUS_SERVICE_URL}/blobs/${encodeURIComponent(bid)}/info`, {
                    timeout: HTTP_TIMEOUT_MS * 2, // Longer timeout for fallback
                    validateStatus: (s) => s === 200
                  });
                  const filename = String(infoRes.data?.filename || infoRes.data?.name || '').trim();
                  const filenameLower = filename.toLowerCase();
                  const blobExt = path.extname(filename).toLowerCase();
                  
                  // Multiple matching strategies (in order of preference):
                  // 1. Exact path match
                  // 2. Exact basename match
                  // 3. Extension + basename substring match
                  // 4. Extension match only (if only one blob with that extension)
                  if (filename === assetPath || filename === assetBasename) {
                    return { blobId: bid, score: 10, filename };
                  }
                  if (blobExt === assetExt && filenameLower.includes(assetBasenameLower)) {
                    return { blobId: bid, score: 5, filename };
                  }
                  if (blobExt === assetExt && assetExt) {
                    return { blobId: bid, score: 1, filename };
                  }
                } catch {
                  // ignore individual blob info failures
                }
                return null;
              });
              const matches = (await Promise.all(infoPromises)).filter((m): m is { blobId: string; score: number; filename: string } => m !== null);
              
              // Sort by score (highest first) and pick the best match
              if (matches.length > 0) {
                matches.sort((a, b) => b.score - a.score);
                assetBlobId = matches[0].blobId;
                logger.debug('Fallback asset resolution', { assetPath, matchedBlobId: assetBlobId, matchedFilename: matches[0].filename, totalMatches: matches.length });
              }
            } catch (err) {
              logger.warn('Fallback asset resolution failed', { assetPath, error: err });
              // ignore fallback failures, proceed to 404
            }
          }
          if (assetBlobId) {
            const assetRes = await axios({
              method: 'GET',
              url: `${WALRUS_SERVICE_URL}/blobs/${encodeURIComponent(assetBlobId)}`,
              responseType: 'arraybuffer',
              timeout: HTTP_TIMEOUT_MS,
              validateStatus: () => true
            });
            if (assetRes.status === 200) {
              let ct = (assetRes.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
              // Override incorrect MIME types (text/plain, text/html) with correct type from file extension
              const inferredMime = mimeTypeFromPath(assetPath);
              if (!ct || ct === 'text/html' || ct === 'text/plain' || (inferredMime && ct !== inferredMime)) {
                ct = inferredMime || ct || 'application/octet-stream';
              }
              res.setHeader('Content-Type', ct);
              res.setHeader('Cache-Control', 'public, max-age=31536000');
              return res.send(Buffer.from(assetRes.data));
            }
            res.setHeader('Content-Type', 'text/plain');
            return res.status(assetRes.status === 404 ? 404 : 502).send('Asset not found.');
          }
          res.setHeader('Content-Type', 'text/plain');
          return res.status(404).send('Asset not found.');
        }
        // Redirect /@owner/permlink to /@owner/permlink/ so relative URLs (e.g. index.css) resolve under permlink, not under /@owner/
        if (isExactDappPath && !req.path.endsWith('/')) {
          return res.redirect(302, req.path + '/');
        }
        let entryBlobId: string | null = null;
        if (manifest?.entryPoint && /^[a-zA-Z0-9_-]+$/.test(String(manifest.entryPoint).trim())) {
          entryBlobId = String(manifest.entryPoint).trim();
        }
        if (!entryBlobId && blobIds.length) entryBlobId = blobIds[0];
        if (!entryBlobId) {
          res.status(404).send('dApp has no entry blob.');
          return;
        }
        const blobRes = await axios({
          method: 'GET',
          url: `${WALRUS_SERVICE_URL}/blobs/${encodeURIComponent(entryBlobId)}`,
          responseType: 'arraybuffer',
          timeout: HTTP_TIMEOUT_MS,
          validateStatus: () => true
        });
        if (blobRes.status !== 200) {
          res.status(blobRes.status === 404 ? 404 : 502).send(blobRes.status === 404 ? 'Entry blob not found.' : 'Failed to load dApp content.');
          return;
        }
        let blobBuffer = Buffer.from(blobRes.data);
        let contentType = (blobRes.headers['content-type'] || '').toLowerCase();

        // Fallback: if entry blob is not HTML, try to find an HTML blob in blobIds (fixes dApps with wrong entryPoint or blob order)
        if (!contentType.includes('text/html') && blobIds.length > 1) {
          let htmlBlobId: string | null = null;
          try {
            const infoPromises = blobIds.map(async (bid) => {
              const infoRes = await axios.get(`${WALRUS_SERVICE_URL}/blobs/${encodeURIComponent(bid)}/info`, {
                timeout: HTTP_TIMEOUT_MS,
                validateStatus: () => true
              });
              const ct = String(infoRes.data?.contentType || '').toLowerCase();
              return { blobId: bid, contentType: ct };
            });
            const infos = await Promise.all(infoPromises);
            const htmlEntry = infos.find((i) => i.contentType.includes('text/html'));
            if (htmlEntry) htmlBlobId = htmlEntry.blobId;
          } catch {
            // ignore
          }
          if (htmlBlobId) {
            const htmlBlobRes = await axios({
              method: 'GET',
              url: `${WALRUS_SERVICE_URL}/blobs/${encodeURIComponent(htmlBlobId)}`,
              responseType: 'arraybuffer',
              timeout: HTTP_TIMEOUT_MS,
              validateStatus: () => true
            });
            if (htmlBlobRes.status === 200) {
              blobBuffer = Buffer.from(htmlBlobRes.data);
              contentType = (htmlBlobRes.headers['content-type'] || '').toLowerCase();
            }
          }
        }

        if (!contentType.includes('text/html')) {
          res.setHeader('Content-Type', blobRes.headers['content-type'] || 'application/octet-stream');
          res.setHeader('Cache-Control', 'public, max-age=31536000');
          res.send(blobBuffer);
          return;
        }
        let html = blobBuffer.toString('utf8');
        // Rewrite absolute Walrus blob URLs to same-origin /walrus/:id for subresources (blob IDs may be hex or base64url)
        const walrusBase = WALRUS_SERVICE_URL.replace(/\/$/, '');
        const blobUrlPattern = new RegExp(`${walrusBase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/blobs/([a-zA-Z0-9_-]+)`, 'gi');
        html = html.replace(blobUrlPattern, '/walrus/$1');

        // --- Build injection fragments, skipping tags the user already defined ---
        const dappTitle = escapeAttr(dapp?.name || `dApp: ${pathPermlink}`);
        const dappDesc = escapeAttr((dapp?.description || `Decentralized application by ${pathAuthor}`).slice(0, 200));
        const dappUrl = escapeAttr(`https://${req.hostname}/@${pathAuthor}/${pathPermlink}/`);
        const dappThumbnail = escapeAttr(dapp?.manifest?.metadata?.thumbnail || '');
        const manifestQs = encodeURIComponent(pathAuthor) + '&permlink=' + encodeURIComponent(pathPermlink || '');

        const headParts: string[] = [];

        // PWA manifest link
        if (!headHasTag(html, /rel\s*=\s*["']manifest["']/i)) {
          headParts.push(`<link rel="manifest" href="/manifest.json?author=${manifestQs}">`);
        }
        // Theme color
        if (!headHasTag(html, /name\s*=\s*["']theme-color["']/i)) {
          headParts.push('<meta name="theme-color" content="#667eea">');
        }
        // Open Graph tags
        if (!headHasTag(html, /property\s*=\s*["']og:title["']/i)) {
          headParts.push(`<meta property="og:title" content="${dappTitle}">`);
        }
        if (!headHasTag(html, /property\s*=\s*["']og:description["']/i)) {
          headParts.push(`<meta property="og:description" content="${dappDesc}">`);
        }
        if (!headHasTag(html, /property\s*=\s*["']og:url["']/i)) {
          headParts.push(`<meta property="og:url" content="${dappUrl}">`);
        }
        if (!headHasTag(html, /property\s*=\s*["']og:type["']/i)) {
          headParts.push('<meta property="og:type" content="website">');
        }
        if (dappThumbnail && !headHasTag(html, /property\s*=\s*["']og:image["']/i)) {
          headParts.push(`<meta property="og:image" content="${dappThumbnail}">`);
        }
        // Twitter Card tags
        if (!headHasTag(html, /name\s*=\s*["']twitter:card["']/i)) {
          headParts.push(`<meta name="twitter:card" content="${dappThumbnail ? 'summary_large_image' : 'summary'}">`);
        }
        if (!headHasTag(html, /name\s*=\s*["']twitter:title["']/i)) {
          headParts.push(`<meta name="twitter:title" content="${dappTitle}">`);
        }
        if (!headHasTag(html, /name\s*=\s*["']twitter:description["']/i)) {
          headParts.push(`<meta name="twitter:description" content="${dappDesc}">`);
        }

        // Gateway scripts (always injected – namespaced so they don't conflict)
        headParts.push(`<script>window.dluxDappMeta=${escapeForInlineJson({ author: pathAuthor, permlink: pathPermlink, dappId: `${pathAuthor}_${pathPermlink}` })};</script>`);
        headParts.push('<script src="/wallet-script.js"></script>');
        headParts.push('<script src="/nav-script.js"></script>');
        headParts.push('<script src="/social-script.js"></script>');

        const injectBeforeHeadClose = '\n    ' + headParts.join('\n    ');
        if (html.includes('</head>')) {
          html = html.replace('</head>', `${injectBeforeHeadClose}\n  </head>`);
        } else {
          html = injectBeforeHeadClose + '\n' + html;
        }

        // Service worker registration (inject before </body> if not already present)
        if (!/serviceWorker/i.test(html)) {
          const swScript = `\n    <script>if('serviceWorker' in navigator){navigator.serviceWorker.register('/sw.js').catch(function(){});}</script>`;
          if (html.includes('</body>')) {
            html = html.replace('</body>', `${swScript}\n  </body>`);
          } else {
            html += swScript;
          }
        }
        // Prediction-market safety banner (negative accuracy, less tested, overall status)
        const safetyBannerHtml = await fetchSafetyBannerHtml(`${pathAuthor}_${pathPermlink}`);
        if (safetyBannerHtml) {
          if (html.includes('<body>')) {
            html = html.replace('<body>', `<body>\n  ${safetyBannerHtml}`);
          } else if (html.includes('<body ')) {
            html = html.replace(/(<body[^>]*>)/i, `$1\n  ${safetyBannerHtml}`);
          } else {
            html = safetyBannerHtml + '\n' + html;
          }
        }
        // Best-effort ad overlay (same as shell)
        let activeAd: any = null;
        try {
          const adsRes = await axios.get(`${DGRAPH_SERVICE_URL}/ads/active`, {
            params: { contentId: dappId, placement: 'gate' },
            timeout: HTTP_TIMEOUT_MS
          });
          activeAd = adsRes.data?.ad || null;
        } catch {
          // ignore
        }
        const adOverlay = activeAd
          ? `<div id="dlux-ad-overlay" style="display:flex;position:fixed;inset:0;z-index:10001;align-items:center;justify-content:center;background:rgba(0,0,0,0.85);">
          <div style="background:#fff;padding:24px;border-radius:12px;max-width:560px;width:90%;text-align:center;">
            <h2 style="margin-top:0;">Sponsored Content</h2>
            <h3>${String(activeAd.title || 'Ad')}</h3>
            <p>${String(activeAd.description || '')}</p>
            <button id="dlux-ad-continue" style="background:#667eea;color:white;border:none;padding:0.75rem 1.5rem;border-radius:8px;cursor:pointer;">Continue</button>
          </div>
        </div>
        <script>(function(){var o=document.getElementById('dlux-ad-overlay');var b=document.getElementById('dlux-ad-continue');if(b&&o)b.onclick=function(){o.remove();};})();</script>`
          : '';
        if (adOverlay && html.includes('</body>')) {
          html = html.replace('</body>', `${adOverlay}\n  </body>`);
        } else if (adOverlay) {
          html = html + adOverlay;
        }
        res.setHeader('Content-Type', 'text/html');
        res.send(html);
        return;
      } catch (err: any) {
        if (err?.response?.status === 404) {
          res.status(404).send('dApp not found.');
          return;
        }
        logger.error('Error serving address-matched dApp from Walrus', { subdomain, pathAuthor, pathPermlink, error: err });
        res.status(500).send('Error loading dApp.');
        return;
      }
    }

    // Try serve a local dApp if present (dev convenience).
    const localDappRoot = path.join(process.cwd(), 'dapps');
    const indexPath = path.join(localDappRoot, subdomain, 'index.html');
    const remixPath = path.join(localDappRoot, subdomain, 'remix.html');

    if (fs.existsSync(indexPath)) {
      const isRemix = req.path === '/remix' || req.path === '/remix.html';
      const targetPath = isRemix && fs.existsSync(remixPath) ? remixPath : indexPath;
      res.setHeader('Content-Type', 'text/html');
      res.send(fs.readFileSync(targetPath, 'utf8'));
      return;
    }

    // Best-effort ad selection from dgraph inventory (safe to ignore failures).
    let activeAd: any = null;
    try {
      const adsRes = await axios.get(`${DGRAPH_SERVICE_URL}/ads/active`, {
        params: { contentId, placement: 'gate' },
        timeout: HTTP_TIMEOUT_MS
      });
      activeAd = adsRes.data?.ad || null;
    } catch {
      // ignore
    }

    // Prediction-market safety banner (negative accuracy, less tested, overall status)
    const safetyBanner = await fetchSafetyBannerHtml(dappId);

    const adOverlay = activeAd
      ? `<div id="dlux-ad-overlay" style="display:flex;position:fixed;inset:0;z-index:10001;align-items:center;justify-content:center;background:rgba(0,0,0,0.85);">
          <div style="background:#fff;padding:24px;border-radius:12px;max-width:560px;width:90%;text-align:center;">
            <h2 style="margin-top:0;">Sponsored Content</h2>
            <h3>${String(activeAd.title || 'Ad')}</h3>
            <p>${String(activeAd.description || '')}</p>
            <button id="dlux-ad-continue" style="background:#667eea;color:white;border:none;padding:0.75rem 1.5rem;border-radius:8px;cursor:pointer;">Continue</button>
          </div>
        </div>
        <script>
          (function(){
            var overlay=document.getElementById('dlux-ad-overlay');
            var btn=document.getElementById('dlux-ad-continue');
            if(!btn||!overlay)return;
            btn.onclick=function(){ overlay.remove(); };
          })();
        </script>`
      : '';

    const title = permlink ? `dApp: ${permlink}` : `dApp: ${subdomain}`;
    const metaJson = escapeForInlineJson({ author, permlink, dappId });

    const html = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${title}</title>
    <link rel="manifest" href="/manifest.json" />
    <meta name="theme-color" content="#667eea" />
    <script>window.dluxDappMeta=${metaJson};</script>
    <script src="/wallet-script.js"></script>
    <script src="/nav-script.js"></script>
    <script src="/social-script.js"></script>
  </head>
  <body style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; background:#0b1220; color:#e5e7eb; margin:0; padding:16px;">
    <div style="max-width:920px;margin:0 auto;">
      ${safetyBanner}
      <h1 style="margin:8px 0;">${title}</h1>
      <p style="color:#94a3b8;margin-top:0;">Wildcard sandbox shell (MVP). Host: <code>${subdomain}</code></p>
      <p style="color:#94a3b8;">In production this routes to Walrus-hosted dApp content.</p>
      <hr style="border:none;border-top:1px solid rgba(148,163,184,0.2);margin:16px 0;" />
      <p style="color:#94a3b8;">Services:</p>
      <ul style="color:#94a3b8;">
        <li>DGraph: <code>${DGRAPH_SERVICE_URL}</code></li>
        <li>SUI: <code>${SUI_SERVICE_URL}</code></li>
        <li>Markets: <code>${DGRAPH_SERVICE_URL}</code></li>
        <li>Walrus: <code>${WALRUS_SERVICE_URL}</code></li>
        <li>ZK: <code>${ZK_SERVICE_URL}</code></li>
      </ul>
    </div>
    ${adOverlay}
    <script>
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js').catch(function(){});
      }
    </script>
  </body>
</html>`;

    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (error) {
    logger.error('Error serving dApp shell', error);
    res.status(500).send('Error loading dApp');
  }
});

// Error handling
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Export app for testing
export { app };

// Start server (only if not in test environment)
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    logger.info(`Sandbox Service listening on port ${PORT}`);
  });
}

