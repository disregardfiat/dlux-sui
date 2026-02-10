// Set env BEFORE any module imports so module-level const captures the right values
process.env.NODE_ENV = 'test';
process.env.SUI_PACKAGE_ID = '0xTEST';
process.env.ADMIN_CAP_OBJECT_ID = '0xADMIN';
process.env.REVENUE_POOL_OBJECT_ID = '0xPOOL';
process.env.CLOCK_OBJECT_ID = '0x6';
process.env.FOUNDATION_ADDRESS = '0xFOUNDATION';
process.env.PM_POOL_ADDRESS = '0xPM';
process.env.WALRUS_PROVIDER_ADDRESS = '0xWALRUS';
process.env.DGRAPH_SERVICE_URL = 'http://localhost:3003';
process.env.PM_SERVICE_URL = 'http://localhost:3004';
process.env.ZK_SERVICE_URL = 'http://localhost:3010';
// Ed25519 32-byte test key (base64). Required by getAdminKeypair().
process.env.ADMIN_PRIVATE_KEY = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';

import express from 'express';
import request from 'supertest';
import axios from 'axios';
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import adsRouter from '../src/routes/ads';

// Helper to cast mocked modules for TypeScript strictness
const mockAxiosGet = axios.get as jest.MockedFunction<typeof axios.get>;
const mockAxiosPost = axios.post as jest.MockedFunction<typeof axios.post>;

jest.mock('axios');

// Mock @mysten/sui/transactions Transaction class so the route can build tx without real SDK
jest.mock('@mysten/sui/transactions', () => {
  const mockPure: any = (jest.fn as any)().mockReturnValue('pure_arg');
  mockPure.address = (jest.fn as any)().mockReturnValue('addr_arg');
  mockPure.u64 = (jest.fn as any)().mockReturnValue('u64_arg');
  mockPure.bool = (jest.fn as any)().mockReturnValue('bool_arg');
  mockPure.vector = (jest.fn as any)().mockReturnValue('vec_arg');

  return {
    Transaction: (jest.fn as any)().mockImplementation(() => ({
      moveCall: (jest.fn as any)(),
      object: (jest.fn as any)().mockReturnValue('obj_arg'),
      pure: mockPure,
      splitCoins: (jest.fn as any)().mockReturnValue(['coin_arg']),
      gas: 'gas',
      setSender: (jest.fn as any)(),
      setGasBudget: (jest.fn as any)()
    }))
  };
});

// suiClient mock is provided by setup.ts (includes signAndExecuteTransaction etc.)
jest.mock('../src/repositories/dappRepository', () => ({
  dappRepository: {
    findById: (jest.fn as any)().mockResolvedValue({
      id: 'content1',
      owner: '0xCREATOR',
      name: 'Test DApp'
    })
  }
}));

const app = express();
app.use(express.json());
app.use('/ads', adsRouter);

/**
 * The /ads/walrus/drawdown route flow:
 * 1. dappRepository.findById(contentId) — mocked above
 * 2. axios.get PM_SERVICE_URL/markets/dapp/:contentId — PM status
 * 3. For each proof: axios.get DGRAPH/impressions/proof/:hash
 * 4. (optional) axios.get DGRAPH/impressions/merkle/:contentId — if merklePath present
 * 5. (optional) axios.post ZK_SERVICE/proofs/verify — ZK verify
 * 6. suiClient.signAndExecuteTransaction — mocked above
 * 7. axios.post DGRAPH/impressions/mark-walrus-drawdown-used
 */
describe('Walrus Drawdown Endpoint', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('verifies proofs and performs drawdown with PM active', async () => {
    // 1. PM check: active market
    mockAxiosGet.mockResolvedValueOnce({
      data: { markets: [{ status: 'open', id: 'mkt1' }] },
      status: 200, statusText: 'OK', headers: {}, config: {} as any
    });
    // 2. Proof check
    mockAxiosGet.mockResolvedValueOnce({
      data: {
        exists: true, verified: true, walrusDrawdownUsed: false,
        proofHash: 'hash1',
        merklePath: [['sibling1'], ['sibling2']],
        merkleIndex: 0
      },
      status: 200, statusText: 'OK', headers: {}, config: {} as any
    });
    // 3. Merkle root
    mockAxiosGet.mockResolvedValueOnce({
      data: { merkleRoot: '0xmerkle123' },
      status: 200, statusText: 'OK', headers: {}, config: {} as any
    });
    // 4. Merkle verify
    mockAxiosPost.mockResolvedValueOnce({
      data: { verified: true },
      status: 200, statusText: 'OK', headers: {}, config: {} as any
    });
    // 5. ZK verify
    mockAxiosPost.mockResolvedValueOnce({
      data: { valid: true },
      status: 200, statusText: 'OK', headers: {}, config: {} as any
    });
    // 6. Mark proofs as used
    mockAxiosPost.mockResolvedValueOnce({
      data: { success: true },
      status: 200, statusText: 'OK', headers: {}, config: {} as any
    });

    const res = await request(app)
      .post('/ads/walrus/drawdown')
      .send({
        contentId: 'content1',
        verifiedProofs: ['hash1'],
        amount: 100000000000,
        walrusProvider: '0xWALRUS'
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.verificationResults || res.body.verification?.results).toBeDefined();
    expect(res.body.split.walrusProvider.percentage).toBe(10);
    expect(res.body.split.foundation.percentage).toBe(9);
    expect(res.body.split.recipient.type).toBe('pm_pool');
    expect(res.body.split.recipient.percentage).toBe(81);
  });

  it('rejects drawdown with already-used proofs (double-spend prevention)', async () => {
    // PM check
    mockAxiosGet.mockResolvedValueOnce({
      data: { markets: [] },
      status: 200, statusText: 'OK', headers: {}, config: {} as any
    });
    // Proof check: already used
    mockAxiosGet.mockResolvedValueOnce({
      data: { exists: true, verified: true, walrusDrawdownUsed: true, proofHash: 'hash1' },
      status: 200, statusText: 'OK', headers: {}, config: {} as any
    });

    const res = await request(app)
      .post('/ads/walrus/drawdown')
      .send({
        contentId: 'content1',
        verifiedProofs: ['hash1'],
        amount: 100000000000
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('already used');
  });

  it('rejects drawdown with unverified proofs', async () => {
    // PM check
    mockAxiosGet.mockResolvedValueOnce({
      data: { markets: [] },
      status: 200, statusText: 'OK', headers: {}, config: {} as any
    });
    // Proof check: not verified
    mockAxiosGet.mockResolvedValueOnce({
      data: { exists: true, verified: false, walrusDrawdownUsed: false, proofHash: 'hash1' },
      status: 200, statusText: 'OK', headers: {}, config: {} as any
    });

    const res = await request(app)
      .post('/ads/walrus/drawdown')
      .send({
        contentId: 'content1',
        verifiedProofs: ['hash1'],
        amount: 100000000000
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('not verified');
  });

  it('rejects drawdown with non-existent proofs', async () => {
    // PM check
    mockAxiosGet.mockResolvedValueOnce({
      data: { markets: [] },
      status: 200, statusText: 'OK', headers: {}, config: {} as any
    });
    // Proof check: not found
    mockAxiosGet.mockResolvedValueOnce({
      data: { exists: false },
      status: 200, statusText: 'OK', headers: {}, config: {} as any
    });

    const res = await request(app)
      .post('/ads/walrus/drawdown')
      .send({
        contentId: 'content1',
        verifiedProofs: ['nonexistent'],
        amount: 100000000000
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('not found');
  });

  it('performs drawdown with PM passed (creator receives 81%)', async () => {
    // PM check: resolved safe (passed)
    mockAxiosGet.mockResolvedValueOnce({
      data: { markets: [{ status: 'resolved', resolution: 'safe', id: 'mkt1' }] },
      status: 200, statusText: 'OK', headers: {}, config: {} as any
    });
    // Proof check
    mockAxiosGet.mockResolvedValueOnce({
      data: { exists: true, verified: true, walrusDrawdownUsed: false, proofHash: 'hash2' },
      status: 200, statusText: 'OK', headers: {}, config: {} as any
    });
    // ZK verify
    mockAxiosPost.mockResolvedValueOnce({
      data: { valid: true },
      status: 200, statusText: 'OK', headers: {}, config: {} as any
    });
    // Mark used
    mockAxiosPost.mockResolvedValueOnce({
      data: { success: true },
      status: 200, statusText: 'OK', headers: {}, config: {} as any
    });

    const res = await request(app)
      .post('/ads/walrus/drawdown')
      .send({
        contentId: 'content1',
        verifiedProofs: ['hash2'],
        amount: 100000000000
      });

    expect(res.status).toBe(200);
    expect(res.body.split.recipient.type).toBe('creator');
    expect(res.body.split.recipient.percentage).toBe(81);
  });

  it('verifies Merkle proofs when available', async () => {
    // PM check
    mockAxiosGet.mockResolvedValueOnce({
      data: { markets: [] },
      status: 200, statusText: 'OK', headers: {}, config: {} as any
    });
    // Proof check with merkle data
    mockAxiosGet.mockResolvedValueOnce({
      data: {
        exists: true, verified: true, walrusDrawdownUsed: false,
        proofHash: 'hash3',
        merklePath: [['sibling1'], ['sibling2']],
        merkleIndex: 0
      },
      status: 200, statusText: 'OK', headers: {}, config: {} as any
    });
    // Merkle root
    mockAxiosGet.mockResolvedValueOnce({
      data: { merkleRoot: '0xmerkle456' },
      status: 200, statusText: 'OK', headers: {}, config: {} as any
    });
    // Merkle verify
    mockAxiosPost.mockResolvedValueOnce({
      data: { verified: true },
      status: 200, statusText: 'OK', headers: {}, config: {} as any
    });
    // ZK verify
    mockAxiosPost.mockResolvedValueOnce({
      data: { valid: true },
      status: 200, statusText: 'OK', headers: {}, config: {} as any
    });
    // Mark used
    mockAxiosPost.mockResolvedValueOnce({
      data: { success: true },
      status: 200, statusText: 'OK', headers: {}, config: {} as any
    });

    const res = await request(app)
      .post('/ads/walrus/drawdown')
      .send({
        contentId: 'content1',
        verifiedProofs: ['hash3'],
        amount: 100000000000
      });

    expect(res.status).toBe(200);
    const results = res.body.verification?.results || res.body.verificationResults;
    expect(results).toBeDefined();
    expect(results[0].merkleVerified).toBe(true);
  });

  it('verifies ZK proofs via ZK service', async () => {
    // PM check
    mockAxiosGet.mockResolvedValueOnce({
      data: { markets: [] },
      status: 200, statusText: 'OK', headers: {}, config: {} as any
    });
    // Proof check
    mockAxiosGet.mockResolvedValueOnce({
      data: { exists: true, verified: true, walrusDrawdownUsed: false, proofHash: 'hash4' },
      status: 200, statusText: 'OK', headers: {}, config: {} as any
    });
    // ZK verify
    mockAxiosPost.mockResolvedValueOnce({
      data: { valid: true },
      status: 200, statusText: 'OK', headers: {}, config: {} as any
    });
    // Mark used
    mockAxiosPost.mockResolvedValueOnce({
      data: { success: true },
      status: 200, statusText: 'OK', headers: {}, config: {} as any
    });

    const res = await request(app)
      .post('/ads/walrus/drawdown')
      .send({
        contentId: 'content1',
        verifiedProofs: ['hash4'],
        amount: 100000000000
      });

    expect(res.status).toBe(200);
    expect(axios.post).toHaveBeenCalledWith(
      expect.stringContaining('/proofs/verify'),
      expect.objectContaining({ proofHash: 'hash4', contentId: 'content1' }),
      expect.any(Object)
    );
    const results = res.body.verification?.results || res.body.verificationResults;
    expect(results).toBeDefined();
    expect(results[0].zkVerified).toBe(true);
  });

  it('marks proofs as used after successful transaction', async () => {
    // PM check
    mockAxiosGet.mockResolvedValueOnce({
      data: { markets: [] },
      status: 200, statusText: 'OK', headers: {}, config: {} as any
    });
    // Proof check
    mockAxiosGet.mockResolvedValueOnce({
      data: { exists: true, verified: true, walrusDrawdownUsed: false, proofHash: 'hash5' },
      status: 200, statusText: 'OK', headers: {}, config: {} as any
    });
    // ZK verify
    mockAxiosPost.mockResolvedValueOnce({
      data: { valid: true },
      status: 200, statusText: 'OK', headers: {}, config: {} as any
    });
    // Mark used
    mockAxiosPost.mockResolvedValueOnce({
      data: { success: true },
      status: 200, statusText: 'OK', headers: {}, config: {} as any
    });

    const res = await request(app)
      .post('/ads/walrus/drawdown')
      .send({
        contentId: 'content1',
        verifiedProofs: ['hash5'],
        amount: 100000000000
      });

    expect(res.status).toBe(200);
    expect(axios.post).toHaveBeenCalledWith(
      expect.stringContaining('/mark-walrus-drawdown-used'),
      expect.objectContaining({ proofHashes: ['hash5'] }),
      expect.any(Object)
    );
  });

  it('rejects missing required fields', async () => {
    const res = await request(app)
      .post('/ads/walrus/drawdown')
      .send({
        contentId: 'content1'
        // Missing verifiedProofs and amount
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Missing required fields');
  });

  it('rejects invalid amount (zero)', async () => {
    // PM check
    mockAxiosGet.mockResolvedValueOnce({
      data: { markets: [] },
      status: 200, statusText: 'OK', headers: {}, config: {} as any
    });

    const res = await request(app)
      .post('/ads/walrus/drawdown')
      .send({
        contentId: 'content1',
        verifiedProofs: ['hash1'],
        amount: 0
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('amount');
  });
});
