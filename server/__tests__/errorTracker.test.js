const { errorTracker, logClientError } = require('../middleware/errorTracker');

jest.mock('../models/ServerError', () => {
  const Mock = jest.fn().mockImplementation((data) => ({
    ...data,
    save: jest.fn().mockResolvedValue(true),
  }));
  Mock.findOneAndUpdate = jest.fn();
  Mock.create = jest.fn();
  return Mock;
});

const ServerError = require('../models/ServerError');

describe('Error Tracker Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      method: 'POST',
      originalUrl: '/api/jobs',
      params: {},
      query: {},
      body: { title: 'Test', password: 'secret123' },
      ip: '127.0.0.1',
      get: jest.fn().mockReturnValue('Mozilla/5.0'),
      user: { userId: 'user123', email: 'test@test.com' },
      connection: { remoteAddress: '127.0.0.1' },
    };
    res = {};
    next = jest.fn();
  });

  it('should track 500 errors and call next', async () => {
    const error = new Error('Database connection failed');
    error.status = 500;

    ServerError.findOneAndUpdate.mockResolvedValue(null);
    ServerError.create.mockResolvedValue({});

    await errorTracker(error, req, res, next);

    expect(ServerError.create).toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(error);
  });

  it('should skip 4xx errors', async () => {
    const error = new Error('Not found');
    error.status = 404;

    await errorTracker(error, req, res, next);

    expect(ServerError.create).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(error);
  });

  it('should group duplicate errors by fingerprint', async () => {
    const error = new Error('Timeout');
    error.status = 500;

    ServerError.findOneAndUpdate.mockResolvedValue({ _id: 'existing', occurrences: 2 });

    await errorTracker(error, req, res, next);

    expect(ServerError.findOneAndUpdate).toHaveBeenCalled();
    expect(ServerError.create).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(error);
  });

  it('should sanitize sensitive data from request body', async () => {
    const error = new Error('Server error');
    error.status = 500;

    ServerError.findOneAndUpdate.mockResolvedValue(null);
    ServerError.create.mockResolvedValue({});

    await errorTracker(error, req, res, next);

    const createCall = ServerError.create.mock.calls[0][0];
    expect(createCall.request.body.password).toBe('[REDACTED]');
    expect(createCall.request.body.title).toBe('Test');
  });

  it('should not crash if tracking itself fails', async () => {
    const error = new Error('Server error');
    error.status = 500;

    ServerError.findOneAndUpdate.mockRejectedValue(new Error('DB down'));

    await errorTracker(error, req, res, next);

    // Should still call next even if tracking fails
    expect(next).toHaveBeenCalledWith(error);
  });
});

describe('logClientError', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create a client error entry', async () => {
    ServerError.findOneAndUpdate.mockResolvedValue(null);
    ServerError.create.mockResolvedValue({});

    await logClientError(
      { message: 'Component crash', stack: 'Error...', url: '/dashboard' },
      'user123',
      'test@test.com'
    );

    expect(ServerError.create).toHaveBeenCalled();
    const created = ServerError.create.mock.calls[0][0];
    expect(created.source).toBe('client');
    expect(created.message).toBe('Component crash');
  });

  it('should increment occurrences for duplicate client errors', async () => {
    ServerError.findOneAndUpdate.mockResolvedValue({ _id: 'existing' });

    await logClientError(
      { message: 'Same error again', url: '/dashboard' },
      'user123',
      'test@test.com'
    );

    expect(ServerError.findOneAndUpdate).toHaveBeenCalled();
    expect(ServerError.create).not.toHaveBeenCalled();
  });
});
