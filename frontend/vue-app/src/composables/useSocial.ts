import { ref } from 'vue';
import axios from 'axios';
import { useAuthStore } from '../stores/auth';
import { useSuiWallet } from './useSuiWallet';
import type { 
  SocialPost, 
  CreatePostRequest, 
  CreateInteractionRequest,
  SocialFeedQuery,
  SocialFeedResult,
  UserSocialStats
} from '@dlux-sui/types';

import { getDgraphServiceUrl } from '@/config/links';
const GRAPHQL_SERVICE = getDgraphServiceUrl();

export function useSocial() {
  const authStore = useAuthStore();
  const { signMessage: signWithWallet } = useSuiWallet();
  const loading = ref(false);
  const error = ref<string | null>(null);

  /**
   * Sign a message with SUI wallet (but don't broadcast).
   * Passes current user's address when available so the wallet can resolve the correct account for signing.
   */
  async function signMessage(message: string, accountAddress?: string): Promise<string> {
    return signWithWallet(message, undefined, accountAddress ?? authStore.user?.suiAddress);
  }

  /**
   * Create a deterministic signable message matching backend format.
   * Keys sorted so client and server produce identical message for verification.
   */
  function createSignableMessage(
    action: string,
    data: Record<string, unknown>
  ): string {
    const messageData: Record<string, unknown> = { action, ...data };
    const keys = Object.keys(messageData).filter((k) => messageData[k] !== undefined).sort();
    const sorted: Record<string, unknown> = {};
    for (const k of keys) sorted[k] = messageData[k];
    return JSON.stringify(sorted);
  }

  /**
   * Create a post
   */
  async function createPost(data: {
    content: string;
    contentType?: 'text' | 'markdown' | 'html';
    dappId?: string;
    parentId?: string;
    quoteId?: string;
    repostId?: string;
    mediaUrls?: string[];
    tags?: string[];
  }): Promise<SocialPost> {
    if (!authStore.user?.suiAddress) {
      throw new Error('Not authenticated');
    }

    loading.value = true;
    error.value = null;

    try {
      // Use the logged-in user's address (avoids touching wallet provider.accounts/#connect which can throw)
      const author = authStore.user.suiAddress;
      
      // Create message in the same format as backend SignatureVerifier.createSignableMessage
      const message = createSignableMessage('createPost', {
        author,
        content: data.content,
        dappId: data.dappId
      });

      // Try to sign message, but if it fails and we have a JWT token, we'll use JWT auth instead
      let signature: string | undefined;
      try {
        signature = await signMessage(message, author);
      } catch (walletErr: any) {
        const msg = String(walletErr?.message ?? '');
        // If we have a JWT token, we can skip signature and use JWT auth
        if (authStore.token) {
          // Signature optional when JWT is present
          signature = undefined;
        } else {
          // No JWT token, signature is required
          if (msg.includes('private member') || msg.includes('#connect') || msg.includes('connect')) {
            throw new Error('Wallet connection issue. Try disconnecting and reconnecting your wallet, then post again.');
          }
          throw walletErr;
        }
      }

      const postData: CreatePostRequest = {
        author,
        content: data.content,
        contentType: data.contentType,
        dappId: data.dappId,
        parentId: data.parentId,
        quoteId: data.quoteId,
        repostId: data.repostId,
        mediaUrls: data.mediaUrls,
        tags: data.tags,
        signature: signature // Optional - undefined when using JWT auth
      };

      // Include JWT token in Authorization header if available
      const headers: Record<string, string> = {};
      if (authStore.token) {
        headers.Authorization = `Bearer ${authStore.token}`;
      }

      const response = await axios.post(`${GRAPHQL_SERVICE}/social/posts`, postData, { headers });
      return response.data;
    } catch (err: any) {
      error.value = err.response?.data?.error || err.message || 'Failed to create post';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  /**
   * Get feed
   */
  async function getFeed(query: SocialFeedQuery): Promise<SocialFeedResult> {
    loading.value = true;
    error.value = null;

    try {
      const params = new URLSearchParams();
      if (query.author) params.append('author', query.author);
      if (query.dappId) params.append('dappId', query.dappId);
      if (query.tags) params.append('tags', query.tags.join(','));
      if (query.mentions) params.append('mentions', query.mentions);
      if (query.parentId) params.append('parentId', query.parentId);
      if (query.type) params.append('type', query.type);
      if (query.limit) params.append('limit', query.limit.toString());
      if (query.offset) params.append('offset', query.offset.toString());
      if (query.sortBy) params.append('sortBy', query.sortBy);
      if (query.sortOrder) params.append('sortOrder', query.sortOrder);

      const response = await axios.get(`${GRAPHQL_SERVICE}/social/posts?${params}`);
      return response.data;
    } catch (err: any) {
      error.value = err.response?.data?.error || err.message || 'Failed to get feed';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  /**
   * Create interaction (like, dislike, repost, quote)
   */
  async function createInteraction(
    type: 'like' | 'dislike' | 'repost' | 'quote',
    targetId: string,
    targetType: 'post' | 'dapp' | 'profile' = 'post'
  ): Promise<void> {
    if (!authStore.user) {
      throw new Error('Not authenticated');
    }

    loading.value = true;
    error.value = null;

    try {
      const message = createSignableMessage('createInteraction', {
        targetId,
        type,
        user: authStore.user.suiAddress
      });

      // Try to sign message, but if it fails and we have a JWT token, we'll use JWT auth instead
      let signature: string | undefined;
      try {
        signature = await signMessage(message);
      } catch (walletErr: any) {
        // If we have a JWT token, we can skip signature and use JWT auth
        if (authStore.token) {
          signature = undefined;
        } else {
          throw walletErr;
        }
      }

      const interactionData: CreateInteractionRequest = {
        user: authStore.user.suiAddress,
        type,
        targetId,
        targetType,
        signature: signature // Optional - undefined when using JWT auth
      };

      // Include JWT token in Authorization header if available
      const headers: Record<string, string> = {};
      if (authStore.token) {
        headers.Authorization = `Bearer ${authStore.token}`;
      }

      await axios.post(`${GRAPHQL_SERVICE}/social/interactions`, interactionData, { headers });
    } catch (err: any) {
      error.value = err.response?.data?.error || err.message || 'Failed to create interaction';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  /**
   * Delete interaction (undo like, etc.)
   */
  async function deleteInteraction(interactionId: string): Promise<void> {
    if (!authStore.user) {
      throw new Error('Not authenticated');
    }

    loading.value = true;
    error.value = null;

    try {
      const message = createSignableMessage('deleteInteraction', {
        interactionId
      });

      // Try to sign message, but if it fails and we have a JWT token, we'll use JWT auth instead
      let signature: string | undefined;
      try {
        signature = await signMessage(message);
      } catch (walletErr: any) {
        // If we have a JWT token, we can skip signature and use JWT auth
        if (authStore.token) {
          signature = undefined;
        } else {
          throw walletErr;
        }
      }

      const headers: Record<string, string> = {};
      if (authStore.token) {
        headers.Authorization = `Bearer ${authStore.token}`;
      }

      await axios.delete(`${GRAPHQL_SERVICE}/social/interactions/${interactionId}`, {
        data: {
          user: authStore.user.suiAddress,
          signature: signature // Optional - undefined when using JWT auth
        },
        headers
      });
    } catch (err: any) {
      error.value = err.response?.data?.error || err.message || 'Failed to delete interaction';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  /**
   * Get user stats
   */
  async function getUserStats(suiAddress: string): Promise<UserSocialStats> {
    loading.value = true;
    error.value = null;

    try {
      const response = await axios.get(`${GRAPHQL_SERVICE}/social/users/${suiAddress}/stats`);
      return response.data;
    } catch (err: any) {
      error.value = err.response?.data?.error || err.message || 'Failed to get user stats';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  /**
   * Get user feed (posts from followed users)
   */
  async function getUserFeed(suiAddress: string, limit = 50, offset = 0): Promise<SocialFeedResult> {
    loading.value = true;
    error.value = null;

    try {
      const response = await axios.get(
        `${GRAPHQL_SERVICE}/social/users/${suiAddress}/feed?limit=${limit}&offset=${offset}`
      );
      return response.data;
    } catch (err: any) {
      error.value = err.response?.data?.error || err.message || 'Failed to get user feed';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  /**
   * Follow user
   */
  async function followUser(following: string): Promise<void> {
    if (!authStore.user) {
      throw new Error('Not authenticated');
    }

    loading.value = true;
    error.value = null;

    try {
      const message = createSignableMessage('follow', {
        follower: authStore.user.suiAddress,
        following
      });

      // Try to sign message, but if it fails and we have a JWT token, we'll use JWT auth instead
      let signature: string | undefined;
      try {
        signature = await signMessage(message);
      } catch (walletErr: any) {
        // If we have a JWT token, we can skip signature and use JWT auth
        if (authStore.token) {
          signature = undefined;
        } else {
          throw walletErr;
        }
      }

      const headers: Record<string, string> = {};
      if (authStore.token) {
        headers.Authorization = `Bearer ${authStore.token}`;
      }

      await axios.post(`${GRAPHQL_SERVICE}/social/follow`, {
        follower: authStore.user.suiAddress,
        following,
        signature: signature // Optional - undefined when using JWT auth
      }, { headers });
    } catch (err: any) {
      error.value = err.response?.data?.error || err.message || 'Failed to follow user';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  /**
   * Unfollow user
   */
  async function unfollowUser(following: string): Promise<void> {
    if (!authStore.user) {
      throw new Error('Not authenticated');
    }

    loading.value = true;
    error.value = null;

    try {
      const message = createSignableMessage('unfollow', {
        follower: authStore.user.suiAddress,
        following
      });

      // Try to sign message, but if it fails and we have a JWT token, we'll use JWT auth instead
      let signature: string | undefined;
      try {
        signature = await signMessage(message);
      } catch (walletErr: any) {
        // If we have a JWT token, we can skip signature and use JWT auth
        if (authStore.token) {
          signature = undefined;
        } else {
          throw walletErr;
        }
      }

      const headers: Record<string, string> = {};
      if (authStore.token) {
        headers.Authorization = `Bearer ${authStore.token}`;
      }

      await axios.delete(`${GRAPHQL_SERVICE}/social/follow/${following}`, {
        data: {
          follower: authStore.user.suiAddress,
          signature: signature // Optional - undefined when using JWT auth
      },
        headers
      });
    } catch (err: any) {
      error.value = err.response?.data?.error || err.message || 'Failed to unfollow user';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  return {
    loading,
    error,
    createPost,
    getFeed,
    createInteraction,
    deleteInteraction,
    getUserStats,
    getUserFeed,
    followUser,
    unfollowUser
  };
}
