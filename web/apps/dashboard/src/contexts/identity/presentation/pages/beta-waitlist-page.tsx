import { Mail, Rocket } from 'lucide-react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Beta Access',
  description: 'CauseFlow AI is currently in private beta.',
};

/**
 * Beta waitlist page shown to authenticated users whose email
 * is not on the beta allowlist in production.
 */
export function BetaWaitlistPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="mx-auto max-w-md text-center">
        <div className="mb-6 flex justify-center">
          <div className="rounded-full bg-primary/10 p-4">
            <Rocket className="h-10 w-10 text-primary" />
          </div>
        </div>

        <h1 className="mb-3 font-bold text-2xl text-foreground tracking-tight">We're in beta</h1>

        <p className="mb-6 text-muted-foreground leading-relaxed">
          CauseFlow AI is currently in private beta. We will send you an email soon when your
          account is activated.
        </p>

        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm">
            <Mail className="h-4 w-4" />
            <span>
              Questions? Contact us at{' '}
              <a
                href="mailto:adm@causeflow.ai"
                className="font-medium text-primary hover:underline"
              >
                adm@causeflow.ai
              </a>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BetaWaitlistRoutePage() {
  return <BetaWaitlistPage />;
}
