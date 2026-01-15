import {
  SocialPost,
  SocialInteraction,
  SocialFeedQuery,
  UserSocialStats,
  FollowRelationship
} from '@dlux-sui/types';
import { logger } from '../utils/logger';

// In-memory storage - replace with DGraph queries in production
const posts = new Map<string, SocialPost>();
const interactions = new Map<string, SocialInteraction>();
const follows = new Map<string, FollowRelationship>();

export class SocialRepository {
  // Posts
  async savePost(post: SocialPost): Promise<void> {
    posts.set(post.id, post);
    logger.debug('Post saved', { postId: post.id });
  }

  async findPostById(id: string): Promise<SocialPost | null> {
    return posts.get(id) || null;
  }

  async findPosts(query: SocialFeedQuery): Promise<SocialPost[]> {
    let results = Array.from(posts.values())
      .filter(p => !p.deletedAt);

    // Filter by author
    if (query.author) {
      results = results.filter(p => p.author === query.author);
    }

    // Filter by dApp
    if (query.dappId) {
      results = results.filter(p => p.dappId === query.dappId);
    }

    // Filter by tags
    if (query.tags && query.tags.length > 0) {
      results = results.filter(p => 
        p.tags && p.tags.some(tag => query.tags!.includes(tag))
      );
    }

    // Filter by mentions
    if (query.mentions) {
      results = results.filter(p => 
        p.mentions && p.mentions.includes(query.mentions!)
      );
    }

    // Filter by parent (replies)
    if (query.parentId) {
      results = results.filter(p => p.parentId === query.parentId);
    }

    // Filter by type
    if (query.type) {
      if (query.type === 'reply') {
        results = results.filter(p => !!p.parentId);
      } else if (query.type === 'quote') {
        results = results.filter(p => !!p.quoteId);
      } else if (query.type === 'repost') {
        results = results.filter(p => !!p.repostId && !p.content);
      } else if (query.type === 'post') {
        results = results.filter(p => !p.parentId && !p.quoteId && !p.repostId);
      }
    }

    // Sort
    const sortBy = query.sortBy || 'created';
    const sortOrder = query.sortOrder || 'desc';
    
    results.sort((a, b) => {
      let aVal: any, bVal: any;
      
      switch (sortBy) {
        case 'likes':
          aVal = a.likes;
          bVal = b.likes;
          break;
        case 'replies':
          aVal = a.replies;
          bVal = b.replies;
          break;
        case 'created':
        default:
          aVal = a.createdAt.getTime();
          bVal = b.createdAt.getTime();
          break;
      }

      if (sortOrder === 'asc') {
        return aVal - bVal;
      } else {
        return bVal - aVal;
      }
    });

    // Paginate
    const offset = query.offset || 0;
    const limit = query.limit || 50;
    return results.slice(offset, offset + limit);
  }

  async countPosts(query: SocialFeedQuery): Promise<number> {
    const posts = await this.findPosts({ ...query, limit: 10000, offset: 0 });
    return posts.length;
  }

  async incrementPostCount(postId: string, field: keyof SocialPost): Promise<void> {
    const post = posts.get(postId);
    if (post && typeof post[field] === 'number') {
      (post[field] as number)++;
      post.updatedAt = new Date();
    }
  }

  async decrementPostCount(postId: string, field: keyof SocialPost): Promise<void> {
    const post = posts.get(postId);
    if (post && typeof post[field] === 'number') {
      (post[field] as number) = Math.max(0, (post[field] as number) - 1);
      post.updatedAt = new Date();
    }
  }

  async findPostsByAuthors(authors: string[], limit: number, offset: number): Promise<SocialPost[]> {
    const results = Array.from(posts.values())
      .filter(p => !p.deletedAt && authors.includes(p.author))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(offset, offset + limit);
    
    return results;
  }

  async countPostsByAuthors(authors: string[]): Promise<number> {
    return Array.from(posts.values())
      .filter(p => !p.deletedAt && authors.includes(p.author))
      .length;
  }

  // Interactions
  async saveInteraction(interaction: SocialInteraction): Promise<void> {
    interactions.set(interaction.id, interaction);
    logger.debug('Interaction saved', { interactionId: interaction.id });
  }

  async findInteractionById(id: string): Promise<SocialInteraction | null> {
    return interactions.get(id) || null;
  }

  async findInteraction(user: string, targetId: string, type: SocialInteraction['type']): Promise<SocialInteraction | null> {
    for (const interaction of interactions.values()) {
      if (
        interaction.user === user &&
        interaction.targetId === targetId &&
        interaction.type === type &&
        !interaction.deletedAt
      ) {
        return interaction;
      }
    }
    return null;
  }

  async findPostInteractions(postId: string, type?: string): Promise<SocialInteraction[]> {
    return Array.from(interactions.values())
      .filter(i => 
        i.targetId === postId &&
        i.targetType === 'post' &&
        !i.deletedAt &&
        (!type || i.type === type)
      );
  }

  async deleteInteraction(interactionId: string): Promise<void> {
    const interaction = interactions.get(interactionId);
    if (interaction) {
      interaction.deletedAt = new Date();
    }
  }

  // Follows
  async saveFollow(follow: FollowRelationship): Promise<void> {
    const key = `${follow.follower}:${follow.following}`;
    follows.set(key, follow);
    logger.debug('Follow saved', { follower: follow.follower, following: follow.following });
  }

  async findFollow(follower: string, following: string): Promise<FollowRelationship | null> {
    const key = `${follower}:${following}`;
    return follows.get(key) || null;
  }

  async deleteFollow(follower: string, following: string): Promise<void> {
    const key = `${follower}:${following}`;
    follows.delete(key);
  }

  async getFollowing(follower: string): Promise<FollowRelationship[]> {
    return Array.from(follows.values())
      .filter(f => f.follower === follower);
  }

  async getFollowers(following: string): Promise<FollowRelationship[]> {
    return Array.from(follows.values())
      .filter(f => f.following === following);
  }

  // Stats
  async getUserStats(suiAddress: string): Promise<UserSocialStats> {
    const userPosts = Array.from(posts.values())
      .filter(p => p.author === suiAddress && !p.deletedAt);
    
    const userInteractions = Array.from(interactions.values())
      .filter(i => i.user === suiAddress && !i.deletedAt);

    const postsCount = userPosts.length;
    const repliesCount = userPosts.filter(p => !!p.parentId).length;
    const likesCount = userInteractions.filter(i => i.type === 'like').length;
    const repostsCount = userInteractions.filter(i => i.type === 'repost').length;
    const quotesCount = userInteractions.filter(i => i.type === 'quote').length;
    const followersCount = (await this.getFollowers(suiAddress)).length;
    const followingCount = (await this.getFollowing(suiAddress)).length;

    return {
      suiAddress,
      posts: postsCount,
      replies: repliesCount,
      likes: likesCount,
      reposts: repostsCount,
      quotes: quotesCount,
      followers: followersCount,
      following: followingCount
    };
  }
}

export const socialRepository = new SocialRepository();
