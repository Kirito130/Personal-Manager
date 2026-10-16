'use client';

import { createBrowserAuthClient } from '@/lib/supabase/browser-auth';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setMessage(null);
    const { auth } = createBrowserAuthClient();
    const { data, error: authError } = await auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    setPending(false);
    if (authError) {
      setError(authError.message);
      return;
    }
    if (data.session) {
      router.push('/');
      router.refresh();
      return;
    }
    setMessage('Check your email to confirm your account, then sign in.');
  }

  return (
    <div className="lifeos-panel p-8">
      <h1 className="font-display text-2xl font-semibold text-ink">Create your LifeOS account</h1>
      <p className="mt-2 text-sm text-slate-600">One workspace for personal life and organizations.</p>
      <form className="mt-6 space-y-4" onSubmit={onSubmit}>
        <div>
          <label htmlFor="email" className="mb-1 block text-sm font-medium text-slate-700">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            className="lifeos-input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="password" className="mb-1 block text-sm font-medium text-slate-700">
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            className="lifeos-input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error ? (
          <p className="text-sm text-red-800" role="alert">
            {error}
          </p>
        ) : null}
        {message ? <p className="text-sm text-teal-dark">{message}</p> : null}
        <button type="submit" className="lifeos-btn-primary w-full" disabled={pending}>
          {pending ? 'Creating…' : 'Create account'}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-600">
        Already have an account?{' '}
        <Link href="/login" className="font-medium text-teal-dark hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
