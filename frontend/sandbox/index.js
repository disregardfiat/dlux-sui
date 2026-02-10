const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = 3007;

const SUI_SERVICE = process.env.SUI_SERVICE_URL || 'http://localhost:3001';
const GRAPHQL_SERVICE = process.env.GRAPHQL_SERVICE_URL || 'http://localhost:3003';
const WALRUS_SERVICE = process.env.WALRUS_SERVICE_URL || 'http://localhost:3002';
const ZK_SERVICE = process.env.ZK_SERVICE_URL || 'http://localhost:3010';
const DGRAPH_SERVICE = process.env.DGRAPH_SERVICE_URL || 'http://localhost:3003';
const SUI_RPC_URL = process.env.SUI_RPC_URL || 'https://fullnode.testnet.sui.io:443';

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'sandbox-service', timestamp: new Date().toISOString() });
});

app.get('/metadata', async (req, res) => {
  try {
    const { author, permlink, tag } = req.query;
    if (!author || !permlink) {
      return res.status(400).json({ error: 'Author and permlink required' });
    }
    res.json({
      title: `dApp: ${permlink}`,
      description: `Decentralized application by ${author}`,
      url: `https://${permlink}.walrus.dlux.io/@${author}/${permlink}`,
      type: 'website',
      site_name: 'DLUX-SUI',
      author: author,
      tag: tag || ''
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch metadata' });
  }
});

app.get('/manifest.json', (req, res) => {
  const subdomain = req.hostname.split('.')[0];
  const manifest = {
    name: `dApp: ${subdomain}`,
    short_name: subdomain.substring(0, 12),
    description: 'DLUX-SUI dApp',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#667eea',
    orientation: 'any',
    scope: '/',
    icons: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' }]
  };
  res.setHeader('Content-Type', 'application/manifest+json');
  res.json(manifest);
});

app.get('/sw.js', (req, res) => {
  const subdomain = req.hostname.split('.')[0];
  const sw = `const C='dlux-${subdomain}-v1';self.addEventListener('install',e=>e.waitUntil(caches.open(C).then(c=>c.addAll(['/']))));self.addEventListener('fetch',e=>e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request))));`;
  res.setHeader('Content-Type', 'application/javascript');
  res.send(sw);
});

app.get('/wallet-script.js', (req, res) => {
  const script = `(() => {
  const ACTIVE_WALLET_KEY = 'dlux_active_wallet';
  const getProviders = () => {
    const providers = [];
    const globalAny = window;
    if (globalAny.suiWallets && globalAny.suiWallets.get) {
      const standard = globalAny.suiWallets.get() || [];
      standard.forEach((wallet) => {
        providers.push({
          key: wallet.id || wallet.name,
          name: wallet.name,
          provider: wallet
        });
      });
    }
    const fallback = [
      { key: 'slush', name: 'Slush', provider: globalAny.slush || globalAny.slushWallet },
      { key: 'sui-wallet', name: 'Sui Wallet', provider: globalAny.suiWallet || globalAny.SuiWallet || globalAny.sui }
    ];
    fallback.forEach((wallet) => {
      if (wallet.provider) {
        providers.push(wallet);
      }
    });
    const deduped = new Map();
    providers.forEach((entry) => deduped.set(entry.key, entry));
    return Array.from(deduped.values());
  };
  const restoreActiveWallet = () => {
    const storedKey = localStorage.getItem(ACTIVE_WALLET_KEY);
    if (!storedKey) return null;
    const available = getProviders();
    return available.find((wallet) => wallet.key === storedKey) || null;
  };
  const setActiveWallet = (wallet) => {
    if (wallet) {
      localStorage.setItem(ACTIVE_WALLET_KEY, wallet.key);
    } else {
      localStorage.removeItem(ACTIVE_WALLET_KEY);
    }
  };
  const ensureWallet = (wallet) => {
    const resolved = wallet || restoreActiveWallet() || getProviders()[0];
    if (!resolved || !resolved.provider) {
      throw new Error('SUI wallet not available');
    }
    return resolved;
  };
  const normalizeSignature = (result) => {
    if (typeof result === 'string') return result;
    if (result?.signature) return result.signature;
    if (result?.signatureBytes) return result.signatureBytes;
    if (result?.bytes) return result.bytes;
    if (result?.signature?.signature) return result.signature.signature;
    throw new Error('Unable to parse wallet signature response');
  };
  const toUint8Array = (input) => {
    if (input instanceof Uint8Array) return input;
    if (typeof input !== 'string') return new Uint8Array();
    if (input.startsWith('0x')) {
      const hex = input.slice(2);
      const bytes = new Uint8Array(hex.length / 2);
      for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
      }
      return bytes;
    }
    try {
      const binary = atob(input);
      return Uint8Array.from(binary, (char) => char.charCodeAt(0));
    } catch {
      return new TextEncoder().encode(input);
    }
  };
  const connect = async (wallet) => {
    const resolved = ensureWallet(wallet);
    const provider = resolved.provider;
    let accounts = [];
    if (provider?.features?.['standard:connect']?.connect) {
      const result = await provider.features['standard:connect'].connect();
      accounts = result?.accounts || [];
    } else if (provider?.connect) {
      const result = await provider.connect();
      accounts = result?.accounts || result || [];
    } else if (provider?.request) {
      const result = await provider.request({ method: 'connect' });
      accounts = result?.accounts || [];
    }
    if (!accounts.length) {
      throw new Error('No accounts returned from wallet.');
    }
    setActiveWallet(resolved);
    const address = accounts[0]?.address || null;
    if (address) {
      sessionStorage.setItem('suiAddress', address);
    }
    return address;
  };
  const signMessage = async (message, wallet) => {
    const resolved = ensureWallet(wallet);
    const provider = resolved.provider;
    const encoded = typeof message === 'string' ? new TextEncoder().encode(message) : message;
    if (provider?.features?.['sui:signPersonalMessage']?.signPersonalMessage) {
      const result = await provider.features['sui:signPersonalMessage'].signPersonalMessage({ message: encoded });
      return normalizeSignature(result);
    }
    if (provider?.signPersonalMessage) {
      const result = await provider.signPersonalMessage({ message: encoded });
      return normalizeSignature(result);
    }
    if (provider?.signMessage) {
      const result = await provider.signMessage({ message: encoded });
      return normalizeSignature(result);
    }
    if (provider?.request) {
      const result = await provider.request({ method: 'sui_signPersonalMessage', params: { message: Array.from(encoded) } });
      return normalizeSignature(result);
    }
    throw new Error('Wallet does not support personal message signing');
  };
  const signTransactionBlock = async (transactionBlock, wallet) => {
    const resolved = ensureWallet(wallet);
    const provider = resolved.provider;
    const normalized = toUint8Array(transactionBlock);
    if (provider?.features?.['sui:signTransactionBlock']?.signTransactionBlock) {
      const result = await provider.features['sui:signTransactionBlock'].signTransactionBlock({ transactionBlock: normalized });
      return normalizeSignature(result);
    }
    if (provider?.signTransactionBlock) {
      const result = await provider.signTransactionBlock({ transactionBlock: normalized });
      return normalizeSignature(result);
    }
    if (provider?.request) {
      const result = await provider.request({ method: 'sui_signTransactionBlock', params: { transactionBlock: Array.from(normalized) } });
      return normalizeSignature(result);
    }
    throw new Error('Wallet does not support transaction signing');
  };
  const signAndExecuteTransactionBlock = async (transactionBlock, options, requestType, wallet) => {
    const resolved = ensureWallet(wallet);
    const provider = resolved.provider;
    const normalized = toUint8Array(transactionBlock);
    const payload = { transactionBlock: normalized, options, requestType };
    if (provider?.features?.['sui:signAndExecuteTransactionBlock']?.signAndExecuteTransactionBlock) {
      return provider.features['sui:signAndExecuteTransactionBlock'].signAndExecuteTransactionBlock(payload);
    }
    if (provider?.signAndExecuteTransactionBlock) {
      return provider.signAndExecuteTransactionBlock(payload);
    }
    if (provider?.request) {
      return provider.request({ method: 'sui_signAndExecuteTransactionBlock', params: { transactionBlock: Array.from(normalized), options, requestType } });
    }
    throw new Error('Wallet does not support sign and execute');
  };
  window.dluxWallet = {
    getWallets: getProviders,
    connect,
    signMessage,
    signTransactionBlock,
    signAndExecuteTransactionBlock
  };
})();`;
  res.setHeader('Content-Type', 'application/javascript');
  res.send(script);
});

app.get('/nav-script.js', (req, res) => {
  const script = `window.dluxNav={navigate:p=>window.location.href=p,update:()=>{if(window.dluxNavUpdateCallback)window.dluxNavUpdateCallback();}};`;
  res.setHeader('Content-Type', 'application/javascript');
  res.send(script);
});

app.get('/social-script.js', (req, res) => {
  const script = `(() => {
  const DGRAPH_SERVICE = '${DGRAPH_SERVICE}';
  const SUI_SERVICE = '${SUI_SERVICE}';
  const PM_SERVICE = '${DGRAPH_SERVICE}';
  const WALRUS_SERVICE = '${process.env.WALRUS_SERVICE_URL || 'http://localhost:3002'}';
  const SUI_RPC_URL = '${SUI_RPC_URL}';
  const getCookie = (name) => {
    const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
    return match ? decodeURIComponent(match[1]) : null;
  };
  const getAuthSession = () => {
    const raw = getCookie('dlux_auth_shared');
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  };
  const parseContext = () => {
    const host = window.location.hostname;
    const subdomain = host.split('.')[0];
    const match = window.location.pathname.match(/\\/(@[^/]+)\\/([^/]+)/);
    if (match) {
      const author = match[1].slice(1);
      const permlink = match[2];
      return { author, permlink, dappId: author + '_' + permlink };
    }
    return { author: null, permlink: subdomain, dappId: subdomain };
  };
  const signMessage = async (message) => {
    if (!window.dluxWallet || !window.dluxWallet.signMessage) {
      throw new Error('Wallet signing unavailable');
    }
    return window.dluxWallet.signMessage(message);
  };
  const requireWalletAddress = async () => {
    if (!window.dluxWallet || !window.dluxWallet.connect) {
      throw new Error('Wallet connection required');
    }
    const address = await window.dluxWallet.connect();
    if (!address) {
      throw new Error('Wallet connection required');
    }
    return address;
  };
  const createPost = async ({ content, dappId, parentId, contentType }) => {
    const address = await requireWalletAddress();
    const message = JSON.stringify({
      action: 'createPost',
      author: address,
      content,
      dappId,
      timestamp: Date.now()
    });
    const signature = await signMessage(message);
    const payload = {
      author: address,
      content,
      contentType,
      dappId,
      parentId,
      signature
    };
    const res = await fetch(DGRAPH_SERVICE + '/social/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.error || 'Failed to create post');
    }
    return res.json();
  };
  const listPosts = async ({ dappId, limit = 50, offset = 0 }) => {
    const params = new URLSearchParams({ dappId, limit: String(limit), offset: String(offset) });
    const res = await fetch(DGRAPH_SERVICE + '/social/posts?' + params.toString());
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.error || 'Failed to load posts');
    }
    return res.json();
  };
  const createInteraction = async ({ type, targetId, targetType = 'post' }) => {
    const address = await requireWalletAddress();
    const message = JSON.stringify({
      action: 'createInteraction',
      user: address,
      type,
      targetId,
      timestamp: Date.now()
    });
    const signature = await signMessage(message);
    const payload = { user: address, type, targetId, targetType, signature };
    const res = await fetch(DGRAPH_SERVICE + '/social/interactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.error || 'Failed to create interaction');
    }
    return res.json();
  };
  const getUserIdentity = () => {
    const session = getAuthSession();
    const address = session?.user?.suiAddress || session?.user?.address || null;
    return address || sessionStorage.getItem('suiAddress') || 'anon';
  };
  const isSubscriptionActive = async () => {
    const session = getAuthSession();
    const subscriber = session?.user?.suiAddress || session?.user?.address || sessionStorage.getItem('suiAddress');
    if (!subscriber) return false;
    try {
      const params = new URLSearchParams({ subscriber });
      const res = await fetch(\`\${DGRAPH_SERVICE}/subscription/status?\${params}\`);
      if (!res.ok) return false;
      const data = await res.json();
      return !!data?.active;
    } catch {
      return false;
    }
  };
  const getAdCooldownKey = (identity) => `dlux_ad_last_${identity}`;
  const getLastAdTime = (identity) => {
    const raw = localStorage.getItem(getAdCooldownKey(identity));
    return raw ? Number(raw) : 0;
  };
  const setLastAdTime = (identity, timestamp) => {
    localStorage.setItem(getAdCooldownKey(identity), String(timestamp));
  };
  const renderAdOverlay = ({ type, onContinue, onSkip }) => {
    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.right = '0';
    overlay.style.bottom = '0';
    overlay.style.background = 'rgba(0,0,0,0.85)';
    overlay.style.zIndex = '10003';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.innerHTML = \`
      <div style="background:#111827;color:#e5e7eb;padding:2rem;border-radius:12px;max-width:520px;width:90%;text-align:center;">
        <h3 style="margin-top:0;">Sponsored Content</h3>
        <p style="color:#9ca3af;">Ad type: \${type}</p>
        <p style="margin:1rem 0 1.5rem;">Watch this ad to continue.</p>
        <div>
          <button id="dlux-ad-continue" style="background:#6366f1;color:white;border:none;padding:0.75rem 1.5rem;border-radius:6px;cursor:pointer;margin-right:0.5rem;">Continue</button>
          <button id="dlux-ad-skip" style="background:transparent;color:#9ca3af;border:1px solid #374151;padding:0.75rem 1.5rem;border-radius:6px;cursor:pointer;">Skip</button>
        </div>
      </div>
    \`;
    document.body.appendChild(overlay);
    overlay.querySelector('#dlux-ad-continue').onclick = () => {
      overlay.remove();
      onContinue?.();
    };
    overlay.querySelector('#dlux-ad-skip').onclick = () => {
      overlay.remove();
      onSkip?.();
    };
  };
  const showAd = async ({ type = 'slip', cooldownMs = 10 * 60 * 1000 } = {}) => {
    if (await isSubscriptionActive()) {
      return { shown: false, blocked: 'subscription' };
    }
    const identity = getUserIdentity();
    const last = getLastAdTime(identity);
    const now = Date.now();
    if (now - last < cooldownMs) {
      return { shown: false, blocked: 'cooldown', retryInMs: cooldownMs - (now - last) };
    }
    return new Promise((resolve) => {
      renderAdOverlay({
        type,
        onContinue: async () => {
          setLastAdTime(identity, Date.now());
          try {
            await fetch(\`\${WALRUS_SERVICE}/ads/consent\`, { method: 'POST' });
          } catch {
            // ignore
          }
          resolve({ shown: true });
        },
        onSkip: () => resolve({ shown: false, skipped: true })
      });
    });
  };
  const openProfile = (identifier) => {
    window.location.href = '/@' + identifier;
  };
  const getPremiumContentAPI = () => ({
    async createContent(file, metadata) {
      const formData = new FormData();
      formData.append('file', file);
      Object.keys(metadata).forEach(key => {
        formData.append(key, metadata[key]);
      });

      const response = await fetch(`${WALRUS_SERVICE}/premium/content`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'Failed to create premium content');
      }

      return response.json();
    },

    async getContent(dappId, userAddress) {
      const params = userAddress ? `?user=${encodeURIComponent(userAddress)}` : '';
      const response = await fetch(`${WALRUS_SERVICE}/premium/content/${dappId}${params}`);

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'Failed to get premium content');
      }

      return response.json();
    },

    async purchaseContent(contentId, paymentTxId) {
      const address = await requireWalletAddress();
      const response = await fetch(`${WALRUS_SERVICE}/premium/purchase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contentId,
          buyer: address,
          paymentTxId
        })
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'Failed to purchase premium content');
      }

      return response.json();
    },

    async transferSui(recipientAddress, amountSui) {
      const sender = await requireWalletAddress();
      if (!window.dluxWallet?.signAndExecuteTransactionBlock) {
        throw new Error('Wallet does not support transaction signing');
      }
      const amountMist = BigInt(Math.round(Number(amountSui) * 1e9));
      if (amountMist <= 0n) throw new Error('Amount must be positive');
      const { Transaction } = await import('https://esm.sh/@mysten/sui/transactions@1.45.2');
      const { SuiClient } = await import('https://esm.sh/@mysten/sui/client@1.45.2');
      const client = new SuiClient({ url: SUI_RPC_URL });
      const tx = new Transaction();
      const [coin] = tx.splitCoins(tx.gas, [amountMist]);
      tx.transferObjects([coin], recipientAddress);
      tx.setSender(sender);
      const bytes = await tx.build({ client });
      const result = await window.dluxWallet.signAndExecuteTransactionBlock(bytes, { showEffects: true }, 'WaitForEffectsCert');
      const digest = result?.digest ?? result?.effects?.transactionDigest;
      if (!digest) throw new Error('No transaction digest returned');
      return digest;
    },

    async purchaseContentWithTransfer(contentId, recipientAddress, amountSui) {
      const digest = await this.transferSui(recipientAddress, amountSui);
      return this.purchaseContent(contentId, digest);
    },

    async accessContent(contentId) {
      const address = await requireWalletAddress();
      const response = await fetch(`${WALRUS_SERVICE}/premium/access/${contentId}?user=${encodeURIComponent(address)}`);

      if (!response.ok) {
        if (response.status === 403) {
          const error = await response.json().catch(() => ({}));
          throw new Error(error.error || 'Access denied');
        }
        throw new Error('Failed to access premium content');
      }

      return response.blob();
    },

    async getPurchases() {
      const address = await requireWalletAddress();
      const response = await fetch(`${WALRUS_SERVICE}/premium/purchases/${address}`);

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'Failed to get purchases');
      }

      return response.json();
    }
  });

  const createOverlay = () => {
    const style = document.createElement('style');
    style.textContent = \`
      .dlux-overlay-tab {
        position: fixed;
        top: 0;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(15, 23, 42, 0.35);
        color: #e2e8f0;
        padding: 6px 16px;
        border-radius: 0 0 10px 10px;
        font-size: 12px;
        font-weight: 600;
        letter-spacing: 0.04em;
        cursor: pointer;
        z-index: 10002;
        backdrop-filter: blur(8px);
      }
      .dlux-overlay-panel {
        position: fixed;
        top: 28px;
        left: 50%;
        transform: translateX(-50%);
        width: min(540px, 92vw);
        background: rgba(15, 23, 42, 0.9);
        color: #e2e8f0;
        border: 1px solid rgba(148, 163, 184, 0.2);
        border-radius: 12px;
        padding: 16px;
        display: none;
        z-index: 10002;
        backdrop-filter: blur(12px);
        box-shadow: 0 12px 30px rgba(0,0,0,0.35);
      }
      .dlux-overlay-panel h4 { margin: 0 0 8px 0; font-size: 16px; }
      .dlux-overlay-panel .dlux-meta-grid { display: grid; gap: 8px; }
      .dlux-overlay-panel .dlux-row { display: flex; justify-content: space-between; gap: 8px; font-size: 13px; }
      .dlux-overlay-panel .dlux-pill { background: rgba(99, 102, 241, 0.2); padding: 2px 8px; border-radius: 999px; font-size: 11px; }
      .dlux-overlay-panel button { margin-right: 6px; margin-top: 8px; }
    \`;
    document.head.appendChild(style);

    const tab = document.createElement('div');
    tab.className = 'dlux-overlay-tab';
    tab.textContent = 'DLUX';

    const panel = document.createElement('div');
    panel.className = 'dlux-overlay-panel';
    panel.innerHTML = \`
      <h4>DLUX dApp Info</h4>
      <div class="dlux-meta-grid">
        <div class="dlux-row"><span>PM Rating</span><span id="dlux-pm-status">Loading...</span></div>
        <div class="dlux-row"><span>Tags</span><span id="dlux-tags">-</span></div>
        <div class="dlux-row"><span>Labels</span><span id="dlux-labels">-</span></div>
        <div class="dlux-row"><span>Metadata</span><span id="dlux-meta">-</span></div>
      </div>
      <div>
        <button id="dlux-open-remix">Remix</button>
        <button id="dlux-open-pm">View PM</button>
      </div>
    \`;

    document.body.appendChild(tab);
    document.body.appendChild(panel);

    tab.addEventListener('click', () => {
      panel.style.display = panel.style.display === 'block' ? 'none' : 'block';
    });

    return { tab, panel };
  };

  const hydrateOverlay = async (context) => {
    let meta = window.dluxDappMeta || {};
    if (context.author && context.permlink) {
      try {
        const res = await fetch(\`\${SUI_SERVICE}/dapps/lookup?author=\${encodeURIComponent(context.author)}&permlink=\${encodeURIComponent(context.permlink)}\`);
        if (res.ok) {
          meta = await res.json();
        }
      } catch {
        // fallback to window.dluxDappMeta
      }
    }
    const tags = Array.isArray(meta.tags) && meta.tags.length ? meta.tags.join(', ') : '-';
    const labels = Array.isArray(meta.labels) && meta.labels.length ? meta.labels.join(', ') : (meta.category || '-');
    const metaText = meta.description || meta.name || meta.title || '-';

    const tagsEl = document.getElementById('dlux-tags');
    const labelsEl = document.getElementById('dlux-labels');
    const metaEl = document.getElementById('dlux-meta');
    if (tagsEl) tagsEl.textContent = tags;
    if (labelsEl) labelsEl.textContent = labels;
    if (metaEl) metaEl.textContent = metaText;

    const statusEl = document.getElementById('dlux-pm-status');
    if (statusEl) {
      try {
        const res = await fetch(\`\${PM_SERVICE}/safety/dapp/\${context.dappId}?permlink=\${context.permlink}&author=\${context.author}\`);
        if (!res.ok) throw new Error('PM unavailable');
        const data = await res.json();
        statusEl.textContent = data.overallStatus ? data.overallStatus.toUpperCase() : 'UNKNOWN';
      } catch {
        statusEl.textContent = 'N/A';
      }
    }

    const remixBtn = document.getElementById('dlux-open-remix');
    if (remixBtn) {
      remixBtn.onclick = () => {
        window.location.href = '/remix';
      };
    }
    const pmBtn = document.getElementById('dlux-open-pm');
    if (pmBtn) {
      pmBtn.onclick = () => {
        window.location.href = \`/dapps/\${context.dappId}\`;
      };
    }
  };

  window.dluxSocial = {
    getContext: parseContext,
    getAuthSession,
    createPost,
    listPosts,
    createInteraction,
    openProfile
  };

  window.dluxPremium = getPremiumContentAPI();

  window.dluxAds = {
    showAd,
    getCooldown: () => {
      const identity = getUserIdentity();
      const last = getLastAdTime(identity);
      const now = Date.now();
      return { last, remainingMs: Math.max(0, 10 * 60 * 1000 - (now - last)) };
    }
  };

  document.addEventListener('DOMContentLoaded', () => {
    const context = parseContext();
    createOverlay();
    hydrateOverlay(context);
  });
})();`;
  res.setHeader('Content-Type', 'application/javascript');
  res.send(script);
});

app.use(async (req, res) => {
  try {
    const subdomain = req.hostname.split('.')[0];
    const [author, permlink] = subdomain.includes('@') 
      ? subdomain.split('@').slice(1) 
      : [null, subdomain];

    const contentId = author && permlink ? `${author}_${permlink}` : permlink;

    // Check for active ads (query DGraph for ads targeting this content)
    let activeAd = null;
    try {
      const adsRes = await axios.get(`${DGRAPH_SERVICE}/ads/active`, {
        params: { contentId, placement: 'gate' }
      });
      activeAd = adsRes.data?.ad || null;
    } catch (error) {
      // No ads or error - continue without ads
    }

    // Fetch safety status from PM service
    let safetyWarning = '';
    let safetyColor = 'gray';
    let ageRestrictedMarkets = [];
    let gdprMarkets = [];
    let nsfwMarkets = [];
    
    try {
      const dappId = `${author}_${permlink}`;
      const safetyRes = await axios.get(`${DGRAPH_SERVICE}/safety/dapp/${dappId}?permlink=${permlink}&author=${author}`);
      const safety = safetyRes.data;
      
      if (safety.activeMarkets && safety.activeMarkets.length > 0) {
        safetyColor = safety.overallColor;
        const marketCount = safety.activeMarkets.length;
        
        // Categorize markets
        ageRestrictedMarkets = safety.activeMarkets.filter(m => 
          m.safetyMetric === 'age-restricted' || m.safetyMetric === 'nsfw'
        );
        gdprMarkets = safety.activeMarkets.filter(m => 
          m.safetyMetric === 'gdpr-compliance' || m.safetyMetric === 'cookie-banner'
        );
        nsfwMarkets = safety.activeMarkets.filter(m => m.safetyMetric === 'nsfw');
        
        // Build warning message
        safetyWarning = `<div style="background:${safetyColor === 'red' ? '#fee' : safetyColor === 'yellow' ? '#ffe' : '#efe'};border:2px solid ${safetyColor === 'red' ? '#f00' : safetyColor === 'yellow' ? '#ff0' : '#0f0'};padding:1rem;margin:1rem 0;border-radius:4px;">
          <strong>⚠️ Safety Notice:</strong> This dApp has ${marketCount} active safety review${marketCount > 1 ? 's' : ''}. 
          Status: <span style="color:${safetyColor}">${safety.overallStatus.toUpperCase()}</span>
        </div>`;
      }
    } catch (error) {
      // PM service unavailable - continue without warning
    }

    // Build age confirmation dialog script
    let ageDialogScript = '';
    if (ageRestrictedMarkets.length > 0 || nsfwMarkets.length > 0) {
      const maxAge = ageRestrictedMarkets
        .map(m => m.recommendedAge || '18+')
        .reduce((max, age) => {
          const ageNum = parseInt(age.replace('+', '')) || 18;
          const maxNum = parseInt(max.replace('+', '')) || 18;
          return ageNum > maxNum ? age : max;
        }, '18+');
      
      ageDialogScript = `
        <div id="age-confirmation-dialog" style="display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.8);z-index:10000;display:flex;align-items:center;justify-content:center;">
          <div style="background:white;padding:2rem;border-radius:8px;max-width:400px;text-align:center;">
            <h2>Age Verification Required</h2>
            <p>This content is rated <strong>${maxAge}</strong>.</p>
            <p>You must be at least ${maxAge.replace('+', '')} years old to continue.</p>
            <div style="margin-top:1.5rem;">
              <button id="age-confirm-yes" style="background:#667eea;color:white;border:none;padding:0.75rem 2rem;border-radius:4px;margin-right:1rem;cursor:pointer;">I am ${maxAge.replace('+', '')} or older</button>
              <button id="age-confirm-no" style="background:#ccc;color:black;border:none;padding:0.75rem 2rem;border-radius:4px;cursor:pointer;">I am not</button>
            </div>
          </div>
        </div>
        <script>
          (function() {
            const dialog = document.getElementById('age-confirmation-dialog');
            const confirmed = sessionStorage.getItem('age-confirmed-${subdomain}');
            
            if (!confirmed) {
              dialog.style.display = 'flex';
              
              document.getElementById('age-confirm-yes').onclick = function() {
                sessionStorage.setItem('age-confirmed-${subdomain}', 'true');
                dialog.style.display = 'none';
              };
              
              document.getElementById('age-confirm-no').onclick = function() {
                window.location.href = '/';
              };
            } else {
              dialog.style.display = 'none';
            }
          })();
        </script>`;
    }

    // Build GDPR banner script
    let gdprBannerScript = '';
    if (gdprMarkets.length > 0) {
      gdprBannerScript = `
        <div id="gdpr-banner" style="display:none;position:fixed;bottom:0;left:0;right:0;background:#f5f5f5;border-top:2px solid #667eea;padding:1rem;z-index:9999;box-shadow:0 -2px 10px rgba(0,0,0,0.1);">
          <div style="max-width:1200px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:1rem;">
            <div style="flex:1;min-width:200px;">
              <strong>🍪 Cookie & Privacy Notice</strong>
              <p style="margin:0.5rem 0 0 0;font-size:0.9rem;">This dApp may use cookies and collect data. By continuing, you agree to our privacy policy.</p>
            </div>
            <div style="display:flex;gap:0.5rem;">
              <button id="gdpr-accept" style="background:#667eea;color:white;border:none;padding:0.5rem 1.5rem;border-radius:4px;cursor:pointer;">Accept</button>
              <button id="gdpr-decline" style="background:transparent;color:#667eea;border:1px solid #667eea;padding:0.5rem 1.5rem;border-radius:4px;cursor:pointer;">Decline</button>
            </div>
          </div>
        </div>
        <script>
          (function() {
            const banner = document.getElementById('gdpr-banner');
            const gdprAccepted = localStorage.getItem('gdpr-accepted-${subdomain}');
            
            if (!gdprAccepted) {
              banner.style.display = 'block';
              
              document.getElementById('gdpr-accept').onclick = function() {
                localStorage.setItem('gdpr-accepted-${subdomain}', 'true');
                banner.style.display = 'none';
              };
              
              document.getElementById('gdpr-decline').onclick = function() {
                localStorage.setItem('gdpr-accepted-${subdomain}', 'declined');
                banner.style.display = 'none';
              };
            }
          })();
        </script>`;
    }

    // Build ad overlay script (if ad exists)
    let adOverlayScript = '';
    if (activeAd) {
      const safeAdJson = JSON.stringify(activeAd).replace(/</g, '\\u003c');
      adOverlayScript = `
        <div id="ad-overlay" style="display:flex;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.9);z-index:10001;align-items:center;justify-content:center;">
          <div style="background:white;padding:2rem;border-radius:8px;max-width:600px;text-align:center;">
            <h2>Sponsored Content</h2>
            <div id="ad-preview" style="margin:1.5rem 0;">
              <h3 id="ad-title"></h3>
              <p id="ad-description"></p>
            </div>
            <div style="margin-top:1.5rem;">
              <button id="continue-to-content" style="background:#667eea;color:white;border:none;padding:0.75rem 2rem;border-radius:4px;cursor:pointer;font-size:1rem;">Continue to Content</button>
              <a id="ad-click" target="_blank" rel="noopener noreferrer" style="display:inline-block;background:#111827;color:white;padding:0.75rem 2rem;border-radius:4px;margin-left:1rem;text-decoration:none;font-size:1rem;">Learn More</a>
              <button id="skip-ad" style="background:transparent;color:#667eea;border:1px solid #667eea;padding:0.75rem 2rem;border-radius:4px;cursor:pointer;margin-left:1rem;font-size:1rem;">Skip Ad</button>
            </div>
          </div>
        </div>
        <script>
          (function() {
            const overlay = document.getElementById('ad-overlay');
            const continueBtn = document.getElementById('continue-to-content');
            const skipBtn = document.getElementById('skip-ad');
            const adTitle = document.getElementById('ad-title');
            const adDescription = document.getElementById('ad-description');
            const adClick = document.getElementById('ad-click');
            const contentId = '${contentId}';
            const adData = ${safeAdJson};
            const adId = adData?.id || 'default';
            if (adTitle) adTitle.textContent = adData?.title || 'Ad';
            if (adDescription) adDescription.textContent = adData?.description || '';
            if (adClick) {
              try {
                const targetUrl = new URL(adData?.targetUrl);
                const clickUrl = '${WALRUS_SERVICE}/ads/click?adId=' + encodeURIComponent(adId) +
                  '&contentId=' + encodeURIComponent(contentId) +
                  '&target=' + encodeURIComponent(targetUrl.toString());
                adClick.href = clickUrl;
              } catch (e) {
                adClick.remove();
              }
            }
            
            // Check if user already verified ad view
            const verified = sessionStorage.getItem('ad-verified-' + contentId);
            if (verified) {
              overlay.style.display = 'none';
              return;
            }
            
            async function generateZKProof() {
              try {
                try {
                  await fetch('${WALRUS_SERVICE}/ads/consent', { method: 'POST' });
                } catch {
                  // ignore consent failures
                }

                // Fetch current block header from DGraph service (social chain)
                const blockRes = await fetch('${DGRAPH_SERVICE}/blocks/latest');
                const blockData = await blockRes.json();
                const blockHeader = blockData?.latestBlock?.blockHash
                  || String(blockData?.latestBlock?.blockNumber || Date.now());
                
                // Generate random salt (client-side, never sent to server)
                const secretSalt = Array.from(crypto.getRandomValues(new Uint8Array(32)))
                  .map(b => b.toString(16).padStart(2, '0')).join('');
                
                // Get viewer identity (from wallet or session)
                // For MVP, we'll use a placeholder - in production, get from wallet
                const viewerIdentity = sessionStorage.getItem('suiAddress') || 'anonymous';
                
                // Generate ZK proof
                const proofRes = await fetch('${ZK_SERVICE}/proofs/generate', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    adId: adId,
                    viewerIdentity: viewerIdentity,
                    contentId: contentId,
                    blockHeader: blockHeader,
                    secretSalt: secretSalt
                  })
                });
                
                if (!proofRes.ok) {
                  throw new Error('Failed to generate ZK proof');
                }
                
                const proofData = await proofRes.json();
                
                // Submit impression to DGraph
                const impressionRes = await fetch('${DGRAPH_SERVICE}/impressions', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    adId: adId,
                    contentId: contentId,
                    zkProof: {
                      proof: proofData.proof,
                      publicSignals: proofData.publicSignals
                    },
                    proofHash: proofData.proofHash,
                    encryptedViewer: proofData.encryptedViewer,
                    blockHeader: blockHeader
                  })
                });
                
                if (!impressionRes.ok) {
                  throw new Error('Failed to record impression');
                }
                
                // Mark as verified
                sessionStorage.setItem('ad-verified-' + contentId, 'true');
                overlay.style.display = 'none';
              } catch (error) {
                console.error('Error generating ZK proof:', error);
                // On error, allow user to continue anyway
                overlay.style.display = 'none';
              }
            }
            
            continueBtn.onclick = generateZKProof;
            skipBtn.onclick = function() {
              overlay.style.display = 'none';
            };
          })();
        </script>`;
    }

    const dappId = author && permlink ? `${author}_${permlink}` : subdomain;
    const localDappRoot = path.join(__dirname, 'dapps');
    const indexPath = path.join(localDappRoot, subdomain, 'index.html');
    const remixPath = path.join(localDappRoot, subdomain, 'remix.html');
    if (fs.existsSync(indexPath)) {
      const isRemix = req.path === '/remix' || req.path === '/remix.html';
      const targetPath = isRemix && fs.existsSync(remixPath) ? remixPath : indexPath;
      res.setHeader('Content-Type', 'text/html');
      res.send(fs.readFileSync(targetPath, 'utf8'));
      return;
    }

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>dApp: ${subdomain}</title><link rel="manifest" href="/manifest.json"><meta name="theme-color" content="#667eea"><script src="/wallet-script.js"></script><script src="/nav-script.js"></script><script src="/social-script.js"></script></head><body><div id="app">${safetyWarning}<h1>dApp: ${subdomain}</h1><p>Loading from Walrus...</p></div>${ageDialogScript}${gdprBannerScript}${adOverlayScript}<script>if('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js');</script><script>(function(){const dappId='${dappId}';const installKey='dlux_install_id_'+dappId;const reportedKey='dlux_install_reported_'+dappId;let deferredInstallPrompt=null;const getInstallId=()=>{let id=localStorage.getItem(installKey);if(!id){id=crypto.randomUUID();localStorage.setItem(installKey,id);}return id;};async function getPushSubscription(){try{if(!('serviceWorker' in navigator))return null;const reg=await navigator.serviceWorker.ready;if(!reg.pushManager)return null;const sub=await reg.pushManager.getSubscription();return sub?sub.toJSON():null;}catch{return null;}}async function resolveSuiAddress(wallet){let address=sessionStorage.getItem('suiAddress');if(address)return address;if(wallet?.connect){address=await wallet.connect();if(address)sessionStorage.setItem('suiAddress',address);}return address;}async function reportInstall(){try{if(localStorage.getItem(reportedKey))return;const installId=getInstallId();const wallet=window.dluxWallet;if(!wallet||!wallet.signMessage)return;const suiAddress=await resolveSuiAddress(wallet);if(!suiAddress)return;const challengeRes=await fetch('${SUI_SERVICE}/dapps/'+dappId+'/install/challenge',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({suiAddress})});if(!challengeRes.ok)return;const challengeData=await challengeRes.json();const signature=await wallet.signMessage(challengeData.challenge);const subscription=await getPushSubscription();const payload={suiAddress,signature,challengeId:challengeData.challengeId,installId,platform:navigator.platform||'unknown',userAgent:navigator.userAgent||'',subscription};await fetch('${SUI_SERVICE}/dapps/'+dappId+'/install',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});localStorage.setItem(reportedKey,'true');}catch(e){console.error('Install report failed',e);}}async function maybeShowInstallAd(){if(!window.dluxAds||!window.dluxAds.showAd)return true;const result=await window.dluxAds.showAd({type:'install'});return !!result?.shown;}window.addEventListener('beforeinstallprompt',async(e)=>{e.preventDefault();deferredInstallPrompt=e;const ok=await maybeShowInstallAd();if(!ok)return;deferredInstallPrompt.prompt();});window.addEventListener('appinstalled',reportInstall);})();</script></body></html>`;
    res.send(html);
  } catch (error) {
    console.error('Error serving dApp:', error);
    res.status(500).send('Error loading dApp');
  }
});

app.listen(PORT, () => console.log('Sandbox Service on', PORT));