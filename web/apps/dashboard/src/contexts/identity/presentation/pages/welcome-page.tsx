'use client';

import { cn } from '@causeflow/ui/lib';
import { Button } from '@causeflow/ui/primitives';
import { ArrowRight } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { isOssBuildClient } from '@/contexts/billing/application/oss-runtime';
import { BASE_SETUP_STEPS, type SetupStep } from './welcome-setup-steps';

/* ------------------------------------------------------------------ */
/*  Setup step card                                                    */
/* ------------------------------------------------------------------ */

function StepCard({ icon: Icon, title, description, href, completed }: SetupStep) {
  return (
    <Link
      href={href}
      className={cn(
        'group flex items-start gap-4 rounded-xl border border-border bg-card p-4 shadow-sm',
        'hover:border-primary/30 hover:shadow-md transition-all',
        completed && 'opacity-60',
      )}
    >
      <div
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
          completed ? 'bg-success/10 /30' : 'bg-primary/10',
        )}
      >
        <Icon className={cn('h-5 w-5', completed ? 'text-success' : 'text-primary')} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
          {title}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
      <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1 group-hover:text-primary transition-colors" />
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

/**
 * Welcome page (AC-083): OSS path only ever references BASE_SETUP_STEPS.
 * Commercial choose-plan literals live in welcome-setup-steps-commercial.ts and
 * are loaded dynamically so they never exist in the OSS module / initial HTML.
 */
export default function WelcomePage() {
  const [steps, setSteps] = useState<SetupStep[]>(BASE_SETUP_STEPS);

  useEffect(() => {
    if (isOssBuildClient()) return;
    let cancelled = false;
    void import('./welcome-setup-steps-commercial').then((mod) => {
      if (!cancelled) setSteps(mod.getCommercialSetupSteps());
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-6">
      {/* Card */}
      <div className="rounded-2xl border border-border bg-card shadow-xl shadow-black/5 dark:shadow-black/20 p-6 sm:p-8 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        {/* Logo + heading */}
        <div className="text-center space-y-3">
          <div className="flex justify-center mb-2">
            <Image
              src="/logo.png"
              alt="CauseFlow AI"
              width={160}
              height={40}
              className="h-10 w-auto object-contain"
              priority
            />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Welcome to CauseFlow
          </h1>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Let&apos;s get your environment set up. Complete these steps to start using AI-powered
            incident resolution.
          </p>
        </div>

        {/* Steps */}
        <div className="space-y-3">
          {steps.map((step) => (
            <StepCard key={step.title} {...step} />
          ))}
        </div>

        {/* Get Started CTA */}
        <div className="text-center pt-2">
          <Link href="/onboarding/integrations">
            <Button className="gap-2">
              Get Started
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
