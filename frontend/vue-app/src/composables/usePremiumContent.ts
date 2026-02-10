import { ref } from 'vue';
import axios from 'axios';

import { getWalrusServiceUrl } from '@/config/links';
const WALRUS_SERVICE_URL = getWalrusServiceUrl();

export interface PremiumContent {
  id: string;
  name: string;
  description: string;
  price: number;
  contentType: string;
  createdAt: string;
  hasAccess?: boolean;
  canPurchase?: boolean;
}

export interface PremiumPurchase {
  id: string;
  contentId: string;
  contentName?: string;
  price: number;
  purchasedAt: string;
  accessGrantId: string;
}

export function usePremiumContent() {
  const premiumContent = ref<PremiumContent[]>([]);
  const userPurchases = ref<PremiumPurchase[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function loadPremiumContent(dappId: string, userAddress?: string): Promise<void> {
    loading.value = true;
    error.value = null;

    try {
      const params = new URLSearchParams();
      if (userAddress) params.append('user', userAddress);

      const response = await axios.get(`${WALRUS_SERVICE_URL}/premium/content/${dappId}?${params}`);
      premiumContent.value = response.data.contents;
    } catch (err: any) {
      error.value = err.response?.data?.error || err.message || 'Failed to load premium content';
      console.error('Error loading premium content:', err);
    } finally {
      loading.value = false;
    }
  }

  async function createPremiumContent(
    file: File,
    metadata: {
      name: string;
      description?: string;
      price: number;
      contentType?: string;
      owner: string;
      dappId: string;
    }
  ): Promise<{ contentId: string; sealObjectId: string }> {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('name', metadata.name);
      formData.append('description', metadata.description || '');
      formData.append('price', metadata.price.toString());
      formData.append('contentType', metadata.contentType || file.type);
      formData.append('owner', metadata.owner);
      formData.append('dappId', metadata.dappId);

      const response = await axios.post(`${WALRUS_SERVICE_URL}/premium/content`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      return response.data;
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || err.message || 'Failed to create premium content';
      throw new Error(errorMessage);
    }
  }

  async function purchasePremiumContent(
    contentId: string,
    buyer: string,
    paymentTxId: string
  ): Promise<{ success: boolean; accessGrantId: string }> {
    try {
      const response = await axios.post(`${WALRUS_SERVICE_URL}/premium/purchase`, {
        contentId,
        buyer,
        paymentTxId
      });

      return response.data;
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || err.message || 'Failed to purchase premium content';
      throw new Error(errorMessage);
    }
  }

  async function accessPremiumContent(contentId: string, user: string): Promise<Blob> {
    try {
      const response = await axios.get(`${WALRUS_SERVICE_URL}/premium/access/${contentId}`, {
        params: { user },
        responseType: 'blob'
      });

      return response.data;
    } catch (err: any) {
      if (err.response?.status === 403) {
        throw new Error('Access denied. Purchase required.');
      }
      const errorMessage = err.response?.data?.error || err.message || 'Failed to access premium content';
      throw new Error(errorMessage);
    }
  }

  async function loadUserPurchases(user: string): Promise<void> {
    try {
      const response = await axios.get(`${WALRUS_SERVICE_URL}/premium/purchases/${user}`);
      userPurchases.value = response.data.purchases;
    } catch (err: any) {
      error.value = err.response?.data?.error || err.message || 'Failed to load purchases';
      console.error('Error loading user purchases:', err);
    }
  }

  async function deletePremiumContent(contentId: string, owner: string): Promise<void> {
    try {
      await axios.delete(`${WALRUS_SERVICE_URL}/premium/content/${contentId}`, {
        params: { owner }
      });
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || err.message || 'Failed to delete premium content';
      throw new Error(errorMessage);
    }
  }

  return {
    premiumContent,
    userPurchases,
    loading,
    error,
    loadPremiumContent,
    createPremiumContent,
    purchasePremiumContent,
    accessPremiumContent,
    loadUserPurchases,
    deletePremiumContent
  };
}