import request from 'supertest';
import { app } from '../app';

describe('Auth API', () => {
  const testUser = {
    username: `testuser_${Date.now()}`,
    email: `test_${Date.now()}@example.com`,
    password: 'password123',
  };

  describe('POST /api/auth/register', () => {
    it('registers a new user and returns token', async () => {
      const res = await request(app).post('/api/auth/register').send(testUser);
      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('token');
      expect(res.body).toHaveProperty('user');
      expect(res.body.user).toHaveProperty('username', testUser.username);
      expect(res.body.user).toHaveProperty('email', testUser.email);
    });

    it('rejects registration without required fields', async () => {
      const res = await request(app).post('/api/auth/register').send({
        username: 'foo',
        // missing email and password
      });
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('POST /api/auth/login', () => {
    it('logs in with valid credentials', async () => {
      const res = await request(app).post('/api/auth/login').send({
        username: testUser.username,
        password: testUser.password,
      });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('token');
      expect(res.body).toHaveProperty('user');
    });

    it('rejects login with wrong password', async () => {
      const res = await request(app).post('/api/auth/login').send({
        username: testUser.username,
        password: 'wrongpassword',
      });
      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('error');
    });

    it('rejects login without credentials', async () => {
      const res = await request(app).post('/api/auth/login').send({});
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });
  });
});
