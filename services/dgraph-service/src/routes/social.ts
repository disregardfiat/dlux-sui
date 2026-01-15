import express from 'express';
import { logger } from '../utils/logger';
import { socialService } from '../services/socialService';
import type { CreatePostRequest, CreateInteractionRequest, SocialFeedQuery, CreateFollowRequest } from '@dlux-sui/types';

const router = express.Router();

// Create a post
router.post('/posts', async (req, res) => {
  try {
    const postData: CreatePostRequest = req.body;
    
    if (!postData.author || !postData.content || !postData.signature) {
      return res.status(400).json({ error: 'Author, content, and signature are required' });
    }

    // TODO: Verify signature (but don't broadcast to SUI)
    // const isValid = await verifySignature(postData.author, postData.content, postData.signature);
    // if (!isValid) {
    //   return res.status(401).json({ error: 'Invalid signature' });
    // }

    const post = await socialService.createPost(postData);
    res.status(201).json(post);

  } catch (error: any) {
    logger.error('Error creating post', error);
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

    if (!interactionData.user || !interactionData.type || !interactionData.targetId || !interactionData.signature) {
      return res.status(400).json({ error: 'User, type, targetId, and signature are required' });
    }

    // Signature verification is handled in socialService
    const interaction = await socialService.createInteraction(interactionData);
    res.status(201).json(interaction);

  } catch (error: any) {
    logger.error('Error creating interaction', error);
    res.status(500).json({ error: error.message || 'Failed to create interaction' });
  }
});

// Delete interaction (undo like, etc.)
router.delete('/interactions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { user, signature } = req.body;

    if (!user || !signature) {
      return res.status(400).json({ error: 'User and signature are required' });
    }

    // TODO: Verify signature
    await socialService.deleteInteraction(id, user);
    res.json({ success: true });

  } catch (error: any) {
    logger.error('Error deleting interaction', error);
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

    if (!followData.follower || !followData.following || !followData.signature) {
      return res.status(400).json({ error: 'Follower, following, and signature are required' });
    }

    // TODO: Verify signature
    const follow = await socialService.createFollow(followData);
    res.status(201).json(follow);

  } catch (error: any) {
    logger.error('Error creating follow', error);
    res.status(500).json({ error: error.message || 'Failed to create follow' });
  }
});

// Unfollow user
router.delete('/follow/:following', async (req, res) => {
  try {
    const { following } = req.params;
    const { follower, signature } = req.body;

    if (!follower || !signature) {
      return res.status(400).json({ error: 'Follower and signature are required' });
    }

    // TODO: Verify signature
    await socialService.deleteFollow(follower, following);
    res.json({ success: true });

  } catch (error: any) {
    logger.error('Error deleting follow', error);
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
