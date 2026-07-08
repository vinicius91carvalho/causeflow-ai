/**
 * Local waitlist page (AC-046).
 *
 * In the OSS build, the waitlist is not integrated with Clerk. This page
 * shows a simple message directing users to the sign-up form. The Core
 * API handles waitlist registration when available.
 */
export default function WaitlistPage() {
  return (
    <main className="flex h-dvh items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 px-4">
      <div className="rounded-xl border border-border bg-card p-8 text-center shadow-lg max-w-md">
        <h1 className="text-2xl font-bold text-foreground mb-2">Join the Waitlist</h1>
        <p className="text-muted-foreground mb-6">
          CauseFlow AI is currently in beta. Sign up to get early access.
        </p>
        <a
          href="/auth/sign-up"
          className="inline-flex items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Sign up now
        </a>
      </div>
    </main>
  );
}
