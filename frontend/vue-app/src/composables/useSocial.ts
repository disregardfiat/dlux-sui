import { ref } from 'vue';
import axios from 'axios';
import { useAuthStore } from '../stores/auth';
import type { 
  SocialPost, 
  CreatePostRequest, 
  CreateInteractionRequest,
  SocialFeedQuery,
  SocialFeedResult,
  UserSocialStats
} from '@dlux-sui/types';

const GRAPHQL_SERVICE = import.meta.env.VITE_GRAPHQL_SERVICE_URL || 'http://localhost:3003';

export function useSocial() {
  const authStore = useAuthStore();
  const loading = ref(false);
  const error = ref<string | null>(null);

  /**
   * Sign a message with SUI wallet (but don't broadcast)
   */
  async function signMessage(message: string): Promise<string> {
    // TODO: Implement actual SUI wallet signing
    // This is a placeholder - in production, use @mysten/wallet-standard
    if (window.suiWallet) {
      const result = await window.suiWallet.signMessage({
        message: new TextEncoder().encode(message)
      });
      return result.signature;
    }
    throw new Error('Wallet not connected');
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
    if (!authStore.user) {
      throw new Error('Not authenticated');
    }

    loading.value = true;
    error.value = null;

    try {
      const message = JSON.stringify({
        action: 'createPost',
        author: authStore.user.suiAddress,
        content: data.content,
        dappId: data.dappId,
        timestamp: Date.now()
      });

      const signature = await signMessage(message);

      const postData: CreatePostRequest = {
        author: authStore.user.suiAddress,
        content: data.content,
        contentType: data.contentType,
        dappId: data.dappId,
        parentId: data.parentId,
        quoteId: data.quoteId,
        repostId: data.repostId,
        mediaUrls: data.mediaUrls,
        tags: data.tags,
        signature
      };

      const response = await axios.post(`${GRAPHQL_SERVICE}/social/posts`, postData);
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
      const message = JSON.stringify({
        action: 'createInteraction',
        user: authStore.user.suiAddress,
        type,
        targetId,
        timestamp: Date.now()
      });

      const signature = await signMessage(message);

      const interactionData: CreateInteractionRequest = {
        user: authStore.user.suiAddress,
        type,
        targetId,
        targetType,
        signature
      };

      await axios.post(`${GRAPHQL_SERVICE}/social/interactions`, interactionData);
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
      const message = JSON.stringify({
        action: 'deleteInteraction',
        interactionId,
        timestamp: Date.now()
      });

      const signature = await signMessage(message);

      await axios.delete(`${GRAPHQL_SERVICE}/social/interactions/${interactionId}`, {
        data: {
          user: authStore.user.suiAddress,
          signature
        }
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
      const message = JSON.stringify({
        action: 'follow',
        follower: authStore.user.suiAddress,
        following,
        timestamp: Date.now()
      });

      const signature = await signMessage(message);

      await axios.post(`${GRAPHQL_SERVICE}/social/follow`, {
        follower: authStore.user.suiAddress,
        following,
        signature
      });
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
      const message = JSON.stringify({
        action: 'unfollow',
        follower: authStore.user.suiAddress,
        following,
        timestamp: Date.now()
      });

      const signature = await signMessage(message);

      await axios.delete(`${GRAPHQL_SERVICE}/social/follow/${following}`, {
        data: {
          follower: authStore.user.suiAddress,
          signature
        }
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
