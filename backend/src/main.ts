import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { configureApp } from './bootstrap';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: false });
  configureApp(app);
  const config = app.get(ConfigService);
  const spec = new DocumentBuilder()
    .setTitle('Support Desk API')
    .setDescription(
      'Customer and team support workflows with local machine-learning triage. Login first to set the HTTP-only session cookie. Ticket edits require the latest version.',
    )
    .setVersion('1.0.0')
    .addCookieAuth('support_session', { type: 'apiKey', in: 'cookie' }, 'support_session')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, spec);
  SwaggerModule.setup('docs', app, document, { swaggerOptions: { persistAuthorization: false } });
  const port = config.getOrThrow<number>('PORT');
  await app.listen(port, '0.0.0.0');
  console.log(
    `Support Desk API: http://localhost:${port}/api/v1 | Swagger: http://localhost:${port}/docs`,
  );
}
void bootstrap();
