import * as Joi from 'joi';

// Real environment validation, run once at boot (see ConfigModule.forRoot's
// `validate` option in app.module.ts) — a missing required variable fails
// the process immediately with a clear message, instead of surfacing as a
// confusing runtime error the first time that variable is actually needed
// (e.g. a cryptic bcrypt/JWT failure five minutes into a load test because
// JWT_SECRET_CURRENT was never set). See docs/architecture/security-production.md.
export const envValidationSchema = Joi.object({
  DATABASE_URL: Joi.string().uri({ scheme: ['postgresql', 'postgres'] }).required(),
  PORT: Joi.number().port().default(3000),
  JWT_SECRET_CURRENT: Joi.string().min(16).required(),
  JWT_KID_CURRENT: Joi.string().required(),
  JWT_SECRETS_PREVIOUS: Joi.string().optional().allow(''),
  ENCRYPTION_KEY: Joi.string().min(16).required(),
  BRANCH_GATEWAY_SIGNING_KEY: Joi.string().min(16).required(),
  REDIS_URL: Joi.string().uri({ scheme: ['redis'] }).optional(),
  DGX_SERVICE_URL: Joi.string().uri().optional(),
  NEON_DATABASE_URL: Joi.string().uri({ scheme: ['postgresql', 'postgres'] }).optional(),
}).unknown(true); // .unknown(true): dozens of other real, optional env vars
// exist across Phase 1-5 (VEHICLE_SYNC_DIR, SAP_B1_*, ODOO_*, OTEL_*, ...) —
// this schema enforces the handful that are load-bearing for the process
// to start up safely, not an exhaustive allowlist of every variable.

export function validateEnv(config: Record<string, unknown>): Record<string, unknown> {
  const { error, value } = envValidationSchema.validate(config, { abortEarly: false });
  if (error) {
    throw new Error(`Environment validation failed:\n${error.details.map((d) => `  - ${d.message}`).join('\n')}`);
  }
  return value;
}
