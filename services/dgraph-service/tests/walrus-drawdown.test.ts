import express from 'express';
import request from 'supertest';
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import impressionsRouter from '../src/routes/impressions';
import { impressionRepository } from '../src/repositories/impressionRepository';

process.env.NODE_ENV = 'test';

// Mock DGraph client for testing
jest.mock('../src/dgraph/client', () => {
  const fn = jest.fn;
  const txn = {
    query: (fn as any)().mockResolvedValue({ getJson: () => ({}) }),
    mutate: (fn as any)().mockResolvedValue({}),
    commit: (fn as any)().mockResolvedValue({}),
    discard: (fn as any)()
  };
  return {
    dgraphClient: {
      newTxn: (fn as any)().mockReturnValue(txn)
    }
  };
});

const app = express();
app.use(express.json());
app.use('/impressions', impressionsRouter);

describe('Walrus Drawdown Proof Tracking', () => {
  beforeEach(() => {
    impressionRepository.clearTestData();
  });

  it('marks proofs as used in Walrus drawdown', async () => {
    // Create test impressions
    const impression1 = await impressionRepository.saveImpression({
      adId: 'ad1',
      contentId: 'content1',
      zkProof: JSON.stringify({ proof: { a: 1 } }),
      proofHash: 'hash1',
      encryptedViewer: 'enc1',
      blockHeader: 'block1',
      verified: true,
      walrusDrawdownUsed: false
    });

    const impression2 = await impressionRepository.saveImpression({
      adId: 'ad1',
      contentId: 'content1',
      zkProof: JSON.stringify({ proof: { a: 2 } }),
      proofHash: 'hash2',
      encryptedViewer: 'enc2',
      blockHeader: 'block2',
      verified: true,
      walrusDrawdownUsed: false
    });

    // Mark proofs as used
    const markRes = await request(app)
      .post('/impressions/mark-walrus-drawdown-used')
      .send({ proofHashes: ['hash1', 'hash2'] });

    expect(markRes.status).toBe(200);
    expect(markRes.body.success).toBe(true);
    expect(markRes.body.count).toBe(2);

    // Verify proofs are marked as used
    const proof1 = await impressionRepository.findByProofHash('hash1');
    const proof2 = await impressionRepository.findByProofHash('hash2');

    expect(proof1?.walrusDrawdownUsed).toBe(true);
    expect(proof1?.walrusDrawdownUsedAt).toBeDefined();
    expect(proof2?.walrusDrawdownUsed).toBe(true);
    expect(proof2?.walrusDrawdownUsedAt).toBeDefined();
  });

  it('prevents double-spend by rejecting already-used proofs', async () => {
    // Create and mark a proof as used
    await impressionRepository.saveImpression({
      adId: 'ad2',
      contentId: 'content2',
      zkProof: JSON.stringify({ proof: { a: 3 } }),
      proofHash: 'hash3',
      encryptedViewer: 'enc3',
      blockHeader: 'block3',
      verified: true,
      walrusDrawdownUsed: false
    });

    await impressionRepository.markWalrusDrawdownUsed(['hash3']);

    // Try to use the same proof again
    const markRes = await request(app)
      .post('/impressions/mark-walrus-drawdown-used')
      .send({ proofHashes: ['hash3'] });

    expect(markRes.status).toBe(400);
    expect(markRes.body.error).toContain('already used');
    expect(markRes.body.used).toContain('hash3');
  });

  it('returns proof data with Merkle path for verification', async () => {
    // Create impression with Merkle data
    await impressionRepository.saveImpression({
      adId: 'ad3',
      contentId: 'content3',
      zkProof: JSON.stringify({ proof: { a: 4 } }),
      proofHash: 'hash4',
      encryptedViewer: 'enc4',
      blockHeader: 'block4',
      verified: true,
      merklePath: JSON.stringify([['sibling1'], ['sibling2']]),
      merkleIndex: 0,
      walrusDrawdownUsed: false
    });

    const proofRes = await request(app).get('/impressions/proof/hash4');

    expect(proofRes.status).toBe(200);
    expect(proofRes.body.exists).toBe(true);
    expect(proofRes.body.verified).toBe(true);
    expect(proofRes.body.walrusDrawdownUsed).toBe(false);
    expect(proofRes.body.proofHash).toBe('hash4');
    expect(proofRes.body.merklePath).toBeDefined();
    expect(proofRes.body.merkleIndex).toBe(0);
  });

  it('returns 404 for non-existent proof hash', async () => {
    const proofRes = await request(app).get('/impressions/proof/nonexistent');

    expect(proofRes.status).toBe(404);
    expect(proofRes.body.error).toBe('Proof not found');
  });

  it('checks batch of proofs for usage status', async () => {
    // Create multiple impressions
    await impressionRepository.saveImpression({
      adId: 'ad4',
      contentId: 'content4',
      zkProof: JSON.stringify({ proof: { a: 5 } }),
      proofHash: 'hash5',
      encryptedViewer: 'enc5',
      blockHeader: 'block5',
      verified: true,
      walrusDrawdownUsed: false
    });

    await impressionRepository.saveImpression({
      adId: 'ad4',
      contentId: 'content4',
      zkProof: JSON.stringify({ proof: { a: 6 } }),
      proofHash: 'hash6',
      encryptedViewer: 'enc6',
      blockHeader: 'block6',
      verified: true,
      walrusDrawdownUsed: false
    });

    // Mark one as used
    await impressionRepository.markWalrusDrawdownUsed(['hash5']);

    // Check batch
    const { used, unused } = await impressionRepository.checkWalrusDrawdownUsed(['hash5', 'hash6', 'hash7']);

    expect(used).toContain('hash5');
    expect(unused).toContain('hash6');
    expect(unused).toContain('hash7');
    expect(used.length).toBe(1);
    expect(unused.length).toBe(2);
  });

  it('rejects empty proofHashes array', async () => {
    const markRes = await request(app)
      .post('/impressions/mark-walrus-drawdown-used')
      .send({ proofHashes: [] });

    expect(markRes.status).toBe(400);
    expect(markRes.body.error).toContain('proofHashes');
  });

  it('rejects invalid request body', async () => {
    const markRes = await request(app)
      .post('/impressions/mark-walrus-drawdown-used')
      .send({});

    expect(markRes.status).toBe(400);
    expect(markRes.body.error).toContain('proofHashes');
  });
});
