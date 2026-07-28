import { ArgumentsHost, BadRequestException, NotFoundException } from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter';

function makeHost(correlationId?: string) {
  const jsonMock = jest.fn();
  const statusMock = jest.fn().mockReturnValue({ json: jsonMock });
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status: statusMock }),
      getRequest: () => ({ headers: correlationId ? { 'x-correlation-id': correlationId } : {} }),
    }),
  } as unknown as ArgumentsHost;
  return { host, statusMock, jsonMock };
}

describe('AllExceptionsFilter', () => {
  it('produces a structured error envelope with the request correlation ID', () => {
    const filter = new AllExceptionsFilter();
    const { host, statusMock, jsonMock } = makeHost('corr-123');

    filter.catch(new NotFoundException('Vehicle not found'), host);

    expect(statusMock).toHaveBeenCalledWith(404);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.objectContaining({ message: 'Vehicle not found', correlationId: 'corr-123' }) }),
    );
  });

  it('maps a non-HttpException to a 500 with a generic message', () => {
    const filter = new AllExceptionsFilter();
    const { host, statusMock, jsonMock } = makeHost();

    filter.catch(new Error('unexpected failure'), host);

    expect(statusMock).toHaveBeenCalledWith(500);
    expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({ error: expect.objectContaining({ message: 'unexpected failure' }) }));
  });

  it('joins a class-validator array message into one readable string', () => {
    const filter = new AllExceptionsFilter();
    const { host, jsonMock } = makeHost();

    filter.catch(new BadRequestException(['field a is required', 'field b is invalid']), host);

    expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({ error: expect.objectContaining({ message: 'field a is required; field b is invalid' }) }));
  });
});
