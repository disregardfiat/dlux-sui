import request from 'supertest';
import { app } from '../src/index';

describe('sandbox-service', () => {
  it('GET /health returns ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      status: 'ok',
      service: 'sandbox-service'
    });
  });
});

