import {
  SocialPost,
  SocialInteraction,
  SocialFeedQuery,
  UserSocialStats,
  FollowRelationship
} from '@dlux-sui/types';
import { logger } from '../utils/logger';
import { dgraphClient } from '../dgraph/client';

const inMemoryPosts = new Map<string, SocialPost>();
const inMemoryInteractions = new Map<string, SocialInteraction>();
const inMemoryFollows = new Map<string, FollowRelationship>();
const isTestEnv = (): boolean => process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID !== undefined;

function isDGraphAvailable(): boolean {
  try {
    dgraphClient.getClient();
    return true;
  } catch {
    return false;
  }
}

function useInMemory(): boolean {
  return isTestEnv() || !isDGraphAvailable();
}

export class SocialRepository {
  clearTestData(): void {
    if (isTestEnv()) {
      inMemoryPosts.clear();
      inMemoryInteractions.clear();
      inMemoryFollows.clear();
    }
  }

  // Posts
  async savePost(post: SocialPost): Promise<void> {
    if (useInMemory()) {
      inMemoryPosts.set(post.id, { ...post });
      return;
    }

    const mutation = {
      set: {
        uid: `_:${post.id}`,
        dgraph_type: 'SocialPost',
        id: post.id,
        author: post.author,
        vanityAddress: post.vanityAddress,
        content: post.content,
        contentType: post.contentType,
        dappId: post.dappId,
        parentId: post.parentId,
        quoteId: post.quoteId,
        repostId: post.repostId,
        mediaUrls: post.mediaUrls,
        tags: post.tags,
        mentions: post.mentions,
        likes: post.likes,
        dislikes: post.dislikes,
        replies: post.replies,
        reposts: post.reposts,
        quotes: post.quotes,
        signature: post.signature,
        signedAt: post.signedAt.toISOString(),
        createdAt: post.createdAt.toISOString(),
        updatedAt: post.updatedAt.toISOString(),
        deletedAt: post.deletedAt ? post.deletedAt.toISOString() : null
      }
    };

    await dgraphClient.mutate(mutation);
    logger.debug('Post saved to Dgraph', { postId: post.id });
  }

  async findPostById(id: string): Promise<SocialPost | null> {
    if (useInMemory()) {
      return inMemoryPosts.get(id) || null;
    }

    const query = `
      query post($id: string) {
        post(func: eq(id, $id)) @filter(type(SocialPost)) {
          id
          author
          vanityAddress
          content
          contentType
          dappId
          parentId
          quoteId
          repostId
          mediaUrls
          tags
          mentions
          likes
          dislikes
          replies
          reposts
          quotes
          signature
          signedAt
          createdAt
          updatedAt
          deletedAt
        }
      }
    `;

    const result = await dgraphClient.query(query, { $id: id });
    const post = result.post?.[0];

    if (!post) return null;

    return {
      ...post,
      signedAt: new Date(post.signedAt),
      createdAt: new Date(post.createdAt),
      updatedAt: new Date(post.updatedAt),
      deletedAt: post.deletedAt ? new Date(post.deletedAt) : undefined
    };
  }

  async findPosts(query: SocialFeedQuery): Promise<SocialPost[]> {
    if (useInMemory()) {
      let posts = Array.from(inMemoryPosts.values()).filter((post) => !post.deletedAt);

      if (query.author) {
        posts = posts.filter(post => post.author === query.author);
      }

      if (query.dappId) {
        posts = posts.filter(post => post.dappId === query.dappId);
      }

      if (query.parentId) {
        posts = posts.filter(post => post.parentId === query.parentId);
      }

      if (query.type) {
        switch (query.type) {
          case 'reply':
            posts = posts.filter(post => !!post.parentId);
            break;
          case 'quote':
            posts = posts.filter(post => !!post.quoteId);
            break;
          case 'repost':
            posts = posts.filter(post => !!post.repostId);
            break;
          case 'post':
            posts = posts.filter(post => !post.parentId && !post.quoteId && !post.repostId);
            break;
        }
      }

      if (query.tags && query.tags.length > 0) {
        posts = posts.filter(post => post.tags?.some(tag => query.tags!.includes(tag)));
      }

      if (query.mentions) {
        posts = posts.filter(post => post.mentions?.includes(query.mentions as string));
      }

      const sortBy = query.sortBy || 'created';
      const sortOrder = query.sortOrder || 'desc';
      posts.sort((a, b) => {
        const aVal = sortBy === 'likes'
          ? a.likes
          : sortBy === 'replies'
            ? a.replies
            : a.createdAt.getTime();
        const bVal = sortBy === 'likes'
          ? b.likes
          : sortBy === 'replies'
            ? b.replies
            : b.createdAt.getTime();
        return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
      });

      const offset = query.offset || 0;
      const limit = query.limit || 50;
      return posts.slice(offset, offset + limit);
    }

    const filterConditions = ['type(SocialPost)'];

    // Build filter conditions
    if (query.author) {
      filterConditions.push(`eq(author, "${query.author}")`);
    }

    if (query.dappId) {
      filterConditions.push(`eq(dappId, "${query.dappId}")`);
    }

    if (query.parentId) {
      filterConditions.push(`eq(parentId, "${query.parentId}")`);
    }

    if (query.type) {
      switch (query.type) {
        case 'reply':
          filterConditions.push('has(parentId)');
          break;
        case 'quote':
          filterConditions.push('has(quoteId)');
          break;
        case 'repost':
          filterConditions.push('has(repostId)');
          break;
        case 'post':
          filterConditions.push('NOT has(parentId)');
          filterConditions.push('NOT has(quoteId)');
          filterConditions.push('NOT has(repostId)');
          break;
      }
    }

    if (query.mentions) {
      // Filter posts that mention a specific user (mentions is an array field)
      filterConditions.push(`anyof(mentions, "${query.mentions}")`);
    }

    if (query.tags && query.tags.length > 0) {
      // Filter posts by tags (tags is an array field)
      const tagFilters = query.tags.map(tag => `"${tag}"`).join(', ');
      filterConditions.push(`anyof(tags, ${tagFilters})`);
    }

    // Add deleted filter
    filterConditions.push('NOT has(deletedAt)');

    const filter = filterConditions.join(' AND ');
    const sortBy = query.sortBy || 'createdAt';
    const sortOrder = (query.sortOrder || 'desc') === 'desc' ? 'orderdesc' : 'orderasc';
    const offset = query.offset || 0;
    const limit = query.limit || 50;

    const queryStr = `
      query posts($offset: int, $limit: int) {
        posts(func: type(SocialPost), ${sortOrder}: ${sortBy}, first: $limit, offset: $offset) @filter(${filter}) {
          id
          author
          vanityAddress
          content
          contentType
          dappId
          parentId
          quoteId
          repostId
          mediaUrls
          tags
          mentions
          likes
          dislikes
          replies
          reposts
          quotes
          signature
          signedAt
          createdAt
          updatedAt
        }
      }
    `;

    const result = await dgraphClient.query(queryStr, { $offset: offset, $limit: limit });

    return (result.posts || []).map((post: any) => ({
      ...post,
      signedAt: new Date(post.signedAt),
      createdAt: new Date(post.createdAt),
      updatedAt: new Date(post.updatedAt)
    }));
  }

  async countPosts(query: SocialFeedQuery): Promise<number> {
    if (useInMemory()) {
      const posts = await this.findPosts({
        ...query,
        offset: 0,
        limit: Number.MAX_SAFE_INTEGER
      });
      return posts.length;
    }

    const filterConditions = ['type(SocialPost)'];

    // Build filter conditions (same as findPosts)
    if (query.author) {
      filterConditions.push(`eq(author, "${query.author}")`);
    }

    if (query.dappId) {
      filterConditions.push(`eq(dappId, "${query.dappId}")`);
    }

    if (query.parentId) {
      filterConditions.push(`eq(parentId, "${query.parentId}")`);
    }

    if (query.type) {
      switch (query.type) {
        case 'reply':
          filterConditions.push('has(parentId)');
          break;
        case 'quote':
          filterConditions.push('has(quoteId)');
          break;
        case 'repost':
          filterConditions.push('has(repostId)');
          break;
        case 'post':
          filterConditions.push('NOT has(parentId)');
          filterConditions.push('NOT has(quoteId)');
          filterConditions.push('NOT has(repostId)');
          break;
      }
    }

    filterConditions.push('NOT has(deletedAt)');
    const filter = filterConditions.join(' AND ');

    const queryStr = `
      query countPosts {
        count(func: type(SocialPost)) @filter(${filter}) {
          count: count(uid)
        }
      }
    `;

    const result = await dgraphClient.query(queryStr);
    return result.count?.[0]?.count || 0;
  }

  async incrementPostCount(postId: string, field: keyof SocialPost): Promise<void> {
    if (useInMemory()) {
      const post = inMemoryPosts.get(postId);
      if (post && typeof post[field] === 'number') {
        inMemoryPosts.set(postId, {
          ...post,
          [field]: (post[field] as number) + 1,
          updatedAt: new Date()
        });
      }
      return;
    }

    const query = `
      query post($id: string) {
        post(func: eq(id, $id)) @filter(type(SocialPost)) {
          uid
          ${field}
        }
      }
    `;

    const result = await dgraphClient.query(query, { $id: postId });
    const post = result.post?.[0];

    if (post && typeof post[field] === 'number') {
      const mutation = {
        set: {
          uid: post.uid,
          [field]: post[field] + 1,
          updatedAt: new Date().toISOString()
        }
      };

      await dgraphClient.mutate(mutation);
      logger.debug('Post count incremented', { postId, field });
    }
  }

  async decrementPostCount(postId: string, field: keyof SocialPost): Promise<void> {
    if (useInMemory()) {
      const post = inMemoryPosts.get(postId);
      if (post && typeof post[field] === 'number') {
        const nextValue = Math.max(0, (post[field] as number) - 1);
        inMemoryPosts.set(postId, {
          ...post,
          [field]: nextValue,
          updatedAt: new Date()
        });
      }
      return;
    }

    const query = `
      query post($id: string) {
        post(func: eq(id, $id)) @filter(type(SocialPost)) {
          uid
          ${field}
        }
      }
    `;

    const result = await dgraphClient.query(query, { $id: postId });
    const post = result.post?.[0];

    if (post && typeof post[field] === 'number') {
      const mutation = {
        set: {
          uid: post.uid,
          [field]: Math.max(0, post[field] - 1),
          updatedAt: new Date().toISOString()
        }
      };

      await dgraphClient.mutate(mutation);
      logger.debug('Post count decremented', { postId, field });
    }
  }

  async findPostsByAuthors(authors: string[], limit: number, offset: number): Promise<SocialPost[]> {
    if (useInMemory()) {
      const posts = Array.from(inMemoryPosts.values())
        .filter(post => !post.deletedAt && authors.includes(post.author))
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      return posts.slice(offset, offset + limit);
    }

    const authorConditions = authors.map(author => `eq(author, "${author}")`).join(' OR ');

    const queryStr = `
      query postsByAuthors($offset: int, $limit: int) {
        posts(func: type(SocialPost), orderdesc: createdAt, first: $limit, offset: $offset) @filter(NOT has(deletedAt) AND (${authorConditions})) {
          id
          author
          vanityAddress
          content
          contentType
          dappId
          parentId
          quoteId
          repostId
          mediaUrls
          tags
          mentions
          likes
          dislikes
          replies
          reposts
          quotes
          signature
          signedAt
          createdAt
          updatedAt
        }
      }
    `;

    const result = await dgraphClient.query(queryStr, { $offset: offset, $limit: limit });

    return (result.posts || []).map((post: any) => ({
      ...post,
      signedAt: new Date(post.signedAt),
      createdAt: new Date(post.createdAt),
      updatedAt: new Date(post.updatedAt)
    }));
  }

  async countPostsByAuthors(authors: string[]): Promise<number> {
    if (useInMemory()) {
      return Array.from(inMemoryPosts.values()).filter(
        post => !post.deletedAt && authors.includes(post.author)
      ).length;
    }

    const authorConditions = authors.map(author => `eq(author, "${author}")`).join(' OR ');

    const queryStr = `
      query countPostsByAuthors {
        count(func: type(SocialPost)) @filter(NOT has(deletedAt) AND (${authorConditions})) {
          count: count(uid)
        }
      }
    `;

    const result = await dgraphClient.query(queryStr);
    return result.count?.[0]?.count || 0;
  }

  // Interactions
  async saveInteraction(interaction: SocialInteraction): Promise<void> {
    if (useInMemory()) {
      inMemoryInteractions.set(interaction.id, { ...interaction });
      return;
    }

    const mutation = {
      set: {
        uid: `_:${interaction.id}`,
        dgraph_type: 'SocialInteraction',
        id: interaction.id,
        type: interaction.type,
        user: interaction.user,
        vanityAddress: interaction.vanityAddress,
        targetId: interaction.targetId,
        targetType: interaction.targetType,
        signature: interaction.signature,
        signedAt: interaction.signedAt.toISOString(),
        createdAt: interaction.createdAt.toISOString(),
        deletedAt: interaction.deletedAt ? interaction.deletedAt.toISOString() : null
      }
    };

    await dgraphClient.mutate(mutation);
    logger.debug('Interaction saved to Dgraph', { interactionId: interaction.id });
  }

  async findInteractionById(id: string): Promise<SocialInteraction | null> {
    if (useInMemory()) {
      return inMemoryInteractions.get(id) || null;
    }

    const query = `
      query interaction($id: string) {
        interaction(func: eq(id, $id)) @filter(type(SocialInteraction)) {
          id
          type
          user
          vanityAddress
          targetId
          targetType
          signature
          signedAt
          createdAt
          deletedAt
        }
      }
    `;

    const result = await dgraphClient.query(query, { $id: id });
    const interaction = result.interaction?.[0];

    if (!interaction) return null;

    return {
      ...interaction,
      signedAt: new Date(interaction.signedAt),
      createdAt: new Date(interaction.createdAt),
      deletedAt: interaction.deletedAt ? new Date(interaction.deletedAt) : undefined
    };
  }

  async findInteraction(user: string, targetId: string, type: SocialInteraction['type']): Promise<SocialInteraction | null> {
    if (useInMemory()) {
      for (const interaction of inMemoryInteractions.values()) {
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

    const query = `
      query interaction($user: string, $targetId: string, $type: string) {
        interaction(func: type(SocialInteraction)) @filter(
          eq(user, $user) AND
          eq(targetId, $targetId) AND
          eq(type, $type) AND
          NOT has(deletedAt)
        ) {
          id
          type
          user
          vanityAddress
          targetId
          targetType
          signature
          signedAt
          createdAt
        }
      }
    `;

    const result = await dgraphClient.query(query, { $user: user, $targetId: targetId, $type: type });
    const interaction = result.interaction?.[0];

    if (!interaction) return null;

    return {
      ...interaction,
      signedAt: new Date(interaction.signedAt),
      createdAt: new Date(interaction.createdAt)
    };
  }

  async findPostInteractions(postId: string, type?: string): Promise<SocialInteraction[]> {
    if (useInMemory()) {
      let interactions = Array.from(inMemoryInteractions.values()).filter(
        interaction => interaction.targetId === postId && interaction.targetType === 'post' && !interaction.deletedAt
      );
      if (type) {
        interactions = interactions.filter(interaction => interaction.type === type);
      }
      return interactions;
    }

    let filter = `eq(targetId, "${postId}") AND eq(targetType, "post") AND NOT has(deletedAt)`;

    if (type) {
      filter += ` AND eq(type, "${type}")`;
    }

    const query = `
      query postInteractions {
        interactions(func: type(SocialInteraction)) @filter(${filter}) {
          id
          type
          user
          vanityAddress
          targetId
          targetType
          signature
          signedAt
          createdAt
        }
      }
    `;

    const result = await dgraphClient.query(query);

    return (result.interactions || []).map((interaction: any) => ({
      ...interaction,
      signedAt: new Date(interaction.signedAt),
      createdAt: new Date(interaction.createdAt)
    }));
  }

  async findInteractions(query: {
    user?: string;
    targetId?: string;
    targetType?: SocialInteraction['targetType'];
    type?: SocialInteraction['type'];
    limit?: number;
    offset?: number;
  }): Promise<SocialInteraction[]> {
    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;

    if (useInMemory()) {
      let interactions = Array.from(inMemoryInteractions.values()).filter((i) => !i.deletedAt);
      if (query.user) interactions = interactions.filter((i) => i.user === query.user);
      if (query.targetId) interactions = interactions.filter((i) => i.targetId === query.targetId);
      if (query.targetType) interactions = interactions.filter((i) => i.targetType === query.targetType);
      if (query.type) interactions = interactions.filter((i) => i.type === query.type);

      interactions.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      return interactions.slice(offset, offset + limit);
    }

    const filterConditions: string[] = ['type(SocialInteraction)', 'NOT has(deletedAt)'];
    if (query.user) filterConditions.push(`eq(user, "${query.user}")`);
    if (query.targetId) filterConditions.push(`eq(targetId, "${query.targetId}")`);
    if (query.targetType) filterConditions.push(`eq(targetType, "${query.targetType}")`);
    if (query.type) filterConditions.push(`eq(type, "${query.type}")`);
    const filter = filterConditions.join(' AND ');

    const queryStr = `
      query interactions($offset: int, $limit: int) {
        interactions(func: type(SocialInteraction), orderdesc: createdAt, first: $limit, offset: $offset) @filter(${filter}) {
          id
          type
          user
          vanityAddress
          targetId
          targetType
          signature
          signedAt
          createdAt
        }
      }
    `;

    const result = await dgraphClient.query(queryStr, { $offset: offset, $limit: limit });

    return (result.interactions || []).map((interaction: any) => ({
      ...interaction,
      signedAt: new Date(interaction.signedAt),
      createdAt: new Date(interaction.createdAt)
    }));
  }

  async countInteractions(query: {
    user?: string;
    targetId?: string;
    targetType?: SocialInteraction['targetType'];
    type?: SocialInteraction['type'];
  }): Promise<number> {
    if (useInMemory()) {
      let interactions = Array.from(inMemoryInteractions.values()).filter((i) => !i.deletedAt);
      if (query.user) interactions = interactions.filter((i) => i.user === query.user);
      if (query.targetId) interactions = interactions.filter((i) => i.targetId === query.targetId);
      if (query.targetType) interactions = interactions.filter((i) => i.targetType === query.targetType);
      if (query.type) interactions = interactions.filter((i) => i.type === query.type);
      return interactions.length;
    }

    const filterConditions: string[] = ['type(SocialInteraction)', 'NOT has(deletedAt)'];
    if (query.user) filterConditions.push(`eq(user, "${query.user}")`);
    if (query.targetId) filterConditions.push(`eq(targetId, "${query.targetId}")`);
    if (query.targetType) filterConditions.push(`eq(targetType, "${query.targetType}")`);
    if (query.type) filterConditions.push(`eq(type, "${query.type}")`);
    const filter = filterConditions.join(' AND ');

    const queryStr = `
      query countInteractions {
        count(func: type(SocialInteraction)) @filter(${filter}) {
          count: count(uid)
        }
      }
    `;

    const result = await dgraphClient.query(queryStr);
    return result.count?.[0]?.count || 0;
  }

  async deleteInteraction(interactionId: string): Promise<void> {
    if (useInMemory()) {
      const interaction = inMemoryInteractions.get(interactionId);
      if (interaction) {
        inMemoryInteractions.set(interactionId, {
          ...interaction,
          deletedAt: new Date()
        });
      }
      return;
    }

    const query = `
      query interaction($id: string) {
        interaction(func: eq(id, $id)) @filter(type(SocialInteraction)) {
          uid
        }
      }
    `;

    const result = await dgraphClient.query(query, { $id: interactionId });
    const interaction = result.interaction?.[0];

    if (interaction) {
      const mutation = {
        set: {
          uid: interaction.uid,
          deletedAt: new Date().toISOString()
        }
      };

      await dgraphClient.mutate(mutation);
      logger.debug('Interaction deleted', { interactionId });
    }
  }

  // Follows
  async saveFollow(follow: FollowRelationship): Promise<void> {
    if (useInMemory()) {
      inMemoryFollows.set(follow.id, { ...follow });
      return;
    }

    const mutation = {
      set: {
        uid: `_:${follow.id}`,
        dgraph_type: 'FollowRelationship',
        id: follow.id,
        follower: follow.follower,
        following: follow.following,
        createdAt: follow.createdAt.toISOString()
      }
    };

    await dgraphClient.mutate(mutation);
    logger.debug('Follow saved to Dgraph', { follower: follow.follower, following: follow.following });
  }

  async findFollow(follower: string, following: string): Promise<FollowRelationship | null> {
    if (useInMemory()) {
      for (const follow of inMemoryFollows.values()) {
        if (follow.follower === follower && follow.following === following) {
          return follow;
        }
      }
      return null;
    }

    const query = `
      query follow($follower: string, $following: string) {
        follow(func: type(FollowRelationship)) @filter(
          eq(follower, $follower) AND
          eq(following, $following)
        ) {
          id
          follower
          following
          createdAt
        }
      }
    `;

    const result = await dgraphClient.query(query, { $follower: follower, $following: following });
    const follow = result.follow?.[0];

    if (!follow) return null;

    return {
      ...follow,
      createdAt: new Date(follow.createdAt)
    };
  }

  async deleteFollow(follower: string, following: string): Promise<void> {
    if (useInMemory()) {
      for (const [id, follow] of inMemoryFollows.entries()) {
        if (follow.follower === follower && follow.following === following) {
          inMemoryFollows.delete(id);
          break;
        }
      }
      return;
    }

    const query = `
      query follow($follower: string, $following: string) {
        follow(func: type(FollowRelationship)) @filter(
          eq(follower, $follower) AND
          eq(following, $following)
        ) {
          uid
        }
      }
    `;

    const result = await dgraphClient.query(query, { $follower: follower, $following: following });
    const follow = result.follow?.[0];

    if (follow) {
      const mutation = {
        delete: {
          uid: follow.uid
        }
      };

      await dgraphClient.mutate(mutation);
      logger.debug('Follow deleted', { follower, following });
    }
  }

  async getFollowing(follower: string): Promise<FollowRelationship[]> {
    if (useInMemory()) {
      return Array.from(inMemoryFollows.values()).filter(follow => follow.follower === follower);
    }

    const query = `
      query following($follower: string) {
        following(func: type(FollowRelationship)) @filter(eq(follower, $follower)) {
          id
          follower
          following
          createdAt
        }
      }
    `;

    const result = await dgraphClient.query(query, { $follower: follower });

    return (result.following || []).map((follow: any) => ({
      ...follow,
      createdAt: new Date(follow.createdAt)
    }));
  }

  async getFollowers(following: string): Promise<FollowRelationship[]> {
    if (useInMemory()) {
      return Array.from(inMemoryFollows.values()).filter(follow => follow.following === following);
    }

    const query = `
      query followers($following: string) {
        followers(func: type(FollowRelationship)) @filter(eq(following, $following)) {
          id
          follower
          following
          createdAt
        }
      }
    `;

    const result = await dgraphClient.query(query, { $following: following });

    return (result.followers || []).map((follow: any) => ({
      ...follow,
      createdAt: new Date(follow.createdAt)
    }));
  }

  // Stats
  async getUserStats(suiAddress: string): Promise<UserSocialStats> {
    if (useInMemory()) {
      const posts = Array.from(inMemoryPosts.values()).filter(
        post => post.author === suiAddress && !post.deletedAt
      );
      const replies = posts.filter(post => !!post.parentId).length;
      const likes = Array.from(inMemoryInteractions.values()).filter(
        interaction => interaction.user === suiAddress && interaction.type === 'like' && !interaction.deletedAt
      ).length;
      const reposts = Array.from(inMemoryInteractions.values()).filter(
        interaction => interaction.user === suiAddress && interaction.type === 'repost' && !interaction.deletedAt
      ).length;
      const quotes = Array.from(inMemoryInteractions.values()).filter(
        interaction => interaction.user === suiAddress && interaction.type === 'quote' && !interaction.deletedAt
      ).length;
      const followers = Array.from(inMemoryFollows.values()).filter(
        follow => follow.following === suiAddress
      ).length;
      const following = Array.from(inMemoryFollows.values()).filter(
        follow => follow.follower === suiAddress
      ).length;

      return {
        suiAddress,
        posts: posts.length,
        replies,
        likes,
        reposts,
        quotes,
        followers,
        following
      };
    }

    // Query for posts count and breakdown
    const postsQuery = `
      query userPosts($suiAddress: string) {
        totalPosts: count(func: type(SocialPost)) @filter(eq(author, $suiAddress) AND NOT has(deletedAt))
        replies: count(func: type(SocialPost)) @filter(eq(author, $suiAddress) AND has(parentId) AND NOT has(deletedAt))
      }
    `;

    const postsResult = await dgraphClient.query(postsQuery, { $suiAddress: suiAddress });

    // Query for interaction counts
    const interactionsQuery = `
      query userInteractions($suiAddress: string) {
        likes: count(func: type(SocialInteraction)) @filter(eq(user, $suiAddress) AND eq(type, "like") AND NOT has(deletedAt))
        reposts: count(func: type(SocialInteraction)) @filter(eq(user, $suiAddress) AND eq(type, "repost") AND NOT has(deletedAt))
        quotes: count(func: type(SocialInteraction)) @filter(eq(user, $suiAddress) AND eq(type, "quote") AND NOT has(deletedAt))
      }
    `;

    const interactionsResult = await dgraphClient.query(interactionsQuery, { $suiAddress: suiAddress });

    const followersCount = (await this.getFollowers(suiAddress)).length;
    const followingCount = (await this.getFollowing(suiAddress)).length;

    return {
      suiAddress,
      posts: postsResult.totalPosts?.[0]?.count || 0,
      replies: postsResult.replies?.[0]?.count || 0,
      likes: interactionsResult.likes?.[0]?.count || 0,
      reposts: interactionsResult.reposts?.[0]?.count || 0,
      quotes: interactionsResult.quotes?.[0]?.count || 0,
      followers: followersCount,
      following: followingCount
    };
  }
}

export const socialRepository = new SocialRepository();
