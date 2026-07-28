/* eslint-disable no-console */
// Generates openapi.json without starting the HTTP listener — used by CI/SDK
// generation, where only the document is needed. main.ts also writes this
// file on every real boot; this script is the standalone equivalent.
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { writeFileSync } from 'fs';
import { AppModule } from '../src/app.module';

async function main() {
  const app = await NestFactory.create(AppModule, { logger: false });

  const config = new DocumentBuilder()
    .setTitle('Automotive Intelligence Operating System API')
    .setDescription('Operational Core, Garage Operations, DGX AI Platform, and Enterprise Platform APIs')
    .setVersion('1.0')
    .addBearerAuth()
    .addApiKey({ type: 'apiKey', name: 'x-api-key', in: 'header' }, 'x-api-key')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  writeFileSync('openapi.json', JSON.stringify(document, null, 2));
  console.log(`openapi.json written — ${Object.keys(document.paths).length} paths documented.`);

  await app.close();
}

main().catch((err) => {
  console.error('Failed to generate OpenAPI document:', err);
  process.exit(1);
});
