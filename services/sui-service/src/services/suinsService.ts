import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { logger } from '../utils/logger';

const SUINS_SERVICE_URL = process.env.SUINS_SERVICE_URL;
const isTestEnv = (): boolean => process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID !== undefined;

// SUINS always uses mainnet RPC regardless of SUI_NETWORK setting.
// If SUINS_SERVICE_URL is set, it is used as a proxy; otherwise we query
// the Sui mainnet fullnode directly via the SDK (resolveNameServiceAddress / resolveNameServiceNames).
const MAINNET_RPC = process.env.SUINS_MAINNET_RPC || getFullnodeUrl('mainnet');

type SuinsResolveResponse = {
  address?: string;
  name?: string;
};

export class SuinsService {
  private mainnetClient: SuiClient | null = null;

  /** Lazily create a SuiClient pointed at mainnet (for direct on-chain resolution). */
  private getMainnetClient(): SuiClient {
    if (!this.mainnetClient) {
      this.mainnetClient = new SuiClient({ url: MAINNET_RPC });
    }
    return this.mainnetClient;
  }

  /** Ensure name has `.sui` suffix (required by the Sui SDK). */
  private normalizeName(name: string): string {
    const trimmed = name.trim().toLowerCase();
    // Already has a TLD suffix
    if (trimmed.includes('.')) return trimmed;
    return `${trimmed}.sui`;
  }

  /** Optional: proxy via SUINS_SERVICE_URL if configured. */
  private async fetchJson(path: string): Promise<SuinsResolveResponse | null> {
    if (!SUINS_SERVICE_URL) {
      return null;
    }

    try {
      const response = await fetch(`${SUINS_SERVICE_URL}${path}`);
      if (!response.ok) {
        return null;
      }
      return (await response.json()) as SuinsResolveResponse;
    } catch (error) {
      logger.warn('SuiNS fetch failed', { error, path });
      return null;
    }
  }

  async resolveName(name: string): Promise<string | null> {
    if (!name || isTestEnv()) {
      return null;
    }

    const normalized = this.normalizeName(name);

    // Try proxy first
    const proxyResult = await this.fetchJson(`/resolve?name=${encodeURIComponent(normalized)}`);
    if (proxyResult?.address) {
      return proxyResult.address;
    }

    // Fall back to direct mainnet RPC
    try {
      const address = await this.getMainnetClient().resolveNameServiceAddress({ name: normalized });
      return address || null;
    } catch (error) {
      logger.warn('SuiNS direct resolve failed', { error, name: normalized });
      return null;
    }
  }

  async reverseResolve(address: string): Promise<string | null> {
    if (!address || isTestEnv()) {
      return null;
    }

    // Try proxy first
    const proxyResult = await this.fetchJson(`/reverse?address=${encodeURIComponent(address)}`);
    if (proxyResult?.name) {
      return proxyResult.name;
    }

    // Fall back to direct mainnet RPC
    try {
      const result = await this.getMainnetClient().resolveNameServiceNames({ address });
      return result?.data?.[0] || null;
    } catch (error) {
      logger.warn('SuiNS direct reverse resolve failed', { error, address });
      return null;
    }
  }

  async isAvailable(name: string): Promise<boolean | null> {
    if (!name || isTestEnv()) {
      return null;
    }

    const normalized = this.normalizeName(name);

    // Try proxy first
    const proxyResult = await this.fetchJson(`/availability?name=${encodeURIComponent(normalized)}`);
    if (proxyResult !== null) {
      return typeof proxyResult.address !== 'string';
    }

    // Fall back to direct mainnet RPC: if name resolves to an address, it's taken
    try {
      const address = await this.getMainnetClient().resolveNameServiceAddress({ name: normalized });
      return !address; // null = available, address = taken
    } catch (error) {
      logger.warn('SuiNS direct availability check failed', { error, name: normalized });
      return null;
    }
  }
}

export const suinsService = new SuinsService();
