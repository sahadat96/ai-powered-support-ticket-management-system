import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NextFunction, Request, Response } from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { HttpExceptionFilter } from './common/http-exception.filter';

export function configureApp(app: INestApplication) {
  const config = app.get(ConfigService);
  const frontend = config.getOrThrow<string>('FRONTEND_URL');
  const trustedOrigins = new Set([frontend, config.getOrThrow<string>('API_ORIGIN')]);
  app.setGlobalPrefix('api/v1');
  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({ origin: frontend, credentials: true });
  // Browsers send Origin on unsafe requests. Reject foreign origins before cookie authentication.
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (
      !['GET', 'HEAD', 'OPTIONS'].includes(req.method) &&
      req.headers.origin &&
      !trustedOrigins.has(req.headers.origin)
    ) {
      res.status(403).json({ statusCode: 403, message: 'Request origin is not allowed' });
      return;
    }
    next();
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.enableShutdownHooks();
}
