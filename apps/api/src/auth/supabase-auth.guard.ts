import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Request } from 'express';
import { IS_PUBLIC_KEY } from './public.decorator';

/**
 * Validates Supabase JWTs at the API boundary.
 * Uses the service-role key only to call auth.getUser(token) — never as a
 * substitute for PolicyService resource checks.
 */
@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  private readonly supabase: SupabaseClient;

  constructor(private readonly reflector: Reflector) {
    const url =
      process.env.NEXT_PUBLIC_SUPABASE_URL ??
      process.env.SUPABASE_URL ??
      '';
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

    if (!url || !serviceRole) {
      throw new Error(
        'SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY are required for LifeOS API auth',
      );
    }

    this.supabase = createClient(url, serviceRole, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context
      .switchToHttp()
      .getRequest<Request & { user?: { id: string; email: string } }>();
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException({
        code: 'UNAUTHENTICATED',
        message: 'Missing bearer token',
      });
    }
    const token = header.slice('Bearer '.length);
    const { data, error } = await this.supabase.auth.getUser(token);
    if (error || !data.user) {
      throw new UnauthorizedException({
        code: 'UNAUTHENTICATED',
        message: 'Invalid session',
      });
    }
    req.user = {
      id: data.user.id,
      email: data.user.email ?? '',
    };
    return true;
  }
}
