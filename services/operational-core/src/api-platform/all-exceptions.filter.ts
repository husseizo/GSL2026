import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response } from 'express';
import { CORRELATION_ID_HEADER } from './correlation-id.middleware';

export interface StructuredErrorBody {
  error: {
    code: string;
    message: string;
    correlationId?: string;
    details?: unknown;
  };
}

// One consistent error envelope across every endpoint (new and existing —
// this filter is global, applied in main.ts, and doesn't require any
// controller to change). Every error response can now be parsed the same
// way by any client/SDK, and always carries the correlation ID that was
// already on the request (see correlation-id.middleware.ts) so a support
// request ("I got this error") is traceable to server-side logs. See
// docs/architecture/api-platform.md.
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const correlationId = request.headers[CORRELATION_ID_HEADER] as string | undefined;

    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const body = exception instanceof HttpException ? exception.getResponse() : undefined;

    const message =
      typeof body === 'string'
        ? body
        : (body as { message?: string | string[] })?.message
          ? Array.isArray((body as { message: string[] }).message)
            ? (body as { message: string[] }).message.join('; ')
            : ((body as { message: string }).message as string)
          : (exception as Error)?.message ?? 'Internal server error';

    const code = exception instanceof HttpException ? exception.constructor.name : 'INTERNAL_ERROR';

    if (status >= 500) {
      this.logger.error(`[${correlationId ?? 'no-correlation-id'}] ${message}`, (exception as Error)?.stack);
    }

    const errorBody: StructuredErrorBody = {
      error: { code, message, correlationId, details: typeof body === 'object' ? (body as Record<string, unknown>).violations : undefined },
    };

    response.status(status).json(errorBody);
  }
}
