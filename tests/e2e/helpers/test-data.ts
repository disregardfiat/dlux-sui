/**
 * Test data factories for E2E tests
 */

function randomHex(length: number): string {
  return '0x' + Array.from({ length }, () => 
    Math.floor(Math.random() * 16).toString(16)
  ).join('');
}

function randomString(length: number): string {
  return Array.from({ length }, () => 
    String.fromCharCode(97 + Math.floor(Math.random() * 26))
  ).join('');
}

export const testData = {
  advertiser: () => randomHex(40),
  
  campaign: (overrides?: any) => ({
    advertiser: randomHex(40),
    title: `Test Campaign ${randomString(8)}`,
    description: 'Test campaign description',
    targetUrl: 'https://example.com',
    placements: ['gate'],
    bid: 0.01,
    totalBudget: 1.0,
    ...overrides,
  }),

  impression: (overrides?: any) => ({
    adId: randomString(32),
    contentId: `dapp_${randomString(16)}`,
    zkProof: {
      proof: { a: [randomHex(64), randomHex(64)], b: [[randomHex(64), randomHex(64)], [randomHex(64), randomHex(64)]], c: [randomHex(64), randomHex(64)] },
      publicSignals: [randomHex(64), randomHex(64)],
    },
    proofHash: randomHex(64),
    encryptedViewer: `enc_${randomString(32)}`,
    blockHeader: randomHex(64),
    ...overrides,
  }),

  clickToken: () => randomHex(64),
};
