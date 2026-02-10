/**
 * API helpers for E2E tests.
 *
 * Implements the same surface as docs/api/dgraph-openapi.yaml (DGraph) and
 * Developer Guide API reference (SUI, Walrus). Social and off-chain flows
 * run through DGraph (DGRAPH_SERVICE_URL). See docs/architecture-cohesion.md.
 */

import axios, { AxiosInstance } from 'axios';

const E2E_BASE = process.env.E2E_BASE_URL || '';
const isTestDlux = E2E_BASE.includes('test.dlux.io');
const isDluxProd = E2E_BASE.includes('dlux.io') && !isTestDlux;
const isDluxAny = isTestDlux || isDluxProd;

const SUI_SERVICE_URL = process.env.SUI_SERVICE_URL || (isDluxAny ? 'https://sui.dlux.io' : 'http://localhost:3001');
const DGRAPH_SERVICE_URL = process.env.DGRAPH_SERVICE_URL || (isDluxAny ? 'https://gql.dlux.io' : 'http://localhost:3003');
const WALRUS_SERVICE_URL = process.env.WALRUS_SERVICE_URL || (isDluxAny ? (isDluxProd ? 'https://dlux.io/api/walrus' : 'https://test.dlux.io/api/walrus') : 'http://localhost:3002');

export class ApiClient {
  private suiClient: AxiosInstance;
  private dgraphClient: AxiosInstance;
  private walrusClient: AxiosInstance;

  private pmClient: AxiosInstance;

  constructor() {
    this.suiClient = axios.create({
      baseURL: SUI_SERVICE_URL,
      timeout: 10000,
    });

    this.dgraphClient = axios.create({
      baseURL: DGRAPH_SERVICE_URL,
      timeout: 10000,
    });

    this.walrusClient = axios.create({
      baseURL: WALRUS_SERVICE_URL,
      timeout: 10000,
    });

    this.pmClient = axios.create({
      baseURL: DGRAPH_SERVICE_URL,
      timeout: 10000,
    });
  }

  // Campaign API
  async createCampaign(data: {
    advertiser: string;
    title: string;
    description?: string;
    targetUrl: string;
    placements: string[];
    bid: number;
    totalBudget: number;
  }) {
    const response = await this.dgraphClient.post('/campaigns', data);
    return response.data;
  }

  async getCampaign(id: string) {
    const response = await this.dgraphClient.get(`/campaigns/${id}`);
    return response.data;
  }

  async listCampaigns(filters?: { advertiser?: string; status?: string }) {
    const response = await this.dgraphClient.get('/campaigns', { params: filters });
    return response.data;
  }

  async pauseCampaign(id: string) {
    const response = await this.dgraphClient.post(`/campaigns/${id}/pause`);
    return response.data;
  }

  async resumeCampaign(id: string) {
    const response = await this.dgraphClient.post(`/campaigns/${id}/resume`);
    return response.data;
  }

  async cancelCampaign(id: string) {
    const response = await this.dgraphClient.delete(`/campaigns/${id}`);
    return response.data;
  }

  // Ad Selection API
  async selectAd(data: { placement: string; contentId?: string }) {
    const response = await this.dgraphClient.post('/ads/select', data);
    return response.data;
  }

  // Impressions API
  async createImpression(data: {
    adId: string;
    contentId: string;
    zkProof: { proof: any; publicSignals: string[] };
    proofHash: string;
    encryptedViewer: string;
    blockHeader: string;
  }) {
    const response = await this.dgraphClient.post('/impressions', data);
    return response.data;
  }

  async getImpression(id: string) {
    const response = await this.dgraphClient.get(`/impressions/${id}`);
    return response.data;
  }

  async listImpressions(filters?: { adId?: string; contentId?: string; verified?: boolean }) {
    const response = await this.dgraphClient.get('/impressions', { params: filters });
    return response.data;
  }

  async verifyImpression(id: string) {
    const response = await this.dgraphClient.post(`/impressions/${id}/verify`);
    return response.data;
  }

  // Analytics API
  async getCampaignAnalytics(campaignId: string) {
    const response = await this.dgraphClient.get(`/analytics/campaign/${campaignId}`);
    return response.data;
  }

  async getAdvertiserAnalytics(advertiser: string) {
    const response = await this.dgraphClient.get(`/analytics/advertiser/${advertiser}`);
    return response.data;
  }

  async getPlatformAnalytics() {
    const response = await this.dgraphClient.get('/analytics/platform');
    return response.data;
  }

  // Walrus Ads Gateway API
  async giveConsent(data: { user: string; consent: boolean }) {
    const response = await this.walrusClient.post('/ads/consent', data);
    return response.data;
  }

  async clickAd(data: { adId: string; contentId: string; target: string; user?: string }) {
    // Walrus /ads/click requires consent cookie (403 without it)
    const response = await this.walrusClient.get('/ads/click', {
      params: {
        adId: data.adId || 'test_ad',
        contentId: data.contentId || 'test_content',
        target: data.target
      },
      headers: { Cookie: 'dlux_consent=accepted' },
      maxRedirects: 0,
      validateStatus: (status) => status >= 200 && status < 400
    });
    return response.data;
  }

  async convertAd(data: { clickToken: string; conversionData?: any; adId?: string; contentId?: string }) {
    const response = await this.walrusClient.get('/ads/convert', {
      params: {
        adId: data.adId || 'test_ad_id',
        contentId: data.contentId || 'test_content_id',
        click: data.clickToken,
      },
      headers: { Cookie: 'dlux_consent=accepted' },
      maxRedirects: 0,
      validateStatus: (status) => status >= 200 && status < 400
    });
    return response.data;
  }

  // dApp API (SUI Service)
  async createDapp(data: {
    name: string;
    description: string;
    owner: string;
    permlink?: string;
    blobIds?: string[];
    manifest?: { entryPoint?: string; [k: string]: unknown };
    tags?: string[];
    category?: string;
    postingFee?: number;
  }) {
    const response = await this.suiClient.post('/dapps', data);
    return response.data;
  }

  async listDapps(params?: { limit?: number; offset?: number }) {
    const response = await this.suiClient.get('/dapps', { params });
    return response.data;
  }

  async getDapp(id: string) {
    const response = await this.suiClient.get(`/dapps/${id}`);
    return response.data;
  }

  async searchDapps(params: { q?: string; tags?: string[] }) {
    const response = await this.suiClient.get('/dapps/search', {
      params: { q: params.q, tags: params.tags },
    });
    return response.data;
  }

  async getPredictionMarkets(dappId: string) {
    // PM data is served by DGraph service (gql.dlux.io), not a separate pm.dlux.io host
    const pmBase = process.env.PM_SERVICE_URL || DGRAPH_SERVICE_URL;
    const response = await axios.get(`${pmBase}/markets/dapp/${dappId}`, { timeout: 10000 });
    return response.data;
  }

  async getDappLookup(author: string, permlink: string) {
    const response = await this.suiClient.get('/dapps/lookup', {
      params: { author, permlink },
    });
    return response.data;
  }

  // Safety API (DGraph) - PM-based gateway warnings
  async getSafetyDapp(dappId: string) {
    const response = await this.pmClient.get(`/safety/dapp/${encodeURIComponent(dappId)}`);
    return response.data;
  }

  async getMarketsForDapp(dappId: string) {
    const response = await this.pmClient.get(`/markets/dapp/${encodeURIComponent(dappId)}`);
    return response.data;
  }

  // PM (Prediction Market) API
  async createMarket(data: { dappId: string; safetyMetric?: string }) {
    const response = await this.pmClient.post('/markets', data);
    return response.data;
  }

  async placeBet(marketId: string, data: { bettor: string; side: 'safe' | 'unsafe'; amount: number }) {
    const response = await this.pmClient.post(`/markets/${marketId}/bets`, data);
    return response.data;
  }

  async getPayouts(owner: string) {
    const response = await this.pmClient.get(`/markets/payouts/${owner}`);
    return response.data;
  }

  async getHighPayoutMarkets(limit = 10) {
    const response = await this.pmClient.get('/markets/high-payout', { params: { limit } });
    return response.data;
  }

  async resolveMarket(marketId: string, resolution: 'safe' | 'unsafe') {
    const response = await this.pmClient.post(`/markets/${marketId}/resolve`, { resolution });
    return response.data;
  }

  // Social API (DGraph - signed posts)
  async createPost(data: { author: string; content: string; signature: string; dappId?: string; contentType?: string }) {
    const response = await this.dgraphClient.post('/social/posts', {
      author: data.author,
      content: data.content,
      signature: data.signature,
      dappId: data.dappId,
      contentType: data.contentType || 'text',
    });
    return response.data;
  }

  async getFeed(params?: { author?: string; limit?: number; offset?: number }) {
    const response = await this.dgraphClient.get('/social/posts', { params });
    return response.data;
  }

  async createInteraction(data: { user: string; type: string; targetId: string; targetType?: string; signature: string; content?: string }) {
    const response = await this.dgraphClient.post('/social/interactions', data);
    return response.data;
  }

  async getInteractions(params?: { user?: string; targetId?: string; targetType?: string; type?: string; limit?: number; offset?: number }) {
    const response = await this.dgraphClient.get('/social/interactions', { params });
    return response.data;
  }

  async getPostInteractions(postId: string, type?: string) {
    const response = await this.dgraphClient.get(`/social/posts/${postId}/interactions`, type ? { params: { type } } : undefined);
    return response.data;
  }

  // Auth API (SUI Service)
  async getAuthChallenge(suiAddress: string) {
    const response = await this.suiClient.post('/auth/challenge', { suiAddress });
    return response.data;
  }

  async zkLogin(body: { suiAddress: string; signature: string; challengeId: string; proof?: string; provider?: string }) {
    const response = await this.suiClient.post('/auth/zk-login', body);
    return response.data;
  }

  // SuiNS API (SUI Service)
  async getSuinsProfile(identifier: string) {
    const response = await this.suiClient.get(`/suins/profile/${encodeURIComponent(identifier)}`);
    return response.data;
  }

  async getSuinsAvailability(name: string) {
    const response = await this.suiClient.get(`/suins/availability/${encodeURIComponent(name)}`);
    return response.data;
  }

  // Billing API (SUI Service)
  async getBillingOverview(owner: string) {
    const response = await this.suiClient.get('/billing/overview', { params: { owner } });
    return response.data;
  }

  async claimPayouts(owner: string, buckets: Array<{ type: 'adShare' | 'subscriptionShare' | 'pmShare'; amount: number }>, recipientAddress: string) {
    const response = await this.suiClient.post('/billing/claim', {
      owner,
      buckets,
      recipientAddress,
    });
    return response.data;
  }

  async getStorageFunding(dappId: string, blobId: string) {
    const response = await this.suiClient.get(`/billing/storage/${dappId}/${blobId}`);
    return response.data;
  }

  async getBillingTransactions(owner: string, limit?: number) {
    const params = limit != null ? { owner, limit } : { owner };
    const response = await this.suiClient.get('/billing/transactions', { params });
    return response.data;
  }

  async verifyPayment(txId: string, expectedAmount: number, expectedRecipient: string, buyer: string) {
    const response = await this.suiClient.post('/billing/verify-payment', {
      txId,
      expectedAmount,
      expectedRecipient,
      buyer,
    });
    return response.data;
  }

  async verifyPremiumPayment(payload: {
    txId: string;
    expectedAmount: number;
    expectedRecipient: string;
    buyer: string;
    platformFee: number;
    foundationAddress: string;
    creatorShare: number;
  }) {
    const response = await this.suiClient.post('/billing/verify-premium-payment', payload);
    return response.data;
  }

  // Governance API (DGraph)
  async getGovernanceVariables() {
    const response = await this.dgraphClient.get('/governance/variables');
    return response.data;
  }

  async getGovernanceVariable(name: string) {
    const response = await this.dgraphClient.get(`/governance/variables/${name}`);
    return response.data;
  }

  async getGovernanceMarkets() {
    const response = await this.dgraphClient.get('/governance/markets');
    return response.data;
  }

  // Location / Subscription API (DGraph)
  async updateLocationPreferences(data: { user: string; enabled: boolean; precision?: string; subscribedSpots?: string[] }) {
    const response = await this.dgraphClient.post('/location/preferences', data);
    return response.data;
  }

  async getLocationPreferences(user: string) {
    const response = await this.dgraphClient.get('/location/preferences', { params: { user } });
    return response.data;
  }

  async getPopularSpots() {
    const response = await this.dgraphClient.get('/location/spots/popular');
    return response.data;
  }

  async subscribeToSpot(user: string, spotId: string) {
    const response = await this.dgraphClient.post('/location/spots/subscribe', { user, spotId });
    return response.data;
  }

  async unsubscribeFromSpot(spotId: string, user: string) {
    const response = await this.dgraphClient.delete(`/location/spots/subscribe/${spotId}`, {
      params: { user },
    });
    return response.data;
  }

  // Subscription API (DGraph). Personal data: create and full status require JWT as the subscriber.
  async createSubscription(data: { subscriber: string; paymentTxId: string; expiresAt?: string }, token?: string) {
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await this.dgraphClient.post('/subscription', data, { headers });
    return response.data;
  }

  async getSubscriptionStatus(subscriber: string, token?: string) {
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await this.dgraphClient.get('/subscription/status', { params: { subscriber }, headers });
    return response.data;
  }

  // Blobs API (Walrus Service)
  async uploadBlob(file: Buffer, filename: string, mimetype = 'application/octet-stream') {
    const form = new FormData();
    form.append('file', new Blob([file], { type: mimetype }), filename);
    const response = await this.walrusClient.post('/blobs/upload', form, {
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });
    return response.data;
  }

  async getBlob(blobId: string) {
    const response = await this.walrusClient.get(`/blobs/${blobId}`, { responseType: 'arraybuffer' });
    return response.data;
  }

  async getBlobInfo(blobId: string) {
    const response = await this.walrusClient.get(`/blobs/${blobId}/info`);
    return response.data;
  }

  async getBlobBilling(blobId: string) {
    const response = await this.walrusClient.get(`/blobs/${blobId}/billing`);
    return response.data;
  }

  // Premium purchase (Walrus - calls SUI billing verify-premium-payment internally)
  async purchasePremiumContent(contentId: string, buyer: string, paymentTxId: string) {
    const response = await this.walrusClient.post('/premium/purchase', {
      contentId,
      buyer,
      paymentTxId,
    });
    return response.data;
  }

  // Ad settlement (SUI service: docs/ad-click-to-sui-payouts.md)
  async getAdSettlementStatus() {
    const response = await this.suiClient.get('/ads/settlement/status');
    return response.data;
  }

  async getSettlementImpressions(params: { campaignId?: string; limit?: number }) {
    const response = await this.suiClient.get('/ads/settlement/impressions', { params });
    return response.data;
  }

  // Health checks
  async checkHealth(service: 'sui' | 'dgraph' | 'walrus'): Promise<boolean> {
    try {
      const client = service === 'sui' ? this.suiClient :
                    service === 'dgraph' ? this.dgraphClient :
                    this.walrusClient;
      const response = await client.get('/health');
      // Verify it's actually JSON, not HTML
      if (response.status === 200 && typeof response.data === 'object' && response.data.status) {
        return response.data.status === 'ok';
      }
      // DGraph: fallback for deployed hosts that may not expose /health as expected
      if (service === 'dgraph' && response.status === 200) {
        const fallback = await this.dgraphClient.get('/governance/variables').catch(() => null);
        if (fallback?.data?.variables && Array.isArray(fallback.data.variables)) return true;
      }
      return false;
    } catch {
      // DGraph: try governance endpoint as fallback (e.g. gql.dlux.io behind proxy)
      if (service === 'dgraph') {
        try {
          const fallback = await this.dgraphClient.get('/governance/variables');
          if (fallback.status === 200 && fallback.data?.variables && Array.isArray(fallback.data.variables)) return true;
        } catch {
          // ignore
        }
      }
      return false;
    }
  }

  // Expose clients for direct access if needed
  get sui() { return this.suiClient; }
  get dgraph() { return this.dgraphClient; }
  get walrus() { return this.walrusClient; }
  get pm() { return this.pmClient; }
}

export const apiClient = new ApiClient();

/** True when running against deployed dlux.io or test.dlux.io (gql.dlux.io / sui.dlux.io / walrus.dlux.io). */
export function isDeployedDluxEnv(): boolean {
  const u = process.env.E2E_BASE_URL || process.env.DGRAPH_SERVICE_URL || process.env.SUI_SERVICE_URL || process.env.WALRUS_SERVICE_URL || '';
  return u.includes('dlux.io');
}
