import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import locationRouter from '../src/routes/location';
import { attachAuth } from '../src/middleware/auth';
import { dgraphClient } from '../src/dgraph/client';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
function authHeader(suiAddress: string): string {
  const token = jwt.sign({ suiAddress, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600 }, JWT_SECRET);
  return `Bearer ${token}`;
}

// Mock dgraph client
jest.mock('../src/dgraph/client', () => ({
  dgraphClient: {
    mutate: jest.fn(),
    query: jest.fn()
  }
}));

const app = express();
app.use(express.json());
app.use(attachAuth);
app.use('/location', locationRouter);
app.post('/search/location', (req, res, next) => {
  req.url = '/search';
  locationRouter(req, res, next);
});

describe('Location Search API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /location/preferences', () => {
    it('should update location preferences', async () => {
      (dgraphClient.mutate as jest.Mock).mockResolvedValue({});

      const response = await request(app)
        .post('/location/preferences')
        .set('Authorization', authHeader('0x123'))
        .send({
          user: '0x123',
          enabled: true,
          precision: 'city',
          subscribedSpots: ['times-square'],
          sessionOnly: false
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.preference.enabled).toBe(true);
      expect(response.body.preference.precision).toBe('city');
      expect(dgraphClient.mutate).toHaveBeenCalled();
    });

    it('should require user field', async () => {
      const response = await request(app)
        .post('/location/preferences')
        .send({
          enabled: true
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('user is required');
    });

    it('should require enabled field', async () => {
      const response = await request(app)
        .post('/location/preferences')
        .set('Authorization', authHeader('0x123'))
        .send({
          user: '0x123'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('enabled is required');
    });

    it('should validate precision values', async () => {
      const response = await request(app)
        .post('/location/preferences')
        .set('Authorization', authHeader('0x123'))
        .send({
          user: '0x123',
          enabled: true,
          precision: 'invalid'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('precision must be one of');
    });
  });

  describe('GET /location/preferences', () => {
    it('should get user preferences', async () => {
      const mockPreference = {
        user: '0x123',
        enabled: true,
        precision: 'city',
        subscribedSpots: ['times-square'],
        currentZone: '40.7,-74.0',
        sessionOnly: false,
        updatedAt: '2024-01-01T00:00:00Z'
      };

      (dgraphClient.query as jest.Mock).mockResolvedValue({
        preferences: [mockPreference]
      });

      const response = await request(app)
        .get('/location/preferences')
        .set('Authorization', authHeader('0x123'))
        .query({ user: '0x123' });

      expect(response.status).toBe(200);
      expect(response.body.preference).toEqual(mockPreference);
    });

    it('should return default preferences if not found', async () => {
      (dgraphClient.query as jest.Mock).mockResolvedValue({
        preferences: []
      });

      const response = await request(app)
        .get('/location/preferences')
        .set('Authorization', authHeader('0x123'))
        .query({ user: '0x123' });

      expect(response.status).toBe(200);
      expect(response.body.preference.enabled).toBe(false);
      expect(response.body.preference.precision).toBe('city');
    });

    it('should require user query parameter', async () => {
      const response = await request(app)
        .get('/location/preferences');

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('user query parameter is required');
    });
  });

  describe('POST /search/location', () => {
    it('should search content by location', async () => {
      (dgraphClient.query as jest.Mock).mockResolvedValue({
        content: [
          {
            id: 'post1',
            author: '0x123',
            content: 'Test post',
            locationZone: '40.7,-74.0',
            locationLat: 40.7,
            locationLon: -74.0,
            distance: 0.5,
            createdAt: '2024-01-01T00:00:00Z'
          }
        ]
      });

      const response = await request(app)
        .post('/search/location')
        .send({
          userZone: '40.7,-74.0',
          radius: 5.0,
          limit: 20
        });

      expect(response.status).toBe(200);
      expect(response.body.results).toBeDefined();
      expect(response.body.userZone).toBe('40.7,-74.0');
    });

    it('should require userZone', async () => {
      const response = await request(app)
        .post('/search/location')
        .send({
          radius: 5.0
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('userZone is required');
    });

    it('should validate userZone format', async () => {
      const response = await request(app)
        .post('/search/location')
        .send({
          userZone: 'invalid'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('userZone must be in format');
    });

    it('should handle search query', async () => {
      (dgraphClient.query as jest.Mock).mockResolvedValue({
        content: []
      });

      const response = await request(app)
        .post('/search/location')
        .send({
          userZone: '40.7,-74.0',
          query: 'restaurants',
          radius: 5.0
        });

      expect(response.status).toBe(200);
    });
  });

  describe('GET /location/spots/popular', () => {
    it('should return popular spots', async () => {
      const response = await request(app)
        .get('/location/spots/popular');

      expect(response.status).toBe(200);
      expect(response.body.spots).toBeDefined();
      expect(Array.isArray(response.body.spots)).toBe(true);
      expect(response.body.spots.length).toBeGreaterThan(0);
    });
  });

  describe('POST /location/spots/subscribe', () => {
    it('should subscribe to a spot', async () => {
      (dgraphClient.query as jest.Mock).mockResolvedValue({
        preferences: []
      });
      (dgraphClient.mutate as jest.Mock).mockResolvedValue({});

      const response = await request(app)
        .post('/location/spots/subscribe')
        .send({
          user: '0x123',
          spotId: 'times-square'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should require user and spotId', async () => {
      const response = await request(app)
        .post('/location/spots/subscribe')
        .send({
          user: '0x123'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('user and spotId are required');
    });
  });

  describe('DELETE /location/spots/subscribe/:spotId', () => {
    it('should unsubscribe from a spot', async () => {
      (dgraphClient.query as jest.Mock).mockResolvedValue({
        preferences: [{
          uid: 'pref1',
          subscribedSpots: ['times-square', 'central-park']
        }]
      });
      (dgraphClient.mutate as jest.Mock).mockResolvedValue({});

      const response = await request(app)
        .delete('/location/spots/subscribe/times-square')
        .query({ user: '0x123' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should require user query parameter', async () => {
      const response = await request(app)
        .delete('/location/spots/subscribe/times-square');

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('user query parameter is required');
    });
  });
});
