/**
 * Test setup for SUI service
 */

import { jest } from '@jest/globals';

// Set test environment
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key';
process.env.SUI_NETWORK = 'testnet';

// Mock SUI client — includes all methods used across test suites
// (billing uses getTransactionBlock/queryTransactionBlocks;
//  walrus-drawdown uses signAndExecuteTransaction/executeTransactionBlock)
jest.mock('../src/sui/client', () => {
  const mockTx = {
    digest: '0x' + 'a'.repeat(64),
    balanceChanges: [],
    errors: [] as string[]
  };
  const mockQuery = { data: [] as { digest: string; timestampMs: string | null }[] };
  return {
    suiClient: {
      connect: jest.fn(),
      getClient: jest.fn(() => ({
        getTransactionBlock: jest.fn(() => Promise.resolve(mockTx)),
        queryTransactionBlocks: jest.fn(() => Promise.resolve(mockQuery)),
        getObject: jest.fn(() => Promise.resolve(null)),
        getReferenceGasPrice: jest.fn(() => Promise.resolve({ gasPrice: '1000' })),
        dryRunTransactionBlock: jest.fn(() => Promise.resolve({ effects: { status: { status: 'success' } } })),
        signAndExecuteTransaction: jest.fn(() => Promise.resolve({ digest: '0xTX', effects: { status: { status: 'success' } } })),
        executeTransactionBlock: jest.fn(() => Promise.resolve({ digest: '0xTX' }))
      })),
      getObject: jest.fn(),
      getTransactionBlock: jest.fn()
    }
  };
});

// Global test timeout
jest.setTimeout(10000);
