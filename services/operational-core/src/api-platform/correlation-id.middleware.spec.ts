import { CorrelationIdMiddleware } from './correlation-id.middleware';

describe('CorrelationIdMiddleware', () => {
  it('generates a new correlation ID when the caller supplies none', () => {
    const middleware = new CorrelationIdMiddleware();
    const req = { headers: {} } as any;
    const setHeader = jest.fn();
    const res = { setHeader } as any;
    const next = jest.fn();

    middleware.use(req, res, next);

    expect(req.headers['x-correlation-id']).toBeDefined();
    expect(setHeader).toHaveBeenCalledWith('x-correlation-id', req.headers['x-correlation-id']);
    expect(next).toHaveBeenCalled();
  });

  it('preserves a caller-supplied correlation ID rather than overwriting it', () => {
    const middleware = new CorrelationIdMiddleware();
    const req = { headers: { 'x-correlation-id': 'client-supplied-id' } } as any;
    const res = { setHeader: jest.fn() } as any;
    const next = jest.fn();

    middleware.use(req, res, next);

    expect(req.headers['x-correlation-id']).toBe('client-supplied-id');
    expect(res.setHeader).toHaveBeenCalledWith('x-correlation-id', 'client-supplied-id');
  });
});
