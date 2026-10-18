import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { Request, Response, NextFunction } from 'express';
import { ApiExceptionFilter } from './shared/presentation/api-exception.filter';

export function configureApp(app: INestApplication) {
  const config = app.get(ConfigService);
  const origin = config.getOrThrow<string>('WEB_ORIGIN');
  app.setGlobalPrefix('api/v1');
  app.use(helmet()); app.use(cookieParser());
  app.enableCors({origin, credentials: true});
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.cookies?.support_session && !req.headers.authorization && req.headers.origin !== origin) {
      res.status(403).json({statusCode: 403, message: 'Request origin is not allowed.'}); return;
    }
    next();
  });
  app.useGlobalPipes(new ValidationPipe({whitelist: true, forbidNonWhitelisted: true, transform: true}));
  app.useGlobalFilters(new ApiExceptionFilter());
  app.enableShutdownHooks();
  const document = SwaggerModule.createDocument(app, new DocumentBuilder().setTitle('Support Desk API').setDescription('Role-based ticket workflow, collaboration, and local ML-assisted triage.').setVersion('1.0').addBearerAuth().addCookieAuth('support_session').build());
  SwaggerModule.setup('docs', app, document, {swaggerOptions: {persistAuthorization: false}});
  return app;
}
