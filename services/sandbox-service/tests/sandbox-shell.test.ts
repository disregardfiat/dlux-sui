import request from 'supertest';
import { app } from '../src/index';

describe('sandbox-service: dApp shell + scripts', () => {
  it('GET /health returns ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok', service: 'sandbox-service' });
  });

  it('GET /manifest.json returns PWA manifest', async () => {
    const res = await request(app).get('/manifest.json');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('name');
    expect(res.body).toHaveProperty('display', 'standalone');
    expect(res.body).toHaveProperty('start_url', '/');
    expect(res.body).toHaveProperty('icons');
  });

  it('GET /sw.js returns service worker JS', async () => {
    const res = await request(app).get('/sw.js');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('javascript');
    expect(res.text).toContain('install');
    expect(res.text).toContain('fetch');
  });

  it('GET /wallet-script.js returns wallet connector', async () => {
    const res = await request(app).get('/wallet-script.js');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('javascript');
    expect(res.text).toContain('dluxWallet');
    expect(res.text).toContain('connect');
    expect(res.text).toContain('signMessage');
  });

  it('GET /nav-script.js returns navigation script', async () => {
    const res = await request(app).get('/nav-script.js');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('javascript');
    expect(res.text).toContain('dluxNav');
  });

  it('GET /social-script.js returns social API script', async () => {
    const res = await request(app).get('/social-script.js');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('javascript');
    expect(res.text).toContain('dluxSocial');
    expect(res.text).toContain('createPost');
    expect(res.text).toContain('listPosts');
    expect(res.text).toContain('createInteraction');
    expect(res.text).toContain('dluxAds');
    expect(res.text).toContain('dluxPremium');
  });

  it('GET / returns dApp shell HTML', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.text).toContain('<!DOCTYPE html>');
    expect(res.text).toContain('wallet-script.js');
    expect(res.text).toContain('social-script.js');
    expect(res.text).toContain('nav-script.js');
    expect(res.text).toContain('dluxDappMeta');
    expect(res.text).toContain('manifest.json');
    expect(res.text).toContain('sw.js');
  });

  it('GET /metadata returns 400 without author/permlink', async () => {
    const res = await request(app).get('/metadata');
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('GET /metadata with author + permlink returns metadata', async () => {
    const res = await request(app).get('/metadata').query({
      author: '0xdeadbeef',
      permlink: 'test-dapp',
    });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('title');
    expect(res.body).toHaveProperty('author', '0xdeadbeef');
    expect(res.body).toHaveProperty('url');
    expect(res.body.url).toContain('walrus.dlux.io');
  });
});
