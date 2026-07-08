'use client';

import { useAuth, useSignUp } from '@clerk/nextjs';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';

export default function AcceptInvitationClient() {
  const { isSignedIn } = useAuth();
  const { signUp, errors, fetchStatus } = useSignUp() as any;
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (isSignedIn || signUp?.status === 'complete') {
      router.push('/dashboard');
    }
  }, [isSignedIn, signUp?.status, router]);

  const ticket = searchParams.get('__clerk_ticket');

  if (!ticket) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="rounded-xl border border-border bg-card p-8 text-center shadow-lg max-w-md">
          <h1 className="text-xl font-bold text-foreground mb-2">Invalid Invitation</h1>
          <p className="text-muted-foreground">
            No invitation token found. Please check the link in your email.
          </p>
        </div>
      </div>
    );
  }

  const handleSubmit = async (formData: FormData) => {
    if (!signUp) return;
    const firstName = formData.get('firstName') as string;
    const lastName = formData.get('lastName') as string;
    const legalAccepted = formData.get('legalAccepted') === 'on';

    const { error } = await signUp.ticket({
      firstName,
      lastName,
      ticket,
      legalAccepted,
    });

    if (error) {
      console.error(JSON.stringify(error, null, 2));
      return;
    }

    if (signUp.status === 'complete') {
      await signUp.finalize({
        navigate: ({ session, decorateUrl }: any) => {
          if (session?.currentTask) {
            router.push('/create-organization');
            return;
          }
          const url = decorateUrl('/dashboard');
          if (url.startsWith('http')) {
            window.location.href = url;
          } else {
            router.push(url);
          }
        },
      });
    } else if (signUp.status === 'missing_requirements') {
      // Clerk requires additional fields (e.g. password) — redirect to SignUp
      // The ticket is already associated with the sign-up attempt
      router.push(`/auth/sign-up#__clerk_ticket=${ticket}`);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 shadow-lg">
        <h1 className="text-2xl font-bold text-foreground text-center mb-2">Create your account</h1>
        <p className="text-muted-foreground text-center mb-6">
          Complete your profile to get started with CauseFlow.
        </p>
        <form action={handleSubmit} className="flex flex-col gap-4">
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
            {errors?.fields?.firstName && (
              <p className="mt-1 text-sm text-destructive">{errors.fields.firstName.message}</p>
            )}
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
            {errors?.fields?.lastName && (
              <p className="mt-1 text-sm text-destructive">{errors.fields.lastName.message}</p>
            )}
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
              <Link
                href="https://causeflow.ai/terms"
                className="text-primary hover:underline"
                target="_blank"
              >
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link
                href="https://causeflow.ai/privacy"
                className="text-primary hover:underline"
                target="_blank"
              >
                Privacy Policy
              </Link>
            </label>
          </div>
          {errors?.fields?.legalAccepted && (
            <p className="text-sm text-destructive">{errors.fields.legalAccepted.message}</p>
          )}
          <button
            type="submit"
            disabled={fetchStatus === 'fetching'}
            className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {fetchStatus === 'fetching' ? 'Creating account...' : 'Create account'}
          </button>
        </form>
        {errors?.global && (
          <div className="mt-4 rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
            {errors.global.map((e: any, i: number) => (
              <p key={i}>{e.message}</p>
            ))}
          </div>
        )}
        <div id="clerk-captcha" className="mt-4" />
      </div>
    </div>
  );
}
