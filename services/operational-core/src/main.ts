// Must be the first import — OpenTelemetry auto-instrumentation needs to
// patch http/express/pg before anything else requires them. See
// docs/architecture/production-observability.md.
import './tracing';
import { ValidationPipe, VERSION_NEUTRAL, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { writeFileSync } from 'fs';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './api-platform/all-exceptions.filter';
import { IdempotencyInterceptor } from './api-platform/idempotency.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Real bug found via live browser testing (DGX Prototype 1.5): CORS was
  // never enabled, so the Web Portal (a different origin — localhost:5174,
  // not 127.0.0.1:3900) could never actually complete a login — the
  // browser silently blocks the cross-origin request before it reaches
  // this server, surfacing as a generic "Failed to fetch" in the portal UI.
  // curl-based testing never caught this because curl isn't subject to
  // same-origin policy. Scoped to the real known local dev origins, not a
  // wildcard.
  app.enableCors({
    origin: ['http://localhost:5174', 'http://localhost:5180', 'http://127.0.0.1:5174', 'http://127.0.0.1:5180'],
    credentials: true,
  });

  app.use(helmet());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(app.get(IdempotencyInterceptor));

  // VERSION_NEUTRAL as the default is what keeps every Phase 1-4 route
  // matching at its existing unversioned path — only a route that opts in
  // with an explicit @Version('1') decorator is actually affected by this.
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: VERSION_NEUTRAL });

  const openApiConfig = new DocumentBuilder()
    .setTitle('Automotive Intelligence Operating System API')
    .setDescription('Operational Core, Garage Operations, DGX AI Platform, and Enterprise Platform APIs')
    .setVersion('1.0')
    .addBearerAuth()
    .addApiKey({ type: 'apiKey', name: 'x-api-key', in: 'header' }, 'x-api-key')
    .build();
  const openApiDocument = SwaggerModule.createDocument(app, openApiConfig);
  SwaggerModule.setup('api-docs', app, openApiDocument);

  // Written to disk so scripts/generate-sdks.ts can feed it to
  // openapi-generator-cli without needing the server running at generation
  // time. See docs/architecture/api-platform.md.
  writeFileSync('openapi.json', JSON.stringify(openApiDocument, null, 2));

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
