import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useSuiWallet } from '../useSuiWallet';

function createStandardWallet() {
  return {
    id: 'test-wallet',
    name: 'Test Wallet',
    features: {
      'standard:connect': {
        connect: vi.fn().mockResolvedValue({
          accounts: [{ address: '0xabc' }]
        })
      },
      'standard:events': {
        on: vi.fn().mockReturnValue(() => {})
      },
      'sui:signPersonalMessage': {
        signPersonalMessage: vi.fn().mockResolvedValue({
          signature: 'sig-message'
        })
      },
      'sui:signTransactionBlock': {
        signTransactionBlock: vi.fn().mockResolvedValue({
          signature: 'sig-tx'
        })
      },
      'sui:signAndExecuteTransactionBlock': {
        signAndExecuteTransactionBlock: vi.fn().mockResolvedValue({
          digest: 'tx-digest'
        })
      }
    }
  };
}

vi.mock('@mysten/wallet-standard', () => {
  const testAccount = { address: '0xabc', chains: [], features: [], publicKey: new Uint8Array(0) };
  const wallet = {
    id: 'test-wallet',
    name: 'Test Wallet',
    accounts: [testAccount],
    features: {
      'standard:connect': {
        connect: vi.fn().mockResolvedValue({ accounts: [testAccount] })
      },
      'standard:events': { on: vi.fn().mockReturnValue(() => {}) },
      'sui:signPersonalMessage': {
        signPersonalMessage: vi.fn().mockResolvedValue({ signature: 'sig-message' })
      },
      'sui:signTransactionBlock': {
        signTransactionBlock: vi.fn().mockResolvedValue({ signature: 'sig-tx' })
      },
      'sui:signAndExecuteTransactionBlock': {
        signAndExecuteTransactionBlock: vi.fn().mockResolvedValue({ digest: 'tx-digest' })
      }
    }
  };
  return {
    getWallets: () => ({
      get: () => [wallet],
      on: () => () => {}
    }),
    isWalletWithRequiredFeatureSet: () => true
  };
});

function ensureBrowserLikeGlobals() {
  const globalAny = globalThis as any;

  if (!globalAny.window) {
    globalAny.window = globalThis as any;
  }

  if (!globalAny.localStorage) {
    let store: Record<string, string> = {};
    globalAny.localStorage = {
      getItem: (key: string) => (key in store ? store[key] : null),
      setItem: (key: string, value: string) => {
        store[key] = String(value);
      },
      removeItem: (key: string) => {
        delete store[key];
      },
      clear: () => {
        store = {};
      }
    };
  }

  if (!globalAny.atob) {
    globalAny.atob = (input: string) => Buffer.from(input, 'base64').toString('binary');
  }
}

describe('useSuiWallet', () => {
  beforeEach(() => {
    ensureBrowserLikeGlobals();
    localStorage.clear();
    (window as any).slush = undefined;
    (window as any).suiWallet = undefined;
  });

  it('lists wallets from wallet standard', () => {
    const { wallets } = useSuiWallet();
    expect(wallets.value.length).toBe(1);
    expect(wallets.value[0].name).toBe('Test Wallet');
  });

  it('connects and stores active wallet', async () => {
    const { connectWallet } = useSuiWallet();
    const accounts = await connectWallet();
    expect(accounts[0].address).toBe('0xabc');
    expect(localStorage.getItem('dlux_active_wallet')).toBe('test-wallet');
  });

  it('signs personal messages', async () => {
    const { signMessage } = useSuiWallet();
    const signature = await signMessage('hello');
    expect(signature).toBe('sig-message');
  });

  it('signs transaction blocks', async () => {
    const { signTransactionBlock } = useSuiWallet();
    const signature = await signTransactionBlock('0x01');
    expect(signature).toBe('sig-tx');
  });

  it('signs and executes transaction blocks', async () => {
    const { signAndExecuteTransactionBlock } = useSuiWallet();
    const result = await signAndExecuteTransactionBlock('0x02', { showEffects: true }, 'WaitForEffectsCert');
    expect(result).toEqual({ digest: 'tx-digest' });
  });
});
