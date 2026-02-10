import express from 'express';
import axios from 'axios';
import crypto from 'crypto';
import { logger } from '../utils/logger';

const router = express.Router();

const ZK_SERVICE_URL = process.env.ZK_SERVICE_URL || 'http://localhost:3010';
const DGRAPH_SERVICE_URL = process.env.DGRAPH_SERVICE_URL || 'http://localhost:3003';
const CONSENT_REQUIRED = (process.env.CONSENT_REQUIRED || 'true') === 'true';
const CONSENT_COOKIE_NAME = process.env.CONSENT_COOKIE_NAME || 'dlux_consent';
const CONSENT_COOKIE_VALUE = process.env.CONSENT_COOKIE_VALUE || 'accepted';
const CONSENT_REDIRECT_URL = process.env.CONSENT_REDIRECT_URL || '';

function parseCookies(cookieHeader?: string): Record<string, string> {
  if (!cookieHeader) return {};
  return cookieHeader.split(';').reduce((acc, pair) => {
    const [key, ...rest] = pair.trim().split('=');
    acc[key] = decodeURIComponent(rest.join('='));
    return acc;
  }, {} as Record<string, string>);
}

function hasConsent(req: express.Request): boolean {
  if (!CONSENT_REQUIRED) return true;
  const cookies = parseCookies(req.headers.cookie);
  return cookies[CONSENT_COOKIE_NAME] === CONSENT_COOKIE_VALUE;
}

function requireConsent(req: express.Request, res: express.Response): boolean {
  if (hasConsent(req)) return true;
  if (CONSENT_REDIRECT_URL) {
    const returnTo = encodeURIComponent(req.originalUrl || '/');
    return res.redirect(`${CONSENT_REDIRECT_URL}?return=${returnTo}`) as any;
  }
  res.status(403).json({
    error: 'Consent required',
    consentRequired: true
  });
  return false;
}

function sha256(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

async function fetchBlockHeader(): Promise<string> {
  try {
    const response = await axios.get(`${DGRAPH_SERVICE_URL}/blocks/latest`);
    return response.data?.latestBlock?.blockHash || response.data?.latestBlock?.blockNumber?.toString() || Date.now().toString();
  } catch (error) {
    logger.warn('Failed to fetch block header, using timestamp');
    return Date.now().toString();
  }
}

/**
 * GET /ads/click
 * Query: adId, contentId, target
 * Optional: identity (header x-dlux-identity)
 */
router.get('/click', async (req, res) => {
  try {
    if (!requireConsent(req, res)) return;
    const { adId, contentId, target } = req.query;
    if (!adId || !contentId || !target) {
      return res.status(400).json({ error: 'Missing required query params: adId, contentId, target' });
    }

    const cookies = parseCookies(req.headers.cookie);
    const viewerIdentity = (req.headers['x-dlux-identity'] as string) || cookies['dlux_identity'] || 'anonymous';

    const blockHeader = await fetchBlockHeader();
    const secretSalt = crypto.randomBytes(32).toString('hex');

    const proofRes = await axios.post(`${ZK_SERVICE_URL}/proofs/generate`, {
      adId,
      viewerIdentity,
      contentId,
      blockHeader,
      secretSalt,
      actionType: 'click'
    });

    let redirectUrl: URL;
    try {
      redirectUrl = new URL(String(target));
    } catch {
      return res.status(400).json({ error: 'Invalid target URL' });
    }

    const proofData = proofRes.data;
    const clickToken = crypto.randomBytes(16).toString('hex');
    const clickTokenHash = sha256(clickToken);
    const targetHash = sha256(String(target));

    await axios.post(`${DGRAPH_SERVICE_URL}/ads/clicks`, {
      adId,
      contentId,
      clickTokenHash,
      targetHash,
      zkProof: {
        proof: proofData.proof,
        publicSignals: proofData.publicSignals
      },
      proofHash: proofData.proofHash,
      encryptedViewer: proofData.encryptedViewer,
      blockHeader
    });

    redirectUrl.searchParams.set('dlux_click', clickToken);
    return res.redirect(redirectUrl.toString());
  } catch (error) {
    logger.error('Failed to record ad click', error);
    res.status(500).json({ error: 'Failed to record ad click' });
  }
});

/**
 * GET /ads/convert
 * Query: adId, contentId, click, target?
 */
router.get('/convert', async (req, res) => {
  try {
    if (!requireConsent(req, res)) return;
    const { adId, contentId, click, target } = req.query;
    if (!adId || !contentId || !click) {
      return res.status(400).json({ error: 'Missing required query params: adId, contentId, click' });
    }

    const cookies = parseCookies(req.headers.cookie);
    const viewerIdentity = (req.headers['x-dlux-identity'] as string) || cookies['dlux_identity'] || 'anonymous';

    const blockHeader = await fetchBlockHeader();
    const secretSalt = crypto.randomBytes(32).toString('hex');
    const clickTokenHash = sha256(String(click));
    const clickCheck = await axios.get(`${DGRAPH_SERVICE_URL}/ads/click-token/${clickTokenHash}`);
    if (!clickCheck.data?.exists) {
      return res.status(400).json({ error: 'Invalid click token' });
    }
    const conversionToken = crypto.randomBytes(16).toString('hex');
    const conversionTokenHash = sha256(conversionToken);

    const proofRes = await axios.post(`${ZK_SERVICE_URL}/proofs/generate`, {
      adId,
      viewerIdentity,
      contentId,
      blockHeader,
      secretSalt,
      actionType: 'conversion'
    });

    const proofData = proofRes.data;

    await axios.post(`${DGRAPH_SERVICE_URL}/ads/conversions`, {
      adId,
      contentId,
      clickTokenHash,
      conversionTokenHash,
      zkProof: {
        proof: proofData.proof,
        publicSignals: proofData.publicSignals
      },
      proofHash: proofData.proofHash,
      encryptedViewer: proofData.encryptedViewer,
      blockHeader
    });

    if (target) {
      try {
        const redirectUrl = new URL(String(target));
        redirectUrl.searchParams.set('dlux_conversion', conversionToken);
        return res.redirect(redirectUrl.toString());
      } catch {
        return res.status(400).json({ error: 'Invalid target URL' });
      }
    }

    res.json({ success: true, conversionToken });
  } catch (error) {
    logger.error('Failed to record ad conversion', error);
    res.status(500).json({ error: 'Failed to record ad conversion' });
  }
});

/**
 * POST /ads/consent
 * Set consent cookie (explicit opt-in)
 */
router.post('/consent', (req, res) => {
  const maxAge = 365 * 24 * 60 * 60 * 1000;
  res.cookie(CONSENT_COOKIE_NAME, CONSENT_COOKIE_VALUE, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge
  });
  res.json({ success: true });
});

export { router as adsRouter };
