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
import crypto from 'crypto';

export class SocialService {
  /**
   * Create a new post
   */
  async createPost(data: CreatePostRequest): Promise<SocialPost> {
    // Verify signature (but don't broadcast to SUI)
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

    const postId = crypto.randomUUID();
    
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
      tags: data.tags || [],
      mentions: this.extractMentions(data.content),
      likes: 0,
      dislikes: 0,
      replies: 0,
      reposts: 0,
      quotes: 0,
      signature: data.signature,
      signedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await socialRepository.savePost(post);

    // Update parent post reply count if this is a reply
    if (data.parentId) {
      await socialRepository.incrementPostCount(data.parentId, 'replies');
    }

    // Update quoted post quote count if this is a quote
    if (data.quoteId) {
      await socialRepository.incrementPostCount(data.quoteId, 'quotes');
    }

    logger.info('Post created', { postId, author: data.author });
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
   */
  async createInteraction(data: CreateInteractionRequest): Promise<SocialInteraction> {
    // Verify signature (but don't broadcast to SUI)
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
      signature: data.signature,
      signedAt: new Date(),
      createdAt: new Date()
    };

    await socialRepository.saveInteraction(interaction);

    // Update post counts
    if (data.targetType === 'post') {
      const field = this.getCountField(data.type);
      if (field) {
        await socialRepository.incrementPostCount(data.targetId, field);
      }
    }

    logger.info('Interaction created', { interactionId, type: data.type, user: data.user });
    return interaction;
  }

  /**
   * Delete interaction (undo)
   */
  async deleteInteraction(interactionId: string, user: string): Promise<void> {
    const interaction = await socialRepository.findInteractionById(interactionId);

    if (!interaction) {
      throw new Error('Interaction not found');
    }

    if (interaction.user !== user) {
      throw new Error('Unauthorized');
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
   * Create follow relationship
   */
  async createFollow(data: CreateFollowRequest): Promise<FollowRelationship> {
    if (data.follower === data.following) {
      throw new Error('Cannot follow yourself');
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
    logger.info('Follow created', { follower: data.follower, following: data.following });
    return follow;
  }

  /**
   * Delete follow relationship
   */
  async deleteFollow(follower: string, following: string): Promise<void> {
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
