import type { Metadata } from 'next';
import { ToastProvider } from '@/contexts/shared/presentation/components/toast-provider';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/**
 * Onboarding layout — minimal layout for the 3-step onboarding flow.
 * No sidebar or dashboard chrome, just a centered card on a branded
 * gradient background. Similar to auth layout but with more vertical space
 * to accommodate the progress indicator and form content.
 */
export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <main className="min-h-dvh flex flex-col items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 px-4 py-12">
        {/* Subtle grid pattern overlay */}
        <div
          className="pointer-events-none fixed inset-0 opacity-[0.02]"
          style={{
            backgroundImage:
              'linear-gradient(to right, hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(to bottom, hsl(var(--foreground)) 1px, transparent 1px)',
            backgroundSize: '64px 64px',
          }}
          aria-hidden="true"
        />
        <div className="relative w-full max-w-5xl">{children}</div>
      </main>
    </ToastProvider>
  );
}
