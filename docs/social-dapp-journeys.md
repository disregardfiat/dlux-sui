# Social dApp Interaction Journeys

## Overview

This document describes the complete user journeys for social interactions with dApps on the DLUX platform, covering reviews, comments, feedback, likes, dislikes, and other engagement features.

## Table of Contents

1. [Review Journey - Creating dApp Reviews](#review-journey)
2. [Comment Journey - Commenting on dApps](#comment-journey)
3. [Feedback Journey - Likes, Dislikes, and Reactions](#feedback-journey)
4. [Social Discovery Journey - Finding and Following](#social-discovery-journey)
5. [Engagement Journey - Reposts, Quotes, and Shares](#engagement-journey)

---

## Review Journey - Creating dApp Reviews

### Overview

This journey covers how users create reviews for dApps, providing detailed feedback and ratings.

### Step-by-Step Flow

#### 1. Discover dApp to Review

**Access Points:**
- User views a dApp they've used
- User navigates to dApp detail page
- User clicks "Write Review" button
- User views dApp in sandbox and decides to review

#### 2. Access Review Interface

**Review Entry Points:**
- dApp detail page → "Reviews" tab → "Write Review"
- After using dApp → Prompt: "How was your experience?"
- Profile → "My Reviews" → "Write New Review"

**Review Form Displayed:**
- dApp information (title, author, thumbnail)
- Review input fields
- Rating selector
- Media upload option

#### 3. Write Review

**Review Components:**

1. **Rating (Required):**
   - Star rating: 1-5 stars
   - Or thumbs up/down (simplified)
   - Visual rating selector

2. **Review Text (Optional but Recommended):**
   - Text area for detailed feedback
   - Markdown support for formatting
   - Character limit: 5000 characters
   - Preview option

3. **Categories (Optional):**
   - Select review categories:
     - Functionality
     - Design
     - Performance
     - Security
     - User Experience
   - Can select multiple

4. **Media (Optional):**
   - Upload screenshots
   - Upload videos
   - Link to external content
   - Media stored in Walrus

5. **Tags (Optional):**
   - Add hashtags
   - Mention other users
   - Link to related dApps

**Review Creation Process:**

```typescript
// User fills review form
const reviewData = {
  dappId: 'dapp_123',
  rating: 5, // 1-5 stars
  title: 'Amazing dApp!',
  content: 'This dApp is fantastic...',
  categories: ['functionality', 'design'],
  mediaUrls: ['walrus://blob_123'],
  tags: ['#web3', '#gaming'],
};

// Sign review message
const message = JSON.stringify({
  action: 'createReview',
  user: userAddress,
  dappId: reviewData.dappId,
  rating: reviewData.rating,
  timestamp: Date.now(),
});

const signature = await wallet.signMessage(message);

// Submit to DGraph service
await dgraphService.post('/social/reviews', {
  ...reviewData,
  signature,
  signedAt: new Date(),
});
```

#### 4. Submit Review

**Submission Process:**

1. **Client-Side Validation:**
   - Rating is required
   - Content length check
   - Media size/format validation

2. **Sign Review:**
   - Create signable message
   - User signs with SUI wallet
   - Signature generated

3. **Submit to DGraph:**
   - POST to `/social/reviews`
   - Review stored in DGraph
   - Signature verified
   - Review indexed immediately

4. **Confirmation:**
   - Review appears immediately
   - User sees confirmation message
   - Review added to dApp's review list

**Off-Chain Storage:**
- Review stored in DGraph (not on-chain)
- Signed but not broadcast to SUI
- Gas-free operation
- Fast, real-time updates

#### 5. Review Published

**Review Display:**
- Appears in dApp's "Reviews" section
- Shows rating, content, author
- Shows timestamp
- Shows helpful/not helpful counts
- Can be liked/disliked by others

**Review Features:**
- **Edit**: Author can edit their review
- **Delete**: Author can delete their review
- **Report**: Others can report inappropriate reviews
- **Reply**: Author can reply to comments on their review

---

## Comment Journey - Commenting on dApps

### Overview

This journey covers how users comment on dApps, creating threaded discussions.

### Step-by-Step Flow

#### 1. Access Comment Interface

**Comment Entry Points:**
- dApp detail page → "Comments" section
- Review detail page → "Add Comment"
- Another comment → "Reply" button

**Comment Form:**
- Text input area
- Markdown support
- Media upload option
- Mention users (@username)
- Preview option

#### 2. Write Comment

**Comment Types:**

1. **Top-Level Comment:**
   - Direct comment on dApp
   - No parent comment
   - Appears in main comment thread

2. **Reply Comment:**
   - Reply to another comment
   - Has parent comment ID
   - Appears nested under parent
   - Creates threaded discussion

**Comment Creation:**

```typescript
// User writes comment
const commentData = {
  dappId: 'dapp_123',
  parentId: null, // null for top-level, or parent comment ID
  content: 'Great dApp! I love the design.',
  mentions: ['@user_456'], // Optional user mentions
  mediaUrls: [], // Optional media
};

// Sign comment
const message = JSON.stringify({
  action: 'createComment',
  user: userAddress,
  dappId: commentData.dappId,
  parentId: commentData.parentId,
  timestamp: Date.now(),
});

const signature = await wallet.signMessage(message);

// Submit to DGraph
await dgraphService.post('/social/comments', {
  ...commentData,
  signature,
  signedAt: new Date(),
});
```

#### 3. Submit Comment

**Submission Process:**

1. **Client Validation:**
   - Content not empty
   - Content length check
   - Mention validation

2. **Sign Comment:**
   - Create signable message
   - User signs with wallet
   - Signature generated

3. **Submit to DGraph:**
   - POST to `/social/comments`
   - Comment stored
   - Signature verified
   - Thread structure maintained

4. **Real-Time Update:**
   - Comment appears immediately
   - Thread structure updated
   - Reply count incremented

#### 4. Comment Published

**Comment Display:**
- Appears in comment thread
- Shows author, content, timestamp
- Shows like/dislike counts
- Shows reply count
- Can be replied to, liked, or reported

**Thread Structure:**
```
dApp
├── Comment 1 (top-level)
│   ├── Reply 1.1
│   │   └── Reply 1.1.1
│   └── Reply 1.2
├── Comment 2 (top-level)
│   └── Reply 2.1
└── Comment 3 (top-level)
```

---

## Feedback Journey - Likes, Dislikes, and Reactions

### Overview

This journey covers how users provide quick feedback through likes, dislikes, and other reactions.

### Step-by-Step Flow

#### 1. View Content

**Content Types:**
- dApps
- Reviews
- Comments
- Posts
- User profiles

**Interaction Buttons:**
- Like button (thumbs up)
- Dislike button (thumbs down)
- Reaction picker (for extended reactions)

#### 2. Provide Feedback

**Like/Dislike Flow:**

1. **User Clicks Like/Dislike:**
   ```typescript
   // User clicks like button on dApp
   const interactionData = {
     type: 'like', // or 'dislike'
     targetId: 'dapp_123',
     targetType: 'dapp', // 'dapp', 'review', 'comment', 'post'
   };
   ```

2. **Sign Interaction:**
   ```typescript
   const message = JSON.stringify({
     action: 'createInteraction',
     user: userAddress,
     type: interactionData.type,
     targetId: interactionData.targetId,
     targetType: interactionData.targetType,
     timestamp: Date.now(),
   });
   
   const signature = await wallet.signMessage(message);
   ```

3. **Submit to DGraph:**
   ```typescript
   await dgraphService.post('/social/interactions', {
     ...interactionData,
     signature,
     signedAt: new Date(),
   });
   ```

4. **Immediate Update:**
   - Like/dislike count updates
   - Button state changes (filled/unfilled)
   - User's interaction recorded

**Interaction Types:**
- **Like**: Positive feedback
- **Dislike**: Negative feedback
- **Repost**: Share content
- **Quote**: Share with commentary
- **Reply**: Respond to content

#### 3. Undo Feedback

**Undo Process:**

1. **User Clicks Again:**
   - If already liked, clicking again removes like
   - If already disliked, clicking again removes dislike
   - Toggle behavior

2. **Delete Interaction:**
   ```typescript
   // Find existing interaction
   const interaction = await dgraphService.get(
     `/social/interactions?user=${userAddress}&targetId=${targetId}&type=${type}`
   );
   
   // Delete interaction
   await dgraphService.delete(`/social/interactions/${interaction.id}`, {
     data: {
       user: userAddress,
       signature: await wallet.signMessage(deleteMessage),
     },
   });
   ```

3. **Count Updated:**
   - Like/dislike count decremented
   - Button state reset
   - Interaction removed

#### 4. View Engagement Metrics

**Metrics Displayed:**
- **Likes**: Total likes count
- **Dislikes**: Total dislikes count
- **Net Score**: Likes - Dislikes
- **Your Interaction**: Shows if user has liked/disliked
- **Engagement Rate**: Calculated from views/interactions

---

## Social Discovery Journey - Finding and Following

### Overview

This journey covers how users discover dApps and creators, and build social connections.

### Step-by-Step Flow

#### 1. Discover dApps

**Discovery Methods:**

1. **Feed:**
   - Home feed with trending dApps
   - Following feed (dApps from followed creators)
   - Algorithmic recommendations

2. **Search:**
   - Search by name, category, tags
   - Filter by category, rating, date
   - Sort by relevance, popularity, date

3. **Categories:**
   - Browse by category (Gaming, Social, Finance, etc.)
   - View category pages
   - See top dApps in category

4. **User Profiles:**
   - View creator's dApps
   - See their published content
   - Follow to see future dApps

#### 2. View dApp Details

**dApp Information:**
- Title, description, thumbnail
- Author information
- Category and tags
- Ratings and reviews
- Social engagement (likes, comments)
- Safety status
- Installation count

**Social Context:**
- Author's profile link
- Author's other dApps
- Related dApps
- Users who liked this dApp
- Recent comments and reviews

#### 3. Follow Creators

**Follow Process:**

1. **View Creator Profile:**
   - Click on author name
   - Navigate to profile page
   - See their dApps and activity

2. **Click Follow:**
   ```typescript
   const followData = {
     following: creatorAddress,
     follower: userAddress,
   };
   
   const message = JSON.stringify({
     action: 'follow',
     follower: followData.follower,
     following: followData.following,
     timestamp: Date.now(),
   });
   
   const signature = await wallet.signMessage(message);
   
   await dgraphService.post('/social/follows', {
     ...followData,
     signature,
     signedAt: new Date(),
   });
   ```

3. **Follow Confirmed:**
   - Follow relationship created
   - Creator's dApps appear in following feed
   - Follow count updated
   - Button changes to "Following"

#### 4. Build Social Graph

**Social Connections:**
- **Following**: Users you follow
- **Followers**: Users who follow you
- **Mutual Follows**: Users you both follow
- **Suggested**: Recommended users to follow

**Social Features:**
- View followers/following lists
- See mutual connections
- Get follow suggestions
- Manage follow relationships

---

## Engagement Journey - Reposts, Quotes, and Shares

### Overview

This journey covers how users share and amplify dApp content through reposts, quotes, and other sharing mechanisms.

### Step-by-Step Flow

#### 1. Share dApp

**Share Options:**

1. **Repost:**
   - Simple share without commentary
   - Appears in user's feed
   - Links back to original dApp

2. **Quote:**
   - Share with user's commentary
   - Creates new post with quote reference
   - User adds their thoughts

3. **External Share:**
   - Share to external platforms
   - Copy link
   - Embed code

#### 2. Create Repost

**Repost Process:**

```typescript
// User clicks "Repost" on dApp
const repostData = {
  type: 'repost',
  targetId: 'dapp_123',
  targetType: 'dapp',
};

const message = JSON.stringify({
  action: 'createInteraction',
  user: userAddress,
  type: 'repost',
  targetId: repostData.targetId,
  timestamp: Date.now(),
});

const signature = await wallet.signMessage(message);

await dgraphService.post('/social/interactions', {
  ...repostData,
  signature,
  signedAt: new Date(),
});
```

**Repost Result:**
- Repost appears in user's feed
- Original dApp repost count incremented
- Repost links to original dApp
- Others can see who reposted

#### 3. Create Quote

**Quote Process:**

```typescript
// User clicks "Quote" on dApp
const quoteData = {
  type: 'quote',
  targetId: 'dapp_123',
  targetType: 'dapp',
  content: 'Check out this amazing dApp!', // User's commentary
};

// Create post with quote reference
const postData = {
  content: quoteData.content,
  quoteId: quoteData.targetId,
  author: userAddress,
};

const message = JSON.stringify({
  action: 'createPost',
  user: userAddress,
  content: postData.content,
  quoteId: postData.quoteId,
  timestamp: Date.now(),
});

const signature = await wallet.signMessage(message);

await dgraphService.post('/social/posts', {
  ...postData,
  signature,
  signedAt: new Date(),
});
```

**Quote Result:**
- New post created with quote
- Original dApp quote count incremented
- Quote shows original dApp preview
- User's commentary displayed

#### 4. External Sharing

**Share Options:**

1. **Copy Link:**
   - Generate shareable link
   - Copy to clipboard
   - Share anywhere

2. **Social Media:**
   - Share to Twitter/X
   - Share to Facebook
   - Share to LinkedIn
   - Custom share dialog

3. **Embed:**
   - Generate embed code
   - Embed in websites
   - Customizable embed options

---

## Complete Social Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         DISCOVER DAPP                                    │
│                                                                          │
│  User → Browse Feed → Search → View dApp → See Details                  │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    │               │               │
                    ▼               ▼               ▼
        ┌───────────────┐  ┌───────────────┐  ┌───────────────┐
        │   LIKE/DISLIKE │  │    COMMENT    │  │    REVIEW     │
        │                │  │               │  │               │
        │  Quick Feedback│  │  Threaded Disc │  │  Detailed Rate│
        └───────────────┘  └───────────────┘  └───────────────┘
                    │               │               │
                    └───────────────┼───────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         ENGAGE & SHARE                                   │
│                                                                          │
│  User → Repost → Quote → Follow Creator → Build Social Graph            │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Key Technical Components

### Off-Chain Storage (DGraph)

**Social Data Types:**
- `SocialPost`: Posts, reviews, quotes
- `SocialInteraction`: Likes, dislikes, reposts
- `SocialComment`: Comments and replies
- `FollowRelationship`: User follows

**Storage Strategy:**
- All social data stored in DGraph
- Signed but NOT broadcast to SUI
- Gas-free operations
- Real-time updates
- Rich querying capabilities

### API Endpoints

**DGraph Service:**
- `POST /social/posts` - Create post/review
- `GET /social/posts` - Query posts
- `POST /social/comments` - Create comment
- `GET /social/comments` - Get comments
- `POST /social/interactions` - Like/dislike/repost
- `GET /social/interactions` - Get interactions
- `POST /social/follows` - Follow user
- `GET /social/follows` - Get follow relationships

### Signature Verification

**All Social Actions:**
- Must be signed with SUI wallet
- Signature verified server-side
- Prevents spam and abuse
- Maintains authenticity
- No gas fees (not broadcast)

---

## Related Documentation

- [Architecture Overview](./architecture-overview.md) - System architecture
- [Developer Guide](./developer-guide.md) - API reference
- [Social Blockchain](./architecture-overview.md#social-blockchain--ecosystem-federation) - Social data ordering

## E2E Coverage

| Journey | Spec | Browser |
|---------|------|---------|
| Social feed (browser) | `social-journey-browser.spec.ts` | yes |
| Social posts API | `social-posts.spec.ts` | no (API) |
| Social interactions API | `social-interactions.spec.ts` | no (API) |
| Social on PM thread | `social-pm-thread.spec.ts` | no (API+wallet) |
| Content creation | `content-creation-full.spec.ts` | yes |
