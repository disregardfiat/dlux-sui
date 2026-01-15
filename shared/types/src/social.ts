/**
 * Social interaction types for DGraph storage
 * These are signed but NOT broadcast to SUI blockchain
 */

export interface SocialPost {
  id: string;                      // Unique post ID (generated)
  author: string;                   // SUI address of author
  vanityAddress?: string;           // Optional vanity address
  content: string;                  // Post content (markdown supported)
  contentType: 'text' | 'markdown' | 'html';
  
  // References
  dappId?: string;                  // Optional dApp reference
  parentId?: string;                // For replies (parent post ID)
  quoteId?: string;                 // For quotes (quoted post ID)
  repostId?: string;                // For reposts (original post ID)
  
  // Media
  mediaUrls?: string[];             // Media attachments (Walrus blob IDs)
  
  // Engagement
  likes: number;
  dislikes: number;
  replies: number;
  reposts: number;
  quotes: number;
  
  // Metadata
  tags?: string[];                  // Hashtags
  mentions?: string[];              // Mentioned users (SUI addresses)
  
  // Signature
  signature: string;                // SUI signature of the post
  signedAt: Date;                   // When signature was created
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;                 // Soft delete
}

export interface SocialInteraction {
  id: string;                       // Unique interaction ID
  type: SocialInteractionType;
  user: string;                     // SUI address of user
  vanityAddress?: string;           // Optional vanity address
  
  // Target
  targetId: string;                 // Post ID being interacted with
  targetType: 'post' | 'dapp' | 'profile';
  
  // Signature
  signature: string;                // SUI signature
  signedAt: Date;
  
  // Timestamps
  createdAt: Date;
  deletedAt?: Date;                 // For undo actions
}

export type SocialInteractionType =
  | 'like'
  | 'dislike'
  | 'repost'
  | 'quote'
  | 'reply';

export interface CreatePostRequest {
  author: string;                    // SUI address
  content: string;
  contentType?: 'text' | 'markdown' | 'html';
  dappId?: string;
  parentId?: string;                 // For replies
  quoteId?: string;                  // For quotes
  repostId?: string;                 // For reposts
  mediaUrls?: string[];
  tags?: string[];
  mentions?: string[];
  signature: string;                 // Signed message
}

export interface CreateInteractionRequest {
  user: string;                      // SUI address
  type: SocialInteractionType;
  targetId: string;
  targetType: 'post' | 'dapp' | 'profile';
  signature: string;                 // Signed message
}

export interface SocialFeedQuery {
  author?: string;                   // Filter by author
  dappId?: string;                   // Filter by dApp
  tags?: string[];                   // Filter by tags
  mentions?: string;                 // Filter by mentions
  parentId?: string;                 // Get replies to a post
  type?: 'post' | 'reply' | 'quote' | 'repost';
  limit?: number;
  offset?: number;
  sortBy?: 'created' | 'likes' | 'replies';
  sortOrder?: 'asc' | 'desc';
}

export interface SocialFeedResult {
  posts: SocialPost[];
  total: number;
  hasMore: boolean;
}

export interface UserSocialStats {
  suiAddress: string;
  vanityAddress?: string;
  posts: number;
  replies: number;
  likes: number;
  reposts: number;
  quotes: number;
  followers: number;
  following: number;
}

export interface FollowRelationship {
  id: string;
  follower: string;                  // SUI address of follower
  following: string;                // SUI address of followed user
  createdAt: Date;
}

export interface CreateFollowRequest {
  follower: string;                  // SUI address
  following: string;                 // SUI address
  signature: string;                 // Signed message
}
