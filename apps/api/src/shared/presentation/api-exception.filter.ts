import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';
import { TicketRuleError } from '../../modules/tickets/domain/ticket';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);
  catch(error: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();
    let status = 500;
    let message: string | string[] =
      'An unexpected error occurred. Please try again.';
    if (error instanceof TicketRuleError) {
      status = error.code === 'FORBIDDEN' ? 403 : 409;
      message = error.message;
    } else if (error instanceof HttpException) {
      status = error.getStatus();
      const body = error.getResponse();
      message =
        typeof body === 'string'
          ? body
          : (body as { message: string | string[] }).message;
    } else if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        status = 409;
        message = 'A record with these details already exists.';
      }
      if (error.code === 'P2025') {
        status = 404;
        message = 'Record not found.';
      }
      if (error.code === 'P2003') {
        status = 409;
        message = 'A referenced record no longer exists.';
      }
    }
    // Never log request bodies, cookies, passwords, or database connection strings.
    if (status === 500)
      this.logger.error(
        `Unhandled ${error instanceof Error ? error.name : 'error'} on ${request.method} ${request.path}`,
      );
    response.status(status).json({
      statusCode: status,
      message,
      path: request.path,
      timestamp: new Date().toISOString(),
    });
  }
}
