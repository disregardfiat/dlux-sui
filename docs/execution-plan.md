# TDD Execution Plan - DLUX-SUI Core Features

## Overview

This document outlines a Test-Driven Development (TDD) execution plan to implement core user journeys for DLUX-SUI. The plan focuses on making features work end-to-end, deploying to the MCP-SSH server, and testing with a local browser.

## User Journeys Selected

1. **Connect Wallet & Authenticate** - User connects SUI wallet and authenticates
2. **Purchase Vanity Address** - User purchases a vanity address (@username)
3. **Link ZK Account** - User links GitHub/Gmail/Facebook account via ZK proof
4. **Create a Post** - User creates a social post
5. **View Feed** - User views their social feed
6. **View Account** - User views their own or another user's account

## Test-Driven Development Approach

### TDD Cycle
1. **Red**: Write failing test
2. **Green**: Write minimal code to pass test
3. **Refactor**: Improve code while keeping tests green
4. **Repeat**: Move to next test

### Test Structure
- **Unit Tests**: Individual functions/services
- **Integration Tests**: API endpoints with test database
- **E2E Tests**: Full user journeys (browser-based)

## Execution Plan

### Phase 1: Foundation & Authentication (Day 1)

#### 1.1 Setup Testing Infrastructure
**Tasks:**
- [ ] Install testing dependencies (Vitest, Playwright, Supertest)
- [ ] Configure test environment
- [ ] Setup test database/mocks
- [ ] Create test utilities and factories

**Tests:**
```typescript
// tests/setup.test.ts
describe('Test Setup', () => {
  it('should have test environment configured', () => {
    expect(process.env.NODE_ENV).toBe('test')
  })
})
```

#### 1.2 Wallet Connection & Authentication
**User Journey:** User connects SUI wallet and authenticates

**Tests (Write First):**
```typescript
// services/sui-service/tests/auth.test.ts
describe('Authentication', () => {
  describe('POST /auth/challenge', () => {
    it('should generate authentication challenge', async () => {
      const res = await request(app)
        .post('/auth/challenge')
        .send({ suiAddress: '0x123...' })
      
      expect(res.status).toBe(200)
      expect(res.body).toHaveProperty('challenge')
      expect(res.body).toHaveProperty('expiresAt')
    })
  })

  describe('POST /auth/zk-login', () => {
    it('should authenticate user with valid signature', async () => {
      const challenge = await getChallenge('0x123...')
      const signature = await signChallenge(challenge)
      
      const res = await request(app)
        .post('/auth/zk-login')
        .send({
          suiAddress: '0x123...',
          signature,
          challenge
        })
      
      expect(res.status).toBe(200)
      expect(res.body).toHaveProperty('token')
      expect(res.body).toHaveProperty('user')
    })

    it('should reject invalid signature', async () => {
      const res = await request(app)
        .post('/auth/zk-login')
        .send({
          suiAddress: '0x123...',
          signature: 'invalid-signature',
          challenge: 'test-challenge'
        })
      
      expect(res.status).toBe(401)
    })
  })
})
```

**Implementation:**
- [ ] Implement challenge generation
- [ ] Implement signature verification
- [ ] Implement JWT token generation
- [ ] Add frontend wallet connection UI
- [ ] Connect frontend to auth API

**E2E Test:**
```typescript
// e2e/auth.spec.ts
test('user can connect wallet and authenticate', async ({ page }) => {
  await page.goto('https://test.dlux.io')
  await page.click('text=Connect Wallet')
  // Mock wallet interaction
  await page.click('text=Connect')
  await expect(page.locator('text=Connected')).toBeVisible()
})
```

### Phase 2: Vanity Address (Day 2)

#### 2.1 Purchase Vanity Address
**User Journey:** User purchases a vanity address (@username)

**Tests (Write First):**
```typescript
// services/sui-service/tests/vanity.test.ts
describe('Vanity Address', () => {
  describe('GET /vanity/check/:vanity', () => {
    it('should check if vanity is available', async () => {
      const res = await request(app)
        .get('/vanity/check/testuser')
      
      expect(res.status).toBe(200)
      expect(res.body).toHaveProperty('available')
      expect(res.body).toHaveProperty('price')
    })

    it('should return false for taken vanity', async () => {
      // Create existing vanity
      await createVanity('testuser', '0x123...')
      
      const res = await request(app)
        .get('/vanity/check/testuser')
      
      expect(res.body.available).toBe(false)
    })
  })

  describe('POST /vanity/purchase', () => {
    it('should purchase available vanity address', async () => {
      const authToken = await getAuthToken('0x123...')
      const signature = await signPurchase('testuser', '0x123...')
      
      const res = await request(app)
        .post('/vanity/purchase')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          vanity: 'testuser',
          suiAddress: '0x123...',
          signature,
          price: 10
        })
      
      expect(res.status).toBe(200)
      expect(res.body).toHaveProperty('address', 'testuser')
      expect(res.body).toHaveProperty('owner', '0x123...')
    })

    it('should reject purchase of taken vanity', async () => {
      await createVanity('testuser', '0x456...')
      
      const res = await request(app)
        .post('/vanity/purchase')
        .send({
          vanity: 'testuser',
          suiAddress: '0x123...',
          signature: 'sig',
          price: 10
        })
      
      expect(res.status).toBe(400)
    })
  })
})
```

**Implementation:**
- [ ] Implement vanity availability check
- [ ] Implement vanity purchase with signature verification
- [ ] Add frontend vanity purchase modal
- [ ] Connect frontend to vanity API
- [ ] Update user profile with vanity address

**E2E Test:**
```typescript
// e2e/vanity.spec.ts
test('user can purchase vanity address', async ({ page }) => {
  await login(page)
  await page.goto('https://test.dlux.io/@0x123...')
  await page.click('text=Get Vanity Address')
  await page.fill('input[name="vanity"]', 'testuser')
  await page.click('text=Purchase')
  // Mock wallet transaction
  await expect(page.locator('text=@testuser')).toBeVisible()
})
```

### Phase 3: ZK Account Linking (Day 3)

#### 3.1 Link ZK Account
**User Journey:** User links GitHub/Gmail/Facebook account via ZK proof

**Tests (Write First):**
```typescript
// services/sui-service/tests/zk-link.test.ts
describe('ZK Account Linking', () => {
  describe('POST /auth/zk-link', () => {
    it('should link GitHub account with valid proof', async () => {
      const authToken = await getAuthToken('0x123...')
      const zkProof = await generateZKProof('github', 'username')
      
      const res = await request(app)
        .post('/auth/zk-link')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          suiAddress: '0x123...',
          provider: 'github',
          proof: zkProof
        })
      
      expect(res.status).toBe(200)
      expect(res.body.user.linkedZKPs).toContainEqual(
        expect.objectContaining({ provider: 'github' })
      )
    })

    it('should reject invalid ZK proof', async () => {
      const res = await request(app)
        .post('/auth/zk-link')
        .send({
          suiAddress: '0x123...',
          provider: 'github',
          proof: 'invalid-proof'
        })
      
      expect(res.status).toBe(401)
    })
  })
})
```

**Implementation:**
- [ ] Implement ZK proof verification (simplified for now)
- [ ] Store linked accounts in user profile
- [ ] Add frontend ZK linking UI
- [ ] Connect frontend to ZK link API

**E2E Test:**
```typescript
// e2e/zk-link.spec.ts
test('user can link GitHub account', async ({ page }) => {
  await login(page)
  await page.goto('https://test.dlux.io/@testuser')
  await page.click('text=Link Accounts')
  await page.click('text=Link GitHub')
  // Mock GitHub OAuth flow
  await expect(page.locator('text=GitHub linked')).toBeVisible()
})
```

### Phase 4: Social Posts (Day 4-5)

#### 4.1 Create Post
**User Journey:** User creates a social post

**Tests (Write First):**
```typescript
// services/dgraph-service/tests/social.test.ts
describe('Social Posts', () => {
  describe('POST /social/posts', () => {
    it('should create a post with valid signature', async () => {
      const authToken = await getAuthToken('0x123...')
      const message = createPostMessage('Hello world!', '0x123...')
      const signature = await signMessage(message)
      
      const res = await request(app)
        .post('/social/posts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          author: '0x123...',
          content: 'Hello world!',
          contentType: 'text',
          signature
        })
      
      expect(res.status).toBe(201)
      expect(res.body).toHaveProperty('id')
      expect(res.body.content).toBe('Hello world!')
      expect(res.body.author).toBe('0x123...')
    })

    it('should reject post with invalid signature', async () => {
      const res = await request(app)
        .post('/social/posts')
        .send({
          author: '0x123...',
          content: 'Hello world!',
          signature: 'invalid-signature'
        })
      
      expect(res.status).toBe(401)
    })

    it('should extract hashtags from content', async () => {
      const post = await createPost({
        content: 'Check out #web3 #blockchain',
        author: '0x123...'
      })
      
      expect(post.tags).toContain('web3')
      expect(post.tags).toContain('blockchain')
    })

    it('should extract mentions from content', async () => {
      const post = await createPost({
        content: 'Hey @0x456... how are you?',
        author: '0x123...'
      })
      
      expect(post.mentions).toContain('0x456...')
    })
  })
})
```

**Implementation:**
- [ ] Implement post creation with signature verification
- [ ] Implement hashtag extraction
- [ ] Implement mention extraction
- [ ] Add frontend post creation UI
- [ ] Connect frontend to social API

#### 4.2 View Feed
**User Journey:** User views their social feed

**Tests (Write First):**
```typescript
describe('Social Feed', () => {
  describe('GET /social/posts', () => {
    it('should return posts in feed', async () => {
      await createPost({ content: 'Post 1', author: '0x123...' })
      await createPost({ content: 'Post 2', author: '0x456...' })
      
      const res = await request(app)
        .get('/social/posts')
        .query({ limit: 10, offset: 0 })
      
      expect(res.status).toBe(200)
      expect(res.body.posts).toHaveLength(2)
      expect(res.body.posts[0]).toHaveProperty('content')
    })

    it('should filter posts by author', async () => {
      await createPost({ content: 'Post 1', author: '0x123...' })
      await createPost({ content: 'Post 2', author: '0x456...' })
      
      const res = await request(app)
        .get('/social/posts')
        .query({ author: '0x123...' })
      
      expect(res.body.posts).toHaveLength(1)
      expect(res.body.posts[0].author).toBe('0x123...')
    })

    it('should paginate posts', async () => {
      // Create 15 posts
      for (let i = 0; i < 15; i++) {
        await createPost({ content: `Post ${i}`, author: '0x123...' })
      }
      
      const res = await request(app)
        .get('/social/posts')
        .query({ limit: 10, offset: 0 })
      
      expect(res.body.posts).toHaveLength(10)
      expect(res.body.hasMore).toBe(true)
    })
  })
})
```

**Implementation:**
- [ ] Implement feed query with filters
- [ ] Implement pagination
- [ ] Add frontend feed view
- [ ] Connect frontend to feed API

**E2E Test:**
```typescript
// e2e/feed.spec.ts
test('user can view feed', async ({ page }) => {
  await login(page)
  await page.goto('https://test.dlux.io')
  await expect(page.locator('.post')).toHaveCount(10)
  await page.scrollToBottom()
  await expect(page.locator('.post')).toHaveCount(20) // Load more
})
```

### Phase 5: Account View (Day 6)

#### 5.1 View Account
**User Journey:** User views their own or another user's account

**Tests (Write First):**
```typescript
// services/sui-service/tests/account.test.ts
describe('Account View', () => {
  describe('GET /vanity/:identifier', () => {
    it('should return user by vanity address', async () => {
      await createUser({ suiAddress: '0x123...', vanityAddress: 'testuser' })
      
      const res = await request(app)
        .get('/vanity/testuser')
      
      expect(res.status).toBe(200)
      expect(res.body.suiAddress).toBe('0x123...')
      expect(res.body.vanityAddress).toBe('testuser')
    })

    it('should return user by SUI address', async () => {
      await createUser({ suiAddress: '0x123...' })
      
      const res = await request(app)
        .get('/vanity/0x123...')
      
      expect(res.status).toBe(200)
      expect(res.body.suiAddress).toBe('0x123...')
    })

    it('should return 404 for non-existent user', async () => {
      const res = await request(app)
        .get('/vanity/nonexistent')
      
      expect(res.status).toBe(404)
    })
  })
})
```

**Implementation:**
- [ ] Implement account lookup by vanity/SUI address
- [ ] Add frontend account view
- [ ] Display user profile, posts, dApps
- [ ] Connect frontend to account API

**E2E Test:**
```typescript
// e2e/account.spec.ts
test('user can view account', async ({ page }) => {
  await page.goto('https://test.dlux.io/@testuser')
  await expect(page.locator('h1')).toContainText('testuser')
  await expect(page.locator('.user-posts')).toBeVisible()
})
```

## Test Structure

### Directory Structure
```
dlux-sui/
├── services/
│   ├── sui-service/
│   │   └── tests/
│   │       ├── auth.test.ts
│   │       ├── vanity.test.ts
│   │       └── zk-link.test.ts
│   └── dgraph-service/
│       └── tests/
│           └── social.test.ts
├── frontend/
│   └── vue-app/
│       └── tests/
│           ├── unit/
│           └── e2e/
│               ├── auth.spec.ts
│               ├── vanity.spec.ts
│               ├── zk-link.spec.ts
│               ├── feed.spec.ts
│               └── account.spec.ts
└── tests/
    ├── setup.ts
    ├── utils/
    │   ├── factories.ts
    │   └── helpers.ts
    └── e2e/
```

### Test Utilities

```typescript
// tests/utils/factories.ts
export const userFactory = {
  create: (overrides?: Partial<User>) => ({
    suiAddress: faker.string.hexadecimal({ length: 40 }),
    vanityAddress: faker.internet.userName(),
    linkedZKPs: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  })
}

export const postFactory = {
  create: (overrides?: Partial<SocialPost>) => ({
    id: faker.string.uuid(),
    author: faker.string.hexadecimal({ length: 40 }),
    content: faker.lorem.sentence(),
    contentType: 'text' as const,
    likes: 0,
    dislikes: 0,
    replies: 0,
    reposts: 0,
    quotes: 0,
    signature: faker.string.hexadecimal({ length: 64 }),
    signedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  })
}
```

## Deployment Plan

### Pre-Deployment Checklist
- [ ] All tests passing
- [ ] Environment variables configured
- [ ] Database migrations run
- [ ] Services build successfully
- [ ] Health checks passing

### Deployment Steps

1. **Build Services**
```bash
npm run build
```

2. **Run Tests**
```bash
npm test
npm run test:e2e
```

3. **Deploy to Server**
```bash
# Via MCP-SSH
# 1. Copy files to server
# 2. Install dependencies
# 3. Build services
# 4. Run migrations
# 5. Restart PM2 services
```

4. **Verify Deployment**
```bash
# Check health endpoints
curl https://sui.dlux.io/health
curl https://gql.dlux.io/health
curl https://walrus.dlux.io/health

# Check frontend
curl https://test.dlux.io
```

### Deployment Script

```bash
#!/bin/bash
# deploy.sh

echo "Building services..."
npm run build

echo "Running tests..."
npm test || exit 1

echo "Deploying to server..."
# MCP-SSH deployment commands here

echo "Verifying deployment..."
# Health check commands here

echo "Deployment complete!"
```

## Testing Strategy

### Unit Tests
- Test individual functions/services
- Mock external dependencies
- Fast execution (< 1s per test)
- High coverage (> 80%)

### Integration Tests
- Test API endpoints
- Use test database
- Test service interactions
- Medium execution time (< 5s per test)

### E2E Tests
- Test full user journeys
- Use real browser (Playwright)
- Test frontend + backend
- Slower execution (< 30s per test)

## Browser Testing

### Test Scenarios

1. **Connect Wallet**
   - Open https://test.dlux.io
   - Click "Connect Wallet"
   - Verify wallet connection
   - Verify authentication

2. **Purchase Vanity**
   - Navigate to account page
   - Click "Get Vanity Address"
   - Enter vanity name
   - Verify availability
   - Complete purchase
   - Verify vanity appears

3. **Link ZK Account**
   - Navigate to account settings
   - Click "Link GitHub"
   - Complete OAuth flow
   - Verify account linked

4. **Create Post**
   - Navigate to feed
   - Click "New Post"
   - Enter content
   - Submit post
   - Verify post appears in feed

5. **View Feed**
   - Navigate to home
   - Verify posts load
   - Scroll to load more
   - Verify pagination works

6. **View Account**
   - Navigate to @username
   - Verify profile displays
   - Verify posts display
   - Verify dApps display

## Timeline

- **Day 1**: Foundation & Authentication
- **Day 2**: Vanity Address
- **Day 3**: ZK Account Linking
- **Day 4-5**: Social Posts & Feed
- **Day 6**: Account View
- **Day 7**: Testing, Bug Fixes, Deployment

## Success Criteria

- [ ] All user journeys work end-to-end
- [ ] All tests passing
- [ ] Deployed to MCP-SSH server
- [ ] Accessible via browser
- [ ] No critical bugs
- [ ] Basic error handling in place

## Next Steps

1. Set up testing infrastructure
2. Write first failing test
3. Implement feature to pass test
4. Refactor and repeat
5. Deploy and test in browser
