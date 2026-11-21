import { Injectable, UnauthorizedException, type CanActivate, type ExecutionContext } from '@nestjs/common';
import type { Account } from './pue.data.js';
import { PueService } from './pue.service.js';

export type PueRequest = { headers: Record<string, string | undefined>; pueAccount?: Account; pueToken?: string };

/** Requires `Authorization: Bearer <token>` from the simulated mObywatel sign-in. */
@Injectable()
export class PueSessionGuard implements CanActivate {
  constructor(private readonly pue: PueService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<PueRequest>();
    const header = request.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token) throw new UnauthorizedException('Zaloguj się, aby zobaczyć swoje dane.');
    request.pueAccount = this.pue.accountFor(token);
    request.pueToken = token;
    return true;
  }
}
