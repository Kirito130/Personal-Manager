import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { ZodError } from 'zod';
import { randomUUID } from 'crypto';

@Catch()
export class ZodExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const correlationId = randomUUID();

    if (exception instanceof ZodError) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        correlationId,
        fieldErrors: exception.flatten().fieldErrors,
      });
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      return res.status(status).json({
        code: typeof body === 'object' && body && 'code' in body ? (body as { code: string }).code : 'HTTP_ERROR',
        message: typeof body === 'string' ? body : (body as { message?: string }).message ?? exception.message,
        correlationId,
      });
    }

    const message = exception instanceof Error ? exception.message : 'Internal error';
    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      code: 'INTERNAL_ERROR',
      message,
      correlationId,
    });
  }
}
