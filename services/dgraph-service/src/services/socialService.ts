import {
  SocialPost,
  SocialInteraction,
  CreatePostRequest,
  CreateInteractionRequest,
  SocialFeedQuery,
  SocialFeedResult,
  UserSocialStats,
  FollowRelationship,
  CreateFollowRequest
} from '@dlux-sui/types';
import { logger } from '../utils/logger';
import { socialRepository } from '../repositories/socialRepository';
import { socialBlockchain } from './socialBlockchain';
import { SignatureVerifier } from '../utils/signatureVerifier';
import crypto from 'crypto';

export class SocialService {
  /**
   * Create a new post
   * @param data Post data
   * @param jwtAuthenticatedAddress If provided, skip signature verification (JWT auth)
   */
  async createPost(data: CreatePostRequest, jwtAuthenticatedAddress?: string): Promise<SocialPost> {
    // If JWT auth is provided, verify it matches the author
    if (jwtAuthenticatedAddress) {
      if (jwtAuthenticatedAddress.toLowerCase() !== data.author.toLowerCase()) {
        throw new Error('Unauthorized');
      }
      // Skip signature verification when JWT is present
    } else {
      // Verify signature (but don't broadcast to SUI)
      if (!data.signature) {
        throw new Error('Signature is required when JWT is not provided');
      }
      
      const message = SignatureVerifier.createSignableMessage('createPost', {
        author: data.author,
        content: data.content,
        dappId: data.dappId
      });
      
      const isValid = await SignatureVerifier.verifySignature(
        data.author,
        message,
        data.signature
      );

      if (!isValid) {
        throw new Error('Invalid signature');
      }
    }

    const postId = crypto.randomUUID();
    
    const tags = (data.tags && data.tags.length > 0) ? data.tags : this.extractTags(data.content);
    const mentions = (data.mentions && data.mentions.length > 0) ? data.mentions : this.extractMentions(data.content);

    const post: SocialPost = {
      id: postId,
      author: data.author,
      content: data.content,
      contentType: data.contentType || 'text',
      dappId: data.dappId,
      parentId: data.parentId,
      quoteId: data.quoteId,
      repostId: data.repostId,
      mediaUrls: data.mediaUrls || [],
      tags,
      mentions,
      likes: 0,
      dislikes: 0,
      replies: 0,
      reposts: 0,
      quotes: 0,
      signature: data.signature || '', // Empty string when JWT auth is used
      signedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await socialRepository.savePost(post);

    // Record in social blockchain for ecosystem replication
    await socialBlockchain.addInteraction({
      id: postId,
      type: 'post',
      author: data.author,
      data: {
        content: data.content,
        contentType: data.contentType,
        dappId: data.dappId,
        parentId: data.parentId,
        quoteId: data.quoteId,
        repostId: data.repostId,
        mediaUrls: data.mediaUrls,
        tags: data.tags
      },
      signature: data.signature || '', // Empty string when JWT auth is used
      timestamp: new Date()
    });

    // Update parent post reply count if this is a reply
    if (data.parentId) {
      await socialRepository.incrementPostCount(data.parentId, 'replies');
    }

    // Update quoted post quote count if this is a quote
    if (data.quoteId) {
      await socialRepository.incrementPostCount(data.quoteId, 'quotes');
    }

    logger.info('Post created and recorded in blockchain', { postId, author: data.author });
    return post;
  }

  /**
   * Get post by ID
   */
  async getPost(id: string): Promise<SocialPost | null> {
    return await socialRepository.findPostById(id);
  }

  /**
   * Get feed based on query
   */
  async getFeed(query: SocialFeedQuery): Promise<SocialFeedResult> {
    const posts = await socialRepository.findPosts(query);
    const total = await socialRepository.countPosts(query);

    return {
      posts,
      total,
      hasMore: (query.offset || 0) + (query.limit || 50) < total
    };
  }

  /**
   * Create interaction (like, dislike, repost, quote, reply)
   * @param data Interaction data
   * @param jwtAuthenticatedAddress If provided, skip signature verification (JWT auth)
   */
  async createInteraction(data: CreateInteractionRequest, jwtAuthenticatedAddress?: string): Promise<SocialInteraction> {
    // If JWT auth is provided, verify it matches the user
    if (jwtAuthenticatedAddress) {
      if (jwtAuthenticatedAddress.toLowerCase() !== data.user.toLowerCase()) {
        throw new Error('Unauthorized');
      }
      // Skip signature verification when JWT is present
    } else {
      // Verify signature (but don't broadcast to SUI)
      if (!data.signature) {
        throw new Error('Signature is required when JWT is not provided');
      }
      
      const message = SignatureVerifier.createSignableMessage('createInteraction', {
        user: data.user,
        type: data.type,
        targetId: data.targetId
      });
      
      const isValid = await SignatureVerifier.verifySignature(
        data.user,
        message,
        data.signature
      );

      if (!isValid) {
        throw new Error('Invalid signature');
      }
    }

    // Check if interaction already exists
    const existing = await socialRepository.findInteraction(
      data.user,
      data.targetId,
      data.type
    );

    if (existing && !existing.deletedAt) {
      throw new Error('Interaction already exists');
    }

    const interactionId = crypto.randomUUID();
    const interaction: SocialInteraction = {
      id: interactionId,
      type: data.type,
      user: data.user,
      targetId: data.targetId,
      targetType: data.targetType,
      signature: data.signature || '', // Empty string when JWT auth is used
      signedAt: new Date(),
      createdAt: new Date()
    };

    await socialRepository.saveInteraction(interaction);

    // Record in social blockchain for ecosystem replication
    await socialBlockchain.addInteraction({
      id: interactionId,
      type: 'interaction',
      author: data.user,
      data: {
        interactionType: data.type,
        targetId: data.targetId,
        targetType: data.targetType
      },
      signature: data.signature || '', // Empty string when JWT auth is used
      timestamp: new Date()
    });

    // Update post counts
    if (data.targetType === 'post') {
      const field = this.getCountField(data.type);
      if (field) {
        await socialRepository.incrementPostCount(data.targetId, field);
      }
    }

    logger.info('Interaction created and recorded in blockchain', { interactionId, type: data.type, user: data.user });
    return interaction;
  }

  /**
   * Delete interaction (undo)
   * @param interactionId Interaction ID
   * @param user User address
   * @param jwtAuthenticatedAddress If provided, verify it matches user (JWT auth)
   */
  async deleteInteraction(interactionId: string, user: string, jwtAuthenticatedAddress?: string): Promise<void> {
    const interaction = await socialRepository.findInteractionById(interactionId);

    if (!interaction) {
      throw new Error('Interaction not found');
    }

    // Verify authorization: JWT auth or user must match interaction owner
    if (jwtAuthenticatedAddress) {
      if (jwtAuthenticatedAddress.toLowerCase() !== user.toLowerCase() || 
          jwtAuthenticatedAddress.toLowerCase() !== interaction.user.toLowerCase()) {
        throw new Error('Unauthorized');
      }
    } else {
      if (interaction.user.toLowerCase() !== user.toLowerCase()) {
        throw new Error('Unauthorized');
      }
    }

    await socialRepository.deleteInteraction(interactionId);

    // Update post counts
    if (interaction.targetType === 'post') {
      const field = this.getCountField(interaction.type);
      if (field) {
        await socialRepository.decrementPostCount(interaction.targetId, field);
      }
    }

    logger.info('Interaction deleted', { interactionId });
  }

  /**
   * Get interactions for a post
   */
  async getPostInteractions(postId: string, type?: string): Promise<SocialInteraction[]> {
    return await socialRepository.findPostInteractions(postId, type);
  }

  /**
   * List interactions (for analytics / moderation / UI)
   */
  async getInteractions(query: {
    user?: string;
    targetId?: string;
    targetType?: SocialInteraction['targetType'];
    type?: SocialInteraction['type'];
    limit?: number;
    offset?: number;
  }): Promise<{ interactions: SocialInteraction[]; total: number; hasMore: boolean }> {
    const interactions = await socialRepository.findInteractions(query);
    const total = await socialRepository.countInteractions(query);
    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;

    return {
      interactions,
      total,
      hasMore: offset + limit < total
    };
  }

  /**
   * Create follow relationship
   * @param data Follow data
   * @param jwtAuthenticatedAddress If provided, verify it matches follower (JWT auth)
   */
  async createFollow(data: CreateFollowRequest, jwtAuthenticatedAddress?: string): Promise<FollowRelationship> {
    if (data.follower === data.following) {
      throw new Error('Cannot follow yourself');
    }

    // Verify authorization: JWT auth must match follower
    if (jwtAuthenticatedAddress) {
      if (jwtAuthenticatedAddress.toLowerCase() !== data.follower.toLowerCase()) {
        throw new Error('Unauthorized');
      }
    }

    const existing = await socialRepository.findFollow(data.follower, data.following);
    if (existing) {
      throw new Error('Already following');
    }

    const followId = crypto.randomUUID();
    const follow: FollowRelationship = {
      id: followId,
      follower: data.follower,
      following: data.following,
      createdAt: new Date()
    };

    await socialRepository.saveFollow(follow);

    // Record in social blockchain for ecosystem replication
    await socialBlockchain.addInteraction({
      id: followId,
      type: 'follow',
      author: data.follower,
      data: {
        following: data.following
      },
      signature: data.signature || '', // Empty string when JWT auth is used
      timestamp: new Date()
    });

    logger.info('Follow created and recorded in blockchain', { follower: data.follower, following: data.following });
    return follow;
  }

  /**
   * Delete follow relationship
   * @param follower Follower address
   * @param following Following address
   * @param jwtAuthenticatedAddress If provided, verify it matches follower (JWT auth)
   */
  async deleteFollow(follower: string, following: string, jwtAuthenticatedAddress?: string): Promise<void> {
    // Verify authorization: JWT auth must match follower
    if (jwtAuthenticatedAddress) {
      if (jwtAuthenticatedAddress.toLowerCase() !== follower.toLowerCase()) {
        throw new Error('Unauthorized');
      }
    }
    
    await socialRepository.deleteFollow(follower, following);
    logger.info('Follow deleted', { follower, following });
  }

  /**
   * Get user social stats
   */
  async getUserStats(suiAddress: string): Promise<UserSocialStats> {
    const stats = await socialRepository.getUserStats(suiAddress);
    return stats;
  }

  /**
   * Get user feed (posts from followed users)
   */
  async getUserFeed(suiAddress: string, limit: number, offset: number): Promise<SocialFeedResult> {
    const following = await socialRepository.getFollowing(suiAddress);
    const followingAddresses = following.map(f => f.following);

    const query: SocialFeedQuery = {
      author: undefined, // Will filter by following addresses
      limit,
      offset,
      sortBy: 'created',
      sortOrder: 'desc'
    };

    // Get posts from followed users
    const posts = await socialRepository.findPostsByAuthors(followingAddresses, limit, offset);
    const total = await socialRepository.countPostsByAuthors(followingAddresses);

    return {
      posts,
      total,
      hasMore: offset + limit < total
    };
  }

  /**
   * Extract mentions from content
   */
  private extractMentions(content: string): string[] {
    const mentionRegex = /@([a-zA-Z0-9_-]{3,20})/g;
    const matches = content.match(mentionRegex);
    return matches ? matches.map(m => m.substring(1)) : [];
  }

  /**
   * Extract hashtags from content
   */
  private extractTags(content: string): string[] {
    const tagRegex = /#([a-zA-Z0-9_-]+)/g;
    const matches = content.match(tagRegex);
    return matches ? matches.map(tag => tag.substring(1)) : [];
  }

  /**
   * Get count field name for interaction type
   */
  private getCountField(type: SocialInteraction['type']): keyof SocialPost | null {
    switch (type) {
      case 'like': return 'likes';
      case 'dislike': return 'dislikes';
      case 'repost': return 'reposts';
      case 'quote': return 'quotes';
      case 'reply': return 'replies';
      default: return null;
    }
  }
}

export const socialService = new SocialService();
