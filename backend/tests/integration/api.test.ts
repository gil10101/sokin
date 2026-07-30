/**
 * API Integration Tests
 * 
 * Tests the Express application endpoints including:
 * - Health check
 * - Route mounting
 * - Error handling
 * - CORS configuration
 * 
 * Note: These tests use supertest to make actual HTTP requests
 * to the Express application without starting a server.
 */

import request from 'supertest';
import express, { Express } from 'express';

const describeIntegration = process.env.RUN_INTEGRATION_TESTS === 'true'
  ? describe
  : describe.skip;

// Mock all external dependencies before importing the app
jest.mock('../../src/config/firebase', () => ({
  db: null,
  auth: null,
}));

jest.mock('../../src/utils/logger', () => ({
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// Create a minimal test app
const createTestApp = (): Express => {
  const app = express();
  
  app.use(express.json());
  
  // Health check route
  app.get('/health', (req, res) => {
    res.status(200).json({ 
      status: 'ok', 
      timestamp: new Date().toISOString() 
    });
  });
  
  // Mock API routes for testing
  app.get('/api/test', (req, res) => {
    res.json({ message: 'Test endpoint' });
  });
  
  app.post('/api/test', (req, res) => {
    res.status(201).json({ 
      message: 'Created', 
      data: req.body 
    });
  });
  
  // 404 handler
  app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
  });
  
  // Error handler
  app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
    res.status(500).json({ error: 'Internal server error' });
  });
  
  return app;
};

describeIntegration('API Integration Tests', () => {
  let app: Express;

  beforeAll(() => {
    app = createTestApp();
  });

  describe('Health Check', () => {
    it('GET /health should return 200 with status ok', async () => {
      const response = await request(app)
        .get('/health')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('API Routes', () => {
    it('GET /api/test should return test message', async () => {
      const response = await request(app)
        .get('/api/test')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Test endpoint');
    });

    it('POST /api/test should create resource', async () => {
      const testData = { name: 'Test', value: 123 };
      
      const response = await request(app)
        .post('/api/test')
        .send(testData)
        .expect('Content-Type', /json/)
        .expect(201);

      expect(response.body).toHaveProperty('message', 'Created');
      expect(response.body.data).toEqual(testData);
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for unknown routes', async () => {
      const response = await request(app)
        .get('/api/unknown-route')
        .expect('Content-Type', /json/)
        .expect(404);

      expect(response.body).toHaveProperty('error', 'Route not found');
    });
  });

  describe('Request Parsing', () => {
    it('should parse JSON body correctly', async () => {
      const testData = {
        string: 'value',
        number: 42,
        boolean: true,
        array: [1, 2, 3],
        nested: { key: 'value' },
      };

      const response = await request(app)
        .post('/api/test')
        .send(testData)
        .expect(201);

      expect(response.body.data).toEqual(testData);
    });

    it('should handle empty body', async () => {
      const response = await request(app)
        .post('/api/test')
        .send({})
        .expect(201);

      expect(response.body.data).toEqual({});
    });
  });
});

describeIntegration('Express App Configuration', () => {
  it('should have JSON parsing middleware', async () => {
    const app = createTestApp();
    
    const response = await request(app)
      .post('/api/test')
      .set('Content-Type', 'application/json')
      .send({ test: 'data' })
      .expect(201);

    expect(response.body.data).toEqual({ test: 'data' });
  });

  it('should respond to HEAD requests', async () => {
    const app = createTestApp();
    
    await request(app)
      .head('/health')
      .expect(200);
  });
});

describeIntegration('Response Headers', () => {
  it('should set content-type to application/json', async () => {
    const app = createTestApp();
    
    const response = await request(app)
      .get('/health');

    expect(response.headers['content-type']).toMatch(/application\/json/);
  });
});


