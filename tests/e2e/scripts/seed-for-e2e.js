#!/usr/bin/env node
/**
 * Minimal E2E seed: create one dApp so browser specs that need "dApps in hub" can pass.
 * Run after SUI service is up: SUI_SERVICE_URL=http://localhost:3001 node tests/e2e/scripts/seed-for-e2e.js
 */

const SUI_SERVICE_URL = process.env.SUI_SERVICE_URL || 'http://localhost:3001';

const owner = '0x' + 'a'.repeat(64);
const permlink = 'e2e-seed-dapp-' + Date.now();
const name = 'E2E Seed dApp';
const description = 'Created by seed-for-e2e.js for browser E2E.';

async function main() {
  try {
    const res = await fetch(`${SUI_SERVICE_URL}/dapps`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        description,
        owner,
        permlink,
        blobIds: [],
        manifest: { entryPoint: '/index.html' },
        tags: ['e2e', 'seed'],
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`POST /dapps failed: ${res.status} ${text}`);
    }
    const data = await res.json();
    console.log('Seed dApp created:', data.id || data.permlink || permlink);
  } catch (e) {
    console.error('Seed failed:', e.message);
    process.exit(1);
  }
}

main();
