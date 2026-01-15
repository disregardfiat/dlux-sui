/**
 * Test setup for SUI service
 */

import { jest } from '@jest/globals';

// Set test environment
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key';
process.env.SUI_NETWORK = 'testnet';

// Mock SUI client
jest.mock('../src/sui/client', () => ({
  suiClient: {
    getObject: jest.fn(),
    getTransactionBlock: jest.fn(),
  }
}));

// Global test timeout
jest.setTimeout(10000);
