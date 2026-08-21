import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { map } from 'rxjs/operators';

@Injectable()
export class TransformInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler) {
    return next.handle().pipe(
      map((result) => {
        if (result?.success !== undefined) return result;

        return {
          success: true,
          message: result?.message ?? 'Success',
          data: result?.data ?? null,
          metadata: result?.metadata ?? null,
        };
      }),
    );
  }
}
