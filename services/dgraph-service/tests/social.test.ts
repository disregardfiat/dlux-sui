import express from 'express';
import request from 'supertest';
import { describe, it, expect, beforeEach } from '@jest/globals';
import { socialRouter } from '../src/routes/social';
import { socialRepository } from '../src/repositories/socialRepository';

process.env.NODE_ENV = 'test';

jest.mock('../src/services/socialBlockchain', () => ({
  socialBlockchain: {
    addInteraction: jest.fn()
  }
}));

jest.mock('../src/utils/signatureVerifier', () => ({
  SignatureVerifier: {
    createSignableMessage: jest.fn((_action: string, data: Record<string, unknown>) =>
      JSON.stringify(data)
    ),
    verifySignature: jest.fn((_address: string, _message: string, signature: string) =>
      Promise.resolve(signature !== 'invalid_signature')
    )
  }
}));

const app = express();
app.use(express.json());
app.use('/social', socialRouter);

const validSignature = 'YWJjZGVmZ2hpamtsbW5vcA==';

describe('Social Posts', () => {
  beforeEach(() => {
    socialRepository.clearTestData();
  });

  describe('POST /social/posts', () => {
    it('should create a post with valid signature', async () => {
      const res = await request(app)
        .post('/social/posts')
        .send({
          author: '0x123...',
          content: 'Hello world!',
          signature: validSignature
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body.content).toBe('Hello world!');
      expect(res.body.author).toBe('0x123...');
    });

    it('should reject post with invalid signature', async () => {
      const res = await request(app)
        .post('/social/posts')
        .send({
          author: '0x123...',
          content: 'Hello world!',
          signature: 'invalid_signature'
        });

      expect(res.status).toBe(401);
    });

    it('should extract hashtags from content', async () => {
      const res = await request(app)
        .post('/social/posts')
        .send({
          author: '0x123...',
          content: 'Check out #web3 #blockchain',
          signature: validSignature
        });

      expect(res.status).toBe(201);
      expect(res.body.tags).toContain('web3');
      expect(res.body.tags).toContain('blockchain');
    });

    it('should extract mentions from content', async () => {
      const res = await request(app)
        .post('/social/posts')
        .send({
          author: '0x123...',
          content: 'Hey @alice and @bob',
          signature: validSignature
        });

      expect(res.status).toBe(201);
      expect(res.body.mentions).toContain('alice');
      expect(res.body.mentions).toContain('bob');
    });
  });

  describe('GET /social/posts', () => {
    it('should return posts in feed', async () => {
      await request(app)
        .post('/social/posts')
        .send({ author: '0x123...', content: 'Post 1', signature: validSignature });
      await request(app)
        .post('/social/posts')
        .send({ author: '0x456...', content: 'Post 2', signature: validSignature });

      const res = await request(app)
        .get('/social/posts')
        .query({ limit: 10, offset: 0 });

      expect(res.status).toBe(200);
      expect(res.body.posts).toHaveLength(2);
      expect(res.body.total).toBe(2);
    });

    it('should filter posts by author', async () => {
      await request(app)
        .post('/social/posts')
        .send({ author: '0x123...', content: 'Post 1', signature: validSignature });
      await request(app)
        .post('/social/posts')
        .send({ author: '0x456...', content: 'Post 2', signature: validSignature });

      const res = await request(app)
        .get('/social/posts')
        .query({ author: '0x123...' });

      expect(res.status).toBe(200);
      expect(res.body.posts).toHaveLength(1);
      expect(res.body.posts[0].author).toBe('0x123...');
    });

    it('should paginate posts', async () => {
      for (let i = 0; i < 15; i += 1) {
        await request(app)
          .post('/social/posts')
          .send({
            author: '0x123...',
            content: `Post ${i}`,
            signature: validSignature
          });
      }

      const res = await request(app)
        .get('/social/posts')
        .query({ limit: 10, offset: 0 });

      expect(res.status).toBe(200);
      expect(res.body.posts).toHaveLength(10);
      expect(res.body.hasMore).toBe(true);
    });
  });

  describe('Interactions', () => {
    it('should create an interaction and list it via GET /social/interactions', async () => {
      const postRes = await request(app)
        .post('/social/posts')
        .send({ author: '0x123...', content: 'Post 1', signature: validSignature });
      expect(postRes.status).toBe(201);

      const interactionRes = await request(app)
        .post('/social/interactions')
        .send({
          user: '0xabc...',
          type: 'like',
          targetId: postRes.body.id,
          targetType: 'post',
          signature: validSignature
        });
      expect(interactionRes.status).toBe(201);
      expect(interactionRes.body).toHaveProperty('id');

      const listRes = await request(app)
        .get('/social/interactions')
        .query({ user: '0xabc...', type: 'like', targetType: 'post' });

      expect(listRes.status).toBe(200);
      expect(listRes.body).toHaveProperty('interactions');
      expect(listRes.body.interactions).toHaveLength(1);
      expect(listRes.body.total).toBe(1);
      expect(listRes.body.interactions[0].targetId).toBe(postRes.body.id);
    });

    it('should not return deleted interactions', async () => {
      const postRes = await request(app)
        .post('/social/posts')
        .send({ author: '0x123...', content: 'Post 1', signature: validSignature });
      expect(postRes.status).toBe(201);

      const interactionRes = await request(app)
        .post('/social/interactions')
        .send({
          user: '0xabc...',
          type: 'like',
          targetId: postRes.body.id,
          targetType: 'post',
          signature: validSignature
        });
      expect(interactionRes.status).toBe(201);

      const delRes = await request(app)
        .delete(`/social/interactions/${interactionRes.body.id}`)
        .send({ user: '0xabc...', signature: validSignature });
      expect(delRes.status).toBe(200);

      const listRes = await request(app)
        .get('/social/interactions')
        .query({ user: '0xabc...' });

      expect(listRes.status).toBe(200);
      expect(listRes.body.interactions).toHaveLength(0);
      expect(listRes.body.total).toBe(0);
    });
  });
});
