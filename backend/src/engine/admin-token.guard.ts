import { timingSafeEqual } from 'node:crypto';
import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';

/**
 * Protects admin endpoints with a shared token (ADMIN_TOKEN) sent as `Authorization: Bearer <token>`.
 * Without ADMIN_TOKEN configured, admin writes are disabled.
 * (Simple by design for the demo – production would use ZUS SSO via @nestjs/authentication.)
 */
@Injectable()
export class AdminTokenGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const expected = process.env.ADMIN_TOKEN;
    if (!expected) {
      throw new ForbiddenException('Panel administracyjny jest wyłączony – ustaw ADMIN_TOKEN na serwerze.');
    }

    const request = context.switchToHttp().getRequest<{ headers: Record<string, string | undefined> }>();
    const header = request.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';

    const a = Buffer.from(token);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new UnauthorizedException('Nieprawidłowy token administratora.');
    }
    return true;
  }
}
