import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse =
      exception instanceof HttpException
        ? exception.getResponse()
        : { message: 'Internal server error' };

    let message =
      typeof exceptionResponse === 'string'
        ? exceptionResponse
        : ((exceptionResponse as { message?: string | string[] }).message ??
          'Unexpected error');

    if (!(exception instanceof HttpException)) {
      const raw =
        exception instanceof Error ? exception.message : String(exception);
      this.logger.error(
        raw,
        exception instanceof Error ? exception.stack : undefined,
      );

      if (/WIN1252|encoding/i.test(raw)) {
        message =
          'Database encoding error. Restart API with UTF-8 embedded Postgres.';
      } else if (process.env.NODE_ENV !== 'production') {
        message = raw;
      }
    }

    response.status(status).json({
      success: false,
      statusCode: status,
      message: Array.isArray(message) ? message.join(', ') : message,
      timestamp: new Date().toISOString(),
    });
  }
}
