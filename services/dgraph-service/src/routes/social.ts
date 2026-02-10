import express from 'express';
import { logger } from '../utils/logger';
import { socialService } from '../services/socialService';
import { sameParty } from '../middleware/auth';
import type { CreatePostRequest, CreateInteractionRequest, SocialFeedQuery, CreateFollowRequest } from '@dlux-sui/types';

const router = express.Router();

// Create a post
router.post('/posts', async (req, res) => {
  try {
    const postData: CreatePostRequest = req.body;
    
    if (!postData.author || !postData.content) {
      return res.status(400).json({ error: 'Author and content are required' });
    }

    // Check if JWT auth is available and matches the author
    const hasJWT = req.auth && sameParty(req.auth.suiAddress, postData.author);
    
    // Signature is required if no valid JWT
    if (!hasJWT && !postData.signature) {
      return res.status(400).json({ error: 'Signature is required when JWT is not provided' });
    }

    const post = await socialService.createPost(postData, hasJWT ? req.auth!.suiAddress : undefined);
    res.status(201).json(post);

  } catch (error: any) {
    logger.error('Error creating post', error);
    if (error?.message === 'Invalid signature') {
      return res.status(401).json({ error: 'Invalid signature' });
    }
    if (error?.message === 'Unauthorized') {
      return res.status(403).json({ error: 'JWT address does not match author' });
    }
    res.status(500).json({ error: error.message || 'Failed to create post' });
  }
});

// Get post by ID
router.get('/posts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const post = await socialService.getPost(id);

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    res.json(post);

  } catch (error: any) {
    logger.error('Error getting post', error);
    res.status(500).json({ error: error.message || 'Failed to get post' });
  }
});

// Get feed
router.get('/posts', async (req, res) => {
  try {
    const query: SocialFeedQuery = {
      author: req.query.author as string,
      dappId: req.query.dappId as string,
      tags: req.query.tags ? (req.query.tags as string).split(',') : undefined,
      mentions: req.query.mentions as string,
      parentId: req.query.parentId as string,
      type: req.query.type as any,
      limit: parseInt(req.query.limit as string) || 50,
      offset: parseInt(req.query.offset as string) || 0,
      sortBy: (req.query.sortBy as any) || 'created',
      sortOrder: (req.query.sortOrder as any) || 'desc'
    };

    const result = await socialService.getFeed(query);
    res.json(result);

  } catch (error: any) {
    logger.error('Error getting feed', error);
    res.status(500).json({ error: error.message || 'Failed to get feed' });
  }
});

// Create interaction (like, dislike, repost, quote, reply)
router.post('/interactions', async (req, res) => {
  try {
    const interactionData: CreateInteractionRequest = req.body;

    if (!interactionData.user || !interactionData.type || !interactionData.targetId) {
      return res.status(400).json({ error: 'User, type, and targetId are required' });
    }

    // Check if JWT auth is available and matches the user
    const hasJWT = req.auth && sameParty(req.auth.suiAddress, interactionData.user);
    
    // Signature is required if no valid JWT
    if (!hasJWT && !interactionData.signature) {
      return res.status(400).json({ error: 'Signature is required when JWT is not provided' });
    }

    // Signature verification is handled in socialService
    const interaction = await socialService.createInteraction(interactionData, hasJWT ? req.auth!.suiAddress : undefined);
    res.status(201).json(interaction);

  } catch (error: any) {
    logger.error('Error creating interaction', error);
    if (error?.message === 'Invalid signature') {
      return res.status(401).json({ error: 'Invalid signature' });
    }
    if (error?.message === 'Unauthorized') {
      return res.status(403).json({ error: 'JWT address does not match user' });
    }
    res.status(500).json({ error: error.message || 'Failed to create interaction' });
  }
});

// Get interactions (with filters)
router.get('/interactions', async (req, res) => {
  try {
    const user = typeof req.query.user === 'string' ? req.query.user : undefined;
    const targetId = typeof req.query.targetId === 'string' ? req.query.targetId : undefined;
    const targetType = typeof req.query.targetType === 'string' ? (req.query.targetType as any) : undefined;
    const type = typeof req.query.type === 'string' ? (req.query.type as any) : undefined;
    const limit = typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) : 50;
    const offset = typeof req.query.offset === 'string' ? parseInt(req.query.offset, 10) : 0;

    const result = await socialService.getInteractions({
      user,
      targetId,
      targetType,
      type,
      limit: Number.isFinite(limit) ? limit : 50,
      offset: Number.isFinite(offset) ? offset : 0
    });

    res.json(result);
  } catch (error: any) {
    logger.error('Error getting interactions', error);
    res.status(500).json({ error: error.message || 'Failed to get interactions' });
  }
});

// Delete interaction (undo like, etc.)
router.delete('/interactions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { user, signature } = req.body;

    if (!user) {
      return res.status(400).json({ error: 'User is required' });
    }

    // Check if JWT auth is available and matches the user
    const hasJWT = req.auth && sameParty(req.auth.suiAddress, user);
    
    // Signature is required if no valid JWT
    if (!hasJWT && !signature) {
      return res.status(400).json({ error: 'Signature is required when JWT is not provided' });
    }

    // Verify authorization (JWT or signature)
    await socialService.deleteInteraction(id, user, hasJWT ? req.auth!.suiAddress : undefined);
    res.json({ success: true });

  } catch (error: any) {
    logger.error('Error deleting interaction', error);
    if (error?.message === 'Unauthorized') {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    res.status(500).json({ error: error.message || 'Failed to delete interaction' });
  }
});

// Get interactions for a post
router.get('/posts/:postId/interactions', async (req, res) => {
  try {
    const { postId } = req.params;
    const type = req.query.type as string;

    const interactions = await socialService.getPostInteractions(postId, type);
    res.json({ interactions });

  } catch (error: any) {
    logger.error('Error getting interactions', error);
    res.status(500).json({ error: error.message || 'Failed to get interactions' });
  }
});

// Follow user
router.post('/follow', async (req, res) => {
  try {
    const followData: CreateFollowRequest = req.body;

    if (!followData.follower || !followData.following) {
      return res.status(400).json({ error: 'Follower and following are required' });
    }

    // Check if JWT auth is available and matches the follower
    const hasJWT = req.auth && sameParty(req.auth.suiAddress, followData.follower);
    
    // Signature is required if no valid JWT
    if (!hasJWT && !followData.signature) {
      return res.status(400).json({ error: 'Signature is required when JWT is not provided' });
    }

    const follow = await socialService.createFollow(followData, hasJWT ? req.auth!.suiAddress : undefined);
    res.status(201).json(follow);

  } catch (error: any) {
    logger.error('Error creating follow', error);
    if (error?.message === 'Unauthorized') {
      return res.status(403).json({ error: 'JWT address does not match follower' });
    }
    res.status(500).json({ error: error.message || 'Failed to create follow' });
  }
});

// Unfollow user
router.delete('/follow/:following', async (req, res) => {
  try {
    const { following } = req.params;
    const { follower, signature } = req.body;

    if (!follower) {
      return res.status(400).json({ error: 'Follower is required' });
    }

    // Check if JWT auth is available and matches the follower
    const hasJWT = req.auth && sameParty(req.auth.suiAddress, follower);
    
    // Signature is required if no valid JWT
    if (!hasJWT && !signature) {
      return res.status(400).json({ error: 'Signature is required when JWT is not provided' });
    }

    await socialService.deleteFollow(follower, following, hasJWT ? req.auth!.suiAddress : undefined);
    res.json({ success: true });

  } catch (error: any) {
    logger.error('Error deleting follow', error);
    if (error?.message === 'Unauthorized') {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    res.status(500).json({ error: error.message || 'Failed to delete follow' });
  }
});

// Get user social stats
router.get('/users/:suiAddress/stats', async (req, res) => {
  try {
    const { suiAddress } = req.params;
    const stats = await socialService.getUserStats(suiAddress);
    res.json(stats);

  } catch (error: any) {
    logger.error('Error getting user stats', error);
    res.status(500).json({ error: error.message || 'Failed to get user stats' });
  }
});

// Get user feed (posts from followed users)
router.get('/users/:suiAddress/feed', async (req, res) => {
  try {
    const { suiAddress } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const result = await socialService.getUserFeed(suiAddress, limit, offset);
    res.json(result);

  } catch (error: any) {
    logger.error('Error getting user feed', error);
    res.status(500).json({ error: error.message || 'Failed to get user feed' });
  }
});

export { router as socialRouter };
