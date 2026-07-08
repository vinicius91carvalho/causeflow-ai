'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

export default function AcceptInvitationClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const ticket = searchParams.get('ticket') ?? searchParams.get('__clerk_ticket');

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const name =
      `${formData.get('firstName') as string} ${formData.get('lastName') as string}`.trim();
    const legalAccepted = formData.get('legalAccepted') === 'on';

    if (!legalAccepted) {
      setError('You must accept the Terms of Service and Privacy Policy.');
      setSubmitting(false);
      return;
    }

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          password,
          ...(ticket ? { inviteToken: ticket } : {}),
        }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        setError(body.message ?? 'Failed to accept invitation');
        setSubmitting(false);
        return;
      }

      router.push('/dashboard');
    } catch {
      setError('Unable to connect. Please try again.');
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 shadow-lg">
        <h1 className="text-2xl font-bold text-foreground text-center mb-2">Accept Invitation</h1>
        <p className="text-muted-foreground text-center mb-6">
          Create your account to accept the invitation.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label htmlFor="firstName" className="text-sm font-medium text-foreground">
              First name
            </label>
            <input
              id="firstName"
              name="firstName"
              type="text"
              required
              className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Your first name"
            />
          </div>
          <div>
            <label htmlFor="lastName" className="text-sm font-medium text-foreground">
              Last name
            </label>
            <input
              id="lastName"
              name="lastName"
              type="text"
              required
              className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Your last name"
            />
          </div>
          <div>
            <label htmlFor="email" className="text-sm font-medium text-foreground">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Your email"
            />
          </div>
          <div>
            <label htmlFor="password" className="text-sm font-medium text-foreground">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Create a password"
            />
          </div>
          <div className="flex items-start gap-2">
            <input
              id="legalAccepted"
              name="legalAccepted"
              type="checkbox"
              required
              className="mt-1 rounded border-input"
            />
            <label htmlFor="legalAccepted" className="text-sm text-muted-foreground">
              I agree to the{' '}
              <a
                href="https://causeflow.ai/terms"
                className="text-primary hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                Terms of Service
              </a>{' '}
              and{' '}
              <a
                href="https://causeflow.ai/privacy"
                className="text-primary hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                Privacy Policy
              </a>
            </label>
          </div>

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {submitting ? 'Creating account...' : 'Accept invitation'}
          </button>
        </form>
      </div>
    </div>
  );
}
