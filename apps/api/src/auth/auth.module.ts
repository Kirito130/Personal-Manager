import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { SupabaseAuthGuard } from './supabase-auth.guard';

@Global()
@Module({
  providers: [
    SupabaseAuthGuard,
    { provide: APP_GUARD, useClass: SupabaseAuthGuard },
  ],
  exports: [SupabaseAuthGuard],
})
export class AuthModule {}
