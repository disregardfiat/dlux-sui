const express = require('express');
const axios = require('axios');
const app = express();
const PORT = 3007;

const SUI_SERVICE = process.env.SUI_SERVICE_URL || 'http://localhost:3001';
const GRAPHQL_SERVICE = process.env.GRAPHQL_SERVICE_URL || 'http://localhost:3003';
const WALRUS_SERVICE = process.env.WALRUS_SERVICE_URL || 'http://localhost:3002';

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
  const script = `window.dluxWallet={connect:async()=>{if(window.suiWallet)return await window.suiWallet.connect();throw new Error('SUI wallet not available');},sign:async(m)=>{if(window.suiWallet)return await window.suiWallet.signMessage({message:m});throw new Error('SUI wallet not available');}};`;
  res.setHeader('Content-Type', 'application/javascript');
  res.send(script);
});

app.get('/nav-script.js', (req, res) => {
  const script = `window.dluxNav={navigate:p=>window.location.href=p,update:()=>{if(window.dluxNavUpdateCallback)window.dluxNavUpdateCallback();}};`;
  res.setHeader('Content-Type', 'application/javascript');
  res.send(script);
});

app.use(async (req, res) => {
  try {
    const subdomain = req.hostname.split('.')[0];
    const [author, permlink] = subdomain.includes('@') 
      ? subdomain.split('@').slice(1) 
      : [null, subdomain];

    // Fetch safety status from PM service
    let safetyWarning = '';
    let safetyColor = 'gray';
    let ageRestrictedMarkets = [];
    let gdprMarkets = [];
    let nsfwMarkets = [];
    
    try {
      const axios = require('axios');
      const PM_SERVICE = process.env.PM_SERVICE_URL || 'http://localhost:3008';
      const dappId = `${author}_${permlink}`;
      const safetyRes = await axios.get(`${PM_SERVICE}/safety/dapp/${dappId}?permlink=${permlink}&author=${author}`);
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

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>dApp: ${subdomain}</title><link rel="manifest" href="/manifest.json"><meta name="theme-color" content="#667eea"><script src="/wallet-script.js"></script><script src="/nav-script.js"></script></head><body><div id="app">${safetyWarning}<h1>dApp: ${subdomain}</h1><p>Loading from Walrus...</p></div>${ageDialogScript}${gdprBannerScript}<script>if('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js');</script></body></html>`;
    res.send(html);
  } catch (error) {
    console.error('Error serving dApp:', error);
    res.status(500).send('Error loading dApp');
  }
});

app.listen(PORT, () => console.log('Sandbox Service on', PORT));