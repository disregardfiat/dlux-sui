/**
 * E2E tests for Social flow: sign message → POST to DGraph
 * Tests: Create post with signature → Get feed
 *
 * Uses real Ed25519 signing when server has verifyPersonalMessageSignature.
 * Falls back to format-valid signature for servers with format-only verifier.
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

test.describe('Social Posts E2E Flow', () => {
  let postId: string;
  let keypair: Ed25519Keypair;

  test.beforeAll(async () => {
    const dgraphHealthy = await apiClient.checkHealth('dgraph');
    if (!dgraphHealthy) {
      test.skip(true, 'DGraph service not available (DGRAPH_SERVICE_URL)');
      return;
    }
    keypair = new Ed25519Keypair();
  });

  test('should create post with signed message', async () => {
    const author = keypair.toSuiAddress();
    const content = 'E2E test post ' + Date.now();
    const message = createSignableMessage('createPost', { author, content });
    const messageBytes = new TextEncoder().encode(message);
    const { signature } = await keypair.signPersonalMessage(messageBytes);

    const post = await apiClient.createPost({
      author,
      content,
      signature,
    });

    expect(post).toHaveProperty('id');
    expect(post.author).toBe(author);
    expect(post.content).toBe(content);
    postId = post.id;
  });

  test('should get feed and find post', async () => {
    const feed = await apiClient.getFeed({ limit: 20 });
    expect(feed).toHaveProperty('posts');
    expect(Array.isArray(feed.posts)).toBe(true);
    const found = feed.posts.find((p: { id: string }) => p.id === postId);
    expect(found).toBeDefined();
    expect(found?.content).toContain('E2E test post');
  });
});
