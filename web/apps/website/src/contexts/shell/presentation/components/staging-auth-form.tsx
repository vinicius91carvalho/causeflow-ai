'use client';

import { useActionState } from 'react';
import { authenticateStaging } from '@/contexts/shell/api/actions';

export default function StagingAuthForm() {
  const [state, formAction, isPending] = useActionState(authenticateStaging, null);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-sm">
        {/* Branding */}
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-white">CauseFlow AI</h1>
          <p className="mt-1 text-sm text-slate-400">Staging Environment</p>
        </div>

        {/* Card */}
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-8 shadow-xl">
          <h2 className="mb-6 text-base font-semibold text-slate-200">Sign in to continue</h2>

          <form action={formAction} className="space-y-4">
            {/* Username field */}
            <div>
              <label htmlFor="username" className="mb-1.5 block text-sm font-medium text-slate-300">
                Username
              </label>
              <input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                required
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 outline-none transition-colors focus:border-slate-500 focus:ring-2 focus:ring-slate-500/30"
                placeholder="Enter username"
              />
            </div>

            {/* Password field */}
            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-slate-300">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 outline-none transition-colors focus:border-slate-500 focus:ring-2 focus:ring-slate-500/30"
                placeholder="Enter password"
              />
            </div>

            {/* Error message */}
            {state?.error && (
              <p role="alert" className="text-sm text-red-400">
                {state.error}
              </p>
            )}

            {/* Submit button */}
            <button
              type="submit"
              disabled={isPending}
              className="mt-2 w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPending ? 'Verifying…' : 'Access Staging'}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
