import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Request } from 'express';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// Rotas que estabelecem a sessão — ainda não têm cookie CSRF, por definição.
const CSRF_EXEMPT_PATHS = new Set([
  '/auth/login',
  '/auth/refresh',
  '/auth/logout',
]);

// Double-submit cookie pattern.
// O login emite um cookie 'csrf_token' (não-HttpOnly, legível por JS).
// O frontend lê-o e envia-o no header 'X-CSRF-Token' em cada mutação.
// Um atacante cross-site não consegue ler o cookie sameSite=strict nem forjar o header.
@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();

    if (SAFE_METHODS.has(req.method)) return true;

    // Normalizar o path removendo o prefix /api se presente
    const path = req.path.replace(/^\/api/, '');
    if (CSRF_EXEMPT_PATHS.has(path)) return true;

    // Rotas de convite públicas (aceitar convite não tem sessão prévia)
    if (path.startsWith('/invitations/') && path.endsWith('/accept')) return true;

    const cookieToken = req.cookies?.csrf_token as string | undefined;
    const headerToken = req.headers['x-csrf-token'] as string | undefined;

    if (!cookieToken || !headerToken || cookieToken !== headerToken) {
      throw new ForbiddenException('Token CSRF inválido ou ausente');
    }
    return true;
  }
}
