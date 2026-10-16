/**
 * @deprecated Prefer `createBrowserAuthClient` from `@/lib/supabase/browser-auth`.
 * Kept as a thin re-export for session helpers; do not use `.from()` / `.rpc()` for domain data.
 */
export { createBrowserAuthClient as createClient } from './browser-auth';
