'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import type {
  BusinessProfile,
  BusinessProfileFormSchema,
  SupportedLocale,
} from '@/contexts/onboarding/domain/business-profile-types';
import { BusinessProfileWizard } from '@/contexts/onboarding/presentation/components/business-profile/wizard';
import { CauseFlowLoader } from '@/contexts/shared/presentation/components/causeflow-loader';
import { useToast } from '@/contexts/shared/presentation/components/toast-provider';

interface BusinessProfilePageProps {
  locale: SupportedLocale;
}

export function BusinessProfilePage({ locale }: BusinessProfilePageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isEditMode = searchParams.get('edit') === '1';
  const { addToast } = useToast();

  const [schema, setSchema] = useState<BusinessProfileFormSchema | null>(null);
  const [existingProfile, setExistingProfile] = useState<BusinessProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        const [schemaRes, profileRes] = await Promise.all([
          fetch('/api/onboarding/business-profile/schema'),
          fetch('/api/onboarding/business-profile'),
        ]);

        if (!schemaRes.ok) {
          throw new Error('Failed to load profile form.');
        }

        const { schema: loadedSchema } = (await schemaRes.json()) as {
          schema: BusinessProfileFormSchema;
        };
        setSchema(loadedSchema);

        if (profileRes.ok) {
          const { profile } = (await profileRes.json()) as { profile: BusinessProfile | null };
          setExistingProfile(profile);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load profile form.');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const handleSubmit = useCallback(
    async (answers: Record<string, unknown>, submittedLocale: SupportedLocale) => {
      if (!schema) return;

      const res = await fetch('/api/onboarding/business-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schemaVersion: schema.version,
          answers,
          locale: submittedLocale,
        }),
      });

      if (!res.ok) {
        // Non-blocking: show toast but still proceed
        addToast(
          'Profile saved but Hindsight sync may have failed. You can resync from Settings.',
          'warning',
        );
      }

      // Always redirect regardless of Hindsight status
      if (isEditMode) {
        router.replace('/dashboard/settings');
      } else {
        router.replace('/dashboard?welcome=1');
      }
    },
    [schema, isEditMode, router, addToast],
  );

  const handleSkip = useCallback(async () => {
    try {
      await fetch('/api/onboarding/business-profile/skip', { method: 'POST' });
    } catch {
      // Skip should not block navigation
    }
    router.replace('/dashboard');
  }, [router]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <CauseFlowLoader size="md" message="Loading profile..." />
      </div>
    );
  }

  if (error || !schema) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <p className="text-sm text-muted-foreground">{error ?? 'Failed to load form.'}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="text-sm underline underline-offset-2"
        >
          Try again
        </button>
      </div>
    );
  }

  const initialAnswers =
    isEditMode && existingProfile?.answers
      ? (existingProfile.answers as Record<string, unknown>)
      : undefined;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8">
      <BusinessProfileWizard
        schema={schema}
        locale={locale}
        initialAnswers={initialAnswers}
        onSubmit={handleSubmit}
        onSkip={handleSkip}
      />
    </div>
  );
}
