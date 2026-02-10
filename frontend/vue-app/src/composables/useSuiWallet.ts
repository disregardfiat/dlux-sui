import { computed, ref, shallowRef } from 'vue';
import { getWallets, isWalletWithRequiredFeatureSet } from '@mysten/wallet-standard';
import { SuiClient } from '@mysten/sui/client';
import { toBase64 } from '@mysten/sui/utils';
import { SUI_CHAIN_ID } from '@/config/links';

// RPC URL from env, with network-specific defaults
const getDefaultRPC = (): string => {
  const envRpc = (import.meta as any).env?.VITE_SUI_RPC_URL;
  if (envRpc) return envRpc;
  
  // Check if we're on mainnet by checking package ID or other indicators
  const packageId = (import.meta as any).env?.VITE_SUI_PACKAGE_ID || '';
  const isMainnet = packageId && !packageId.includes('testnet');
  
  // Default to mainnet if package ID suggests mainnet, otherwise testnet
  return isMainnet 
    ? 'https://fullnode.mainnet.sui.io:443'
    : 'https://fullnode.testnet.sui.io:443';
};

const DEFAULT_RPC = getDefaultRPC();
let lazySuiClient: SuiClient | null = null;
function getLazySuiClient(): SuiClient {
  if (!lazySuiClient) lazySuiClient = new SuiClient({ url: DEFAULT_RPC });
  return lazySuiClient;
}

export type WalletEntry = {
  key: string;
  name: string;
  provider: any;
};

type WalletAccount = {
  address: string;
};

const ACTIVE_WALLET_KEY = 'dlux_active_wallet';
const activeWallet = ref<WalletEntry | null>(null);

/** Raw account objects from the last connect(), so we pass the wallet's own reference to signPersonalMessage. */
const lastConnectRawAccountsByKey = new Map<string, unknown[]>();

// Reactive list so we can update when wallets register (e.g. Slush after app-ready).
const standardWalletEntries = shallowRef<WalletEntry[]>([]);
let walletStandardInitialized = false;

function refreshStandardWallets() {
  try {
    const walletsApi = getWallets();
    const all = walletsApi.get();
    const sui = all.filter((w) => isWalletWithRequiredFeatureSet(w));
    standardWalletEntries.value = sui.map((wallet) => ({
      key: wallet.id ?? wallet.name,
      name: wallet.name,
      provider: wallet
    }));
  } catch {
    standardWalletEntries.value = [];
  }
}

function initWalletStandardOnce() {
  if (walletStandardInitialized || typeof window === 'undefined') return;
  walletStandardInitialized = true;
  try {
    const walletsApi = getWallets();
    refreshStandardWallets();
    walletsApi.on('register', () => refreshStandardWallets());
    walletsApi.on('unregister', () => refreshStandardWallets());
  } catch (e) {
    console.warn('Wallet Standard init failed', e);
  }
}

const buildWalletEntries = (): WalletEntry[] => {
  initWalletStandardOnce();
  const entries: WalletEntry[] = [...standardWalletEntries.value];
  const globalAny = typeof window !== 'undefined' ? (window as any) : {};

  const fallbackWallets: Array<{ key: string; name: string; provider: any }> = [
    { key: 'slush', name: 'Slush', provider: globalAny.slush || globalAny.slushWallet },
    { key: 'sui-wallet', name: 'Sui Wallet', provider: globalAny.suiWallet || globalAny.SuiWallet || globalAny.sui }
  ];

  fallbackWallets.forEach((wallet) => {
    if (wallet.provider && !entries.some((e) => e.key === wallet.key)) {
      entries.push(wallet);
    }
  });

  const deduped = new Map<string, WalletEntry>();
  entries.forEach((entry) => deduped.set(entry.key, entry));
  return Array.from(deduped.values());
};

const restoreActiveWallet = (): WalletEntry | null => {
  if (activeWallet.value?.provider) {
    return activeWallet.value;
  }

  const storedKey = localStorage.getItem(ACTIVE_WALLET_KEY);
  if (!storedKey) {
    return null;
  }

  const available = buildWalletEntries();
  const match = available.find((wallet) => wallet.key === storedKey);
  if (match) {
    activeWallet.value = match;
    return match;
  }

  localStorage.removeItem(ACTIVE_WALLET_KEY);
  return null;
};

const setActiveWallet = (wallet: WalletEntry | null) => {
  activeWallet.value = wallet;
  if (wallet) {
    localStorage.setItem(ACTIVE_WALLET_KEY, wallet.key);
  } else {
    localStorage.removeItem(ACTIVE_WALLET_KEY);
  }
};

const ensureWallet = (wallet?: WalletEntry | null): WalletEntry => {
  const resolved = wallet || restoreActiveWallet() || buildWalletEntries()[0];
  if (!resolved?.provider) {
    throw new Error('No Sui wallet detected.');
  }
  return resolved;
};

const normalizeSignature = (result: any): string => {
  if (typeof result === 'string') return result;
  if (result?.signature) return result.signature;
  if (result?.signatureBytes) return result.signatureBytes;
  if (result?.bytes) return result.bytes;
  if (result?.signature?.signature) return result.signature.signature;
  throw new Error('Unable to parse wallet signature response');
};

const toUint8Array = (input: Uint8Array | string): Uint8Array => {
  if (input instanceof Uint8Array) return input;

  if (input.startsWith('0x')) {
    const hex = input.slice(2);
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
    }
    return bytes;
  }

  try {
    const binary = atob(input);
    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
  } catch {
    return new TextEncoder().encode(input);
  }
};

export function useSuiWallet() {
  const wallets = computed(() => buildWalletEntries());

  const connectWallet = async (wallet?: WalletEntry): Promise<WalletAccount[]> => {
    const resolved = ensureWallet(wallet);
    const provider = resolved.provider;
    let rawAccounts: readonly unknown[] = [];

    if (provider?.features?.['standard:connect']?.connect) {
      const result = await provider.features['standard:connect'].connect();
      rawAccounts = result?.accounts ?? [];
    } else if (provider?.connect) {
      const result = await provider.connect();
      const r = result?.accounts ?? result;
      rawAccounts = Array.isArray(r) ? r : [];
    } else if (provider?.request) {
      const result = await provider.request({ method: 'connect' });
      rawAccounts = result?.accounts ?? [];
    }

    const rawList = rawAccounts.filter((a) => a != null && typeof a === 'object');
    lastConnectRawAccountsByKey.set(resolved.key, [...rawList]);

    const accounts: WalletAccount[] = rawList
      .map((a) => {
        const addr =
          typeof (a as { address?: string }).address === 'string'
            ? (a as { address: string }).address
            : typeof (a as { suiAddress?: string }).suiAddress === 'string'
              ? (a as { suiAddress: string }).suiAddress
              : '';
        return { address: addr };
      })
      .filter((a) => a.address.length > 0);

    if (!accounts.length) {
      throw new Error('No accounts returned from wallet.');
    }

    setActiveWallet(resolved);
    return accounts;
  };

  const signMessage = async (
    message: string | Uint8Array,
    wallet?: WalletEntry,
    accountAddress?: string
  ): Promise<string> => {
    const resolved = ensureWallet(wallet);
    const provider = resolved.provider;
    const encoded = typeof message === 'string' ? new TextEncoder().encode(message) : message;

    const isPrivateConnectError = (e: any) => {
      const msg = String(e?.message ?? '');
      return msg.includes('private member') || msg.includes('#connect');
    };

    let signFn: ((input: any) => Promise<any>) | null = null;
    try {
      signFn = provider?.features?.['sui:signPersonalMessage']?.signPersonalMessage ?? null;
    } catch (e) {
      if (isPrivateConnectError(e)) {
        throw new Error('Wallet connection issue. Try disconnecting and reconnecting your wallet.');
      }
      throw e;
    }

    if (signFn) {
      const getAddr = (a: unknown) =>
        a != null && typeof a === 'object'
          ? (a as { address?: string }).address ?? (a as { suiAddress?: string }).suiAddress
          : undefined;
      const addrEq = (a: string | undefined, b: string | undefined) =>
        !!a && !!b && a.toLowerCase() === b.toLowerCase();

      const resolveRawAccount = (): unknown => {
        let fromProvider: readonly unknown[] = [];
        try {
          fromProvider = (provider as { accounts?: readonly unknown[] }).accounts ?? [];
        } catch (e) {
          if (isPrivateConnectError(e)) {
            throw new Error('Wallet connection issue. Try disconnecting and reconnecting your wallet.');
          }
          throw e;
        }
        let raw: unknown = undefined;
        if (accountAddress) {
          raw = fromProvider.find((a) => addrEq(getAddr(a), accountAddress));
        }
        if (raw == null && fromProvider.length > 0) {
          raw = fromProvider[0];
        }
        if (raw == null) {
          const stored = lastConnectRawAccountsByKey.get(resolved.key) ?? [];
          if (accountAddress) {
            raw = stored.find((a) => addrEq(getAddr(a), accountAddress));
          }
          if (raw == null && stored.length > 0) {
            raw = stored[0];
          }
        }
        return raw;
      };

      let rawAccount: unknown;
      try {
        rawAccount = resolveRawAccount();
      } catch (e) {
        if (isPrivateConnectError(e)) {
          throw new Error('Wallet connection issue. Try disconnecting and reconnecting your wallet.');
        }
        throw e;
      }
      if (rawAccount == null) {
        try {
          await connectWallet(resolved);
          rawAccount = resolveRawAccount();
        } catch (e) {
          if (isPrivateConnectError(e)) {
            throw new Error('Wallet connection issue. Try disconnecting and reconnecting your wallet.');
          }
          // connectWallet failed (e.g. user cancelled)
        }
      }
      if (rawAccount == null) {
        throw new Error('No account available for signing. Connect the wallet first and select the account you want to use.');
      }
      try {
        const result = await signFn({
          message: encoded,
          account: rawAccount as { address: string; publicKey?: Uint8Array; chains?: unknown[]; features?: unknown[] }
        });
        return normalizeSignature(result);
      } catch (e) {
        if (isPrivateConnectError(e)) {
          throw new Error('Wallet connection issue. Try disconnecting and reconnecting your wallet.');
        }
        throw e;
      }
    }

    try {
      if (provider?.signPersonalMessage) {
        const result = await provider.signPersonalMessage({ message: encoded });
        return normalizeSignature(result);
      }
      if (provider?.signMessage) {
        const result = await provider.signMessage({ message: encoded });
        return normalizeSignature(result);
      }
      if (provider?.request) {
        const result = await provider.request({
          method: 'sui_signPersonalMessage',
          params: { message: Array.from(encoded) }
        });
        return normalizeSignature(result);
      }
    } catch (e) {
      if (isPrivateConnectError(e)) {
        throw new Error('Wallet connection issue. Try disconnecting and reconnecting your wallet.');
      }
      throw e;
    }

    throw new Error('Wallet does not support personal message signing');
  };

  /**
   * Get the wallet's current account address (the one that would be used for signing).
   * Use this so the app can use "whatever account the wallet has selected" as the author.
   */
  const getCurrentAddress = async (wallet?: WalletEntry): Promise<string> => {
    const resolved = ensureWallet(wallet);
    const getAddr = (a: unknown) =>
      a != null && typeof a === 'object'
        ? (a as { address?: string }).address ?? (a as { suiAddress?: string }).suiAddress
        : undefined;
    const isPrivateConnectError = (e: any) => {
      const msg = String(e?.message ?? '');
      return msg.includes('private member') || msg.includes('#connect');
    };
    let fromProvider: readonly unknown[] = [];
    try {
      fromProvider = (resolved.provider as { accounts?: readonly unknown[] }).accounts ?? [];
    } catch (e) {
      if (isPrivateConnectError(e)) {
        throw new Error('Wallet connection issue. Try disconnecting and reconnecting your wallet.');
      }
      throw e;
    }
    const stored = lastConnectRawAccountsByKey.get(resolved.key) ?? [];
    const raw = fromProvider[0] ?? stored[0];
    if (raw != null) {
      const addr = getAddr(raw);
      if (addr) return addr;
    }
    try {
      await connectWallet(resolved);
      let fromProvider2: readonly unknown[] = [];
      try {
        fromProvider2 = (resolved.provider as { accounts?: readonly unknown[] }).accounts ?? [];
      } catch (e) {
        if (isPrivateConnectError(e)) {
          throw new Error('Wallet connection issue. Try disconnecting and reconnecting your wallet.');
        }
        throw e;
      }
      const stored2 = lastConnectRawAccountsByKey.get(resolved.key) ?? [];
      const raw2 = fromProvider2[0] ?? stored2[0];
      const addr = raw2 != null ? getAddr(raw2) : undefined;
      if (addr) return addr;
    } catch (e) {
      if (isPrivateConnectError(e)) {
        throw new Error('Wallet connection issue. Try disconnecting and reconnecting your wallet.');
      }
      // fall through (e.g. user cancelled connect)
    }
    throw new Error('No account available. Connect the wallet first and select an account.');
  };

  /** Resolve raw account for Wallet Standard (chain + account required by some wallets). */
  const resolveRawAccount = async (resolved: WalletEntry, accountAddress?: string): Promise<unknown> => {
    const getAddr = (a: unknown) =>
      a != null && typeof a === 'object'
        ? (a as { address?: string }).address ?? (a as { suiAddress?: string }).suiAddress
        : undefined;
    const addrEq = (a: string | undefined, b: string | undefined) =>
      !!a && !!b && a.toLowerCase() === b.toLowerCase();
    const provider = resolved.provider as { accounts?: readonly unknown[] };
    const fromProvider = provider.accounts ?? [];
    let raw: unknown = fromProvider[0];
    if (accountAddress) {
      raw = fromProvider.find((a) => addrEq(getAddr(a), accountAddress)) ?? raw;
    }
    if (raw == null) {
      const stored = lastConnectRawAccountsByKey.get(resolved.key) ?? [];
      raw = accountAddress ? stored.find((a) => addrEq(getAddr(a), accountAddress)) : stored[0];
      if (raw == null && stored.length > 0) raw = stored[0];
    }
    if (raw == null) {
      try {
        await connectWallet(resolved);
        const fromProvider2 = (resolved.provider as { accounts?: readonly unknown[] }).accounts ?? [];
        const stored2 = lastConnectRawAccountsByKey.get(resolved.key) ?? [];
        raw = (accountAddress
          ? fromProvider2.find((a) => addrEq(getAddr(a), accountAddress)) ?? stored2.find((a) => addrEq(getAddr(a), accountAddress))
          : fromProvider2[0] ?? stored2[0]) ?? null;
      } catch {
        // ignore
      }
    }
    if (raw == null) {
      throw new Error('No account available for signing. Connect the wallet first and select the account you want to use.');
    }
    return raw;
  };

  const signTransactionBlock = async (
    transactionBlock: Uint8Array | string,
    wallet?: WalletEntry
  ): Promise<string> => {
    const resolved = ensureWallet(wallet);
    const provider = resolved.provider;
    const normalized = toUint8Array(transactionBlock);
    const chain = SUI_CHAIN_ID;

    let signFn: ((input: any) => Promise<any>) | null = null;
    try {
      signFn = provider?.features?.['sui:signTransactionBlock']?.signTransactionBlock ?? null;
    } catch {
      // provider.features may throw (e.g. "Cannot read private member"); fall through to legacy paths
    }
    if (signFn) {
      const rawAccount = await resolveRawAccount(resolved);
      const result = await signFn({
        transactionBlock: normalized,
        account: rawAccount as { address: string; publicKey?: Uint8Array; chains?: unknown[]; features?: unknown[] },
        chain
      });
      return normalizeSignature(result);
    }

    if (provider?.signTransactionBlock) {
      const result = await provider.signTransactionBlock({
        transactionBlock: normalized,
        chain
      });
      return normalizeSignature(result);
    }

    if (provider?.request) {
      const result = await provider.request({
        method: 'sui_signTransactionBlock',
        params: { transactionBlock: Array.from(normalized), chain }
      });
      return normalizeSignature(result);
    }

    throw new Error('Wallet does not support transaction signing');
  };

  const signAndExecuteTransactionBlock = async (
    transactionBlock: Uint8Array | string | { serialize?: () => Uint8Array; build?: (opts: any) => Promise<Uint8Array> },
    options?: Record<string, any>,
    requestType?: string,
    wallet?: WalletEntry
  ): Promise<any> => {
    const resolved = ensureWallet(wallet);
    const provider = resolved.provider;
    const chain = SUI_CHAIN_ID;
    // Wallet Standard expects Transaction object (with .serialize()); legacy wallets may accept bytes
    const isTransactionObject =
      transactionBlock != null &&
      typeof transactionBlock === 'object' &&
      (typeof (transactionBlock as any).serialize === 'function' || typeof (transactionBlock as any).build === 'function');
    const transactionBlockForPayload = isTransactionObject
      ? transactionBlock
      : toUint8Array(transactionBlock as Uint8Array | string);

    const payload = {
      transactionBlock: transactionBlockForPayload,
      options,
      requestType,
      chain
    };

    if (provider?.features?.['sui:signAndExecuteTransactionBlock']?.signAndExecuteTransactionBlock) {
      const rawAccount = await resolveRawAccount(resolved);
      const fullPayload = {
        ...payload,
        account: rawAccount as { address: string; publicKey?: Uint8Array; chains?: unknown[]; features?: unknown[] }
      };
      return provider.features['sui:signAndExecuteTransactionBlock'].signAndExecuteTransactionBlock(fullPayload);
    }

    if (provider?.signAndExecuteTransactionBlock) {
      return provider.signAndExecuteTransactionBlock(payload);
    }

    if (provider?.request) {
      let bytes: number[] | Uint8Array;
      if (isTransactionObject && typeof (transactionBlock as any).build === 'function') {
        const client = getLazySuiClient();
        const built = await (transactionBlock as any).build({ client });
        bytes = Array.from(built);
      } else {
        bytes = Array.from(transactionBlockForPayload as Uint8Array);
      }
      return provider.request({
        method: 'sui_signAndExecuteTransactionBlock',
        params: {
          transactionBlock: bytes,
          options,
          requestType,
          chain
        }
      });
    }

    throw new Error('Wallet does not support sign and execute');
  };

  /**
   * Sign a transaction and return the full signed result for execution.
   * Use this with SuiClient.executeTransactionBlock to avoid the wallet's Enoki/fetch for execution
   * (which can fail with "Failed to fetch api.enoki.mystenlabs.com" even when the tx lands).
   * Returns { transactionBlockBytes, signature } (base64 strings).
   */
  const signTransactionBlockForExecute = async (
    transaction: { build?: (opts: any) => Promise<Uint8Array> },
    wallet?: WalletEntry
  ): Promise<{ transactionBlockBytes: string; signature: string }> => {
    const resolved = ensureWallet(wallet);
    const provider = resolved.provider;
    const chain = SUI_CHAIN_ID;

    // Accessing provider.features can throw (e.g. "Cannot read private member #connect") with
    // some wallet proxies; fall back to build+sign(bytes) when that happens.
    let signFn: ((input: any) => Promise<any>) | null = null;
    try {
      signFn = provider?.features?.['sui:signTransactionBlock']?.signTransactionBlock ?? null;
    } catch {
      // Wallet proxy/getter threw; use bytes fallback
    }

    if (signFn) {
      const rawAccount = await resolveRawAccount(resolved);
      const result = await signFn({
        transactionBlock: transaction,
        account: rawAccount as { address: string; publicKey?: Uint8Array; chains?: unknown[]; features?: unknown[] },
        chain
      });
      const txBytes = (result as any).transactionBlockBytes;
      const sig = (result as any).signature ?? normalizeSignature(result);
      if (!txBytes || !sig) {
        throw new Error('Wallet did not return transactionBlockBytes and signature');
      }
      return {
        transactionBlockBytes: typeof txBytes === 'string' ? txBytes : toBase64(txBytes),
        signature: typeof sig === 'string' ? sig : toBase64(sig)
      };
    }

    // Fallback: build tx ourselves, sign, return
    const client = getLazySuiClient();
    const built = await (transaction as any).build({ client });
    const signature = await signTransactionBlock(built, wallet);
    return {
      transactionBlockBytes: toBase64(built),
      signature
    };
  };

  return {
    wallets,
    activeWallet,
    setActiveWallet,
    connectWallet,
    signMessage,
    getCurrentAddress,
    signTransactionBlock,
    signAndExecuteTransactionBlock,
    signTransactionBlockForExecute
  };
}
