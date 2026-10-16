import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'lifeos:isPublic';

/** Mark a route as callable without a Supabase JWT (e.g. health). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
