import { ref } from 'vue';
import axios from 'axios';
import type { BillingOverview, ClaimPayoutRequest, ClaimPayoutResponse } from '@dlux-sui/types';

import { getSuiServiceUrl } from '@/config/links';
const SUI_SERVICE_URL = getSuiServiceUrl();

export interface BillingTransaction {
  digest: string;
  timestampMs: string | null;
}

export function useBilling() {
  const billingOverview = ref<BillingOverview | null>(null);
  const transactions = ref<BillingTransaction[]>([]);
  const loading = ref(false);
  const transactionsLoading = ref(false);
  const error = ref<string | null>(null);

  async function loadBillingOverview(owner: string, token?: string | null): Promise<void> {
    loading.value = true;
    error.value = null;

    try {
      const headers: Record<string, string> = {};
      if (token) headers.Authorization = `Bearer ${token}`;
      const response = await axios.get(`${SUI_SERVICE_URL}/billing/overview?owner=${encodeURIComponent(owner)}`, { headers });
      billingOverview.value = response.data;
    } catch (err: any) {
      error.value = err.response?.data?.error || err.message || 'Failed to load billing overview';
      console.error('Error loading billing overview:', err);
    } finally {
      loading.value = false;
    }
  }

  async function loadTransactions(owner: string, limit: number = 20): Promise<void> {
    transactionsLoading.value = true;
    try {
      const response = await axios.get(
        `${SUI_SERVICE_URL}/billing/transactions?owner=${encodeURIComponent(owner)}&limit=${limit}`
      );
      transactions.value = response.data?.transactions ?? [];
    } catch (err: any) {
      console.error('Error loading transactions:', err);
      transactions.value = [];
    } finally {
      transactionsLoading.value = false;
    }
  }

  async function claimPayouts(owner: string, buckets: Array<{ type: 'adShare' | 'subscriptionShare' | 'pmShare' | 'premiumShare'; amount: number }>, recipientAddress: string): Promise<ClaimPayoutResponse> {
    try {
      const response = await axios.post(`${SUI_SERVICE_URL}/billing/claim`, {
        owner,
        buckets,
        recipientAddress
      });
      return response.data;
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || err.message || 'Failed to claim payouts';
      throw new Error(errorMessage);
    }
  }

  async function getStorageFunding(dappId: string, blobId: string) {
    try {
      const response = await axios.get(`${SUI_SERVICE_URL}/billing/storage/${dappId}/${blobId}`);
      return response.data;
    } catch (err: any) {
      console.error('Error loading storage funding:', err);
      throw err;
    }
  }

  return {
    billingOverview,
    transactions,
    loading,
    transactionsLoading,
    error,
    loadBillingOverview,
    loadTransactions,
    claimPayouts,
    getStorageFunding
  };
}