import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { redactSensitiveFields } from '../common/logging/redact';

// Real application of redactSensitiveFields(): every request body that
// reaches the debug log has password/token/secret/apiKey fields masked
// first — a login request's body is genuinely logged, but never with the
// plaintext password in it. See docs/architecture/security-production.md.
@Injectable()
export class RequestLoggingMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction) {
    if (req.body && Object.keys(req.body).length > 0) {
      this.logger.debug(`${req.method} ${req.path} body=${JSON.stringify(redactSensitiveFields(req.body))}`);
    }
    next();
  }
}
