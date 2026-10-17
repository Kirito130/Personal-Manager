import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const PUBLIC_PATHS = ['/login', '/signup', '/auth/callback'];

function isPublicPath(path: string) {
  return PUBLIC_PATHS.some((p) => path === p || path.startsWith(`${p}/`));
}

function hasSupabaseAuthCookie(request: NextRequest) {
  // sb-<ref>-auth-token (chunked as .0/.1) — no cookie means no session to validate.
  return request.cookies
    .getAll()
    .some((c) => c.name.startsWith('sb-') && c.name.includes('auth-token'));
}

/** Session gate only — domain authorization is enforced in Nest + PolicyService. */
export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const isPublic = isPublicPath(path);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY (check apps/web/.env.local)',
    );
    if (!isPublic) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      return NextResponse.redirect(url);
    }
    return NextResponse.next({ request });
  }

  // Skip Auth network round-trip when there is nothing to refresh/validate.
  if (!hasSupabaseAuthCookie(request)) {
    if (!isPublic) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set('next', path);
      return NextResponse.redirect(url);
    }
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
      },
    },
  });

  let user: { id: string } | null = null;
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error) {
      // Misconfigured URL (e.g. local Docker down) surfaces as AuthRetryableFetchError.
      console.error('Supabase auth.getUser failed:', error.message);
    } else {
      user = data.user;
    }
  } catch (err) {
    console.error('Supabase auth.getUser threw:', err);
  }

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', path);
    return NextResponse.redirect(url);
  }

  if (user && (path === '/login' || path === '/signup')) {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
