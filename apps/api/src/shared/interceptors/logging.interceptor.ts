import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Request } from 'express';
import { Observable, tap } from 'rxjs';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<Request>();
    const { method, originalUrl } = request;
    const requestIdHeader = request.headers['x-request-id'];
    const requestId = Array.isArray(requestIdHeader)
      ? (requestIdHeader[0] ?? '-')
      : (requestIdHeader ?? '-');
    const started = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const response = context
            .switchToHttp()
            .getResponse<{ statusCode: number }>();
          this.logger.log(
            `${method} ${originalUrl} ${response.statusCode} ${Date.now() - started}ms rid=${requestId}`,
          );
        },
        error: (error: Error) => {
          this.logger.error(
            `${method} ${originalUrl} failed ${Date.now() - started}ms rid=${requestId} err=${error.message}`,
          );
        },
      }),
    );
  }
}
