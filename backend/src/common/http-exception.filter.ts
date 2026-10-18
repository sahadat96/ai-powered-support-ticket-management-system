import {ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger} from '@nestjs/common';
import {Request, Response} from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);
  catch(exception: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const request = context.getRequest<Request>();
    const response = context.getResponse<Response>();
    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const body = exception instanceof HttpException ? exception.getResponse() : undefined;
    const message = typeof body === 'string' ? body : (body as {message?: unknown})?.message ?? 'An unexpected error occurred';
    if (status >= 500) this.logger.error(exception instanceof Error ? exception.stack : 'Unknown server error');
    response.status(status).json({statusCode: status, message, path: request.path, timestamp: new Date().toISOString()});
  }
}
