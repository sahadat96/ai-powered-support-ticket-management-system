import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { configureApp } from './bootstrap';

async function main() {
  const app = configureApp(await NestFactory.create(AppModule));
  const port = app.get(ConfigService).getOrThrow<number>('PORT');
  await app.listen(port, '0.0.0.0');
  console.log(`API: http://localhost:${port}/api/v1 | Swagger: http://localhost:${port}/docs`);
}
main().catch(() => { console.error('API startup failed. Check environment variables and PostgreSQL availability.'); process.exit(1); });
