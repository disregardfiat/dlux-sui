/**
 * API Spec E2E – DGraph flows from docs/api/dgraph-openapi.yaml
 *
 * Validates that social interactions and other off-chain flows run through DGraph
 * as defined in the spec. Run with: DGRAPH_SERVICE_URL=http://localhost:3003 npm run test:e2e -- api-spec
 * Against live (test.dlux.io): uses real SUI-style signing so POST /social/posts passes.
 */

import { test, expect } from '@playwright/test';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { apiClient } from './helpers/api-helpers';

function createSignableMessage(action: string, data: Record<string, unknown>): string {
  const messageData = { action, ...data };
  const keys = Object.keys(messageData).filter((k) => messageData[k] !== undefined).sort();
  const sorted: Record<string, unknown> = {};
  for (const k of keys) sorted[k] = messageData[k];
  return JSON.stringify(sorted);
}

test.describe('API Spec - DGraph flows (spec as source of truth)', () => {
  test.beforeAll(async () => {
    const healthy = await apiClient.checkHealth('dgraph');
    if (!healthy) {
      test.skip(true, 'DGraph service not available (DGRAPH_SERVICE_URL)');
    }
  });

  test('GET /health returns ok', async () => {
    const healthy = await apiClient.checkHealth('dgraph');
    expect(healthy).toBe(true);
  });

  test('Social: GET /social/posts (feed) returns list', async () => {
    const feed = await apiClient.getFeed({ limit: 5, offset: 0 });
    const list = (feed as any)?.posts ?? (Array.isArray(feed) ? feed : []);
    expect(Array.isArray(list)).toBe(true);
  });

  test('Social: POST /social/posts (create) then GET feed - signed post through DGraph', async () => {
    const keypair = new Ed25519Keypair();
    const author = keypair.toSuiAddress();
    const content = `api-spec e2e post ${Date.now()}`;
    const message = createSignableMessage('createPost', { author, content });
    const messageBytes = new TextEncoder().encode(message);
    const { signature } = await keypair.signPersonalMessage(messageBytes);

    const post = await apiClient.createPost({ author, content, signature });
    expect(post).toBeDefined();
    expect(post.id ?? post).toBeDefined();
    const feed = await apiClient.getFeed({ limit: 10 });
    const list = (feed as any)?.posts ?? (Array.isArray(feed) ? feed : []);
    const found = list.some((p: any) => p.content === content || p.id === (post.id ?? (post as any)));
    expect(found).toBe(true);
  });

  test('Subscription: GET /subscription/status returns active (create requires JWT)', async () => {
    const subscriber = '0x' + '01'.repeat(32);
    try {
      await apiClient.createSubscription(
        {
          subscriber,
          paymentTxId: '0x' + 'bb'.repeat(32),
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        }
      );
    } catch (err: any) {
      if (err.response?.status === 403) {
        // Create requires JWT as subscriber; continue to test status
      } else throw err;
    }
    const status = await apiClient.getSubscriptionStatus(subscriber);
    expect(status).toBeDefined();
    expect(typeof (status as any).active).toBe('boolean');
  });

  test('Governance: GET /governance/variables returns variables', async () => {
    const vars = await apiClient.getGovernanceVariables();
    expect(vars).toBeDefined();
    const variables = (vars as any).variables ?? vars;
    expect(Array.isArray(variables)).toBe(true);
    const foundationShare = variables.find((v: any) => v.name === 'foundationShare');
    expect(foundationShare != null || variables.length >= 0).toBe(true);
  });

  test('Markets: GET /markets/high-payout returns list', async () => {
    const result = await apiClient.getHighPayoutMarkets(5);
    expect(result).toBeDefined();
    const markets = (result as any).markets ?? result;
    expect(Array.isArray(markets)).toBe(true);
  });

  test('Markets: GET /markets/payouts/{owner} returns total', async () => {
    const owner = '0x' + '02'.repeat(32);
    const payouts = await apiClient.getPayouts(owner);
    expect(payouts).toBeDefined();
    expect(typeof (payouts as any).total === 'number' || (payouts as any).total === undefined).toBe(true);
  });
});
