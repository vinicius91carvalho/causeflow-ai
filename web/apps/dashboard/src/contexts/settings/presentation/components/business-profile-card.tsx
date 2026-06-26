'use client';

import { cn } from '@causeflow/ui/lib';
import { CheckCircle, Clock, Loader2, RefreshCw, SkipForward, XCircle } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { PERMISSION } from '@/contexts/identity/domain/rbac/permissions';
import { usePermission } from '@/contexts/identity/domain/rbac/role-guard';
import type { BusinessProfile } from '@/contexts/onboarding/domain/business-profile-types';
import { useToast } from '@/contexts/shared/presentation/components/toast-provider';

interface BusinessProfileCardProps {
  profile: BusinessProfile | null;
  onResyncComplete?: () => void;
}

type ProfileState = 'not_started' | 'skipped' | 'submitted' | 'failed';

function getProfileState(profile: BusinessProfile | null): ProfileState {
  if (!profile) return 'not_started';
  if (profile.skippedAt && !profile.submittedAt) return 'skipped';
  if (profile.submittedAt && profile.hindsightStatus === 'failed') return 'failed';
  if (profile.submittedAt) return 'submitted';
  return 'not_started';
}

export function BusinessProfileCard({ profile, onResyncComplete }: BusinessProfileCardProps) {
  const canManage = usePermission(PERMISSION.MANAGE_SETTINGS);
  const { addToast } = useToast();
  const [resyncing, setResyncing] = useState(false);
  const state = getProfileState(profile);

  // Derived from profile prop — used for resync button visibility
  const hindsightStatus = profile?.hindsightStatus;
  const locale = profile?.locale;

  async function handleResync() {
    setResyncing(true);
    try {
      const res = await fetch('/api/onboarding/business-profile/resync', { method: 'POST' });
      const data = (await res.json()) as { hindsightStatus: string };
      if (data.hindsightStatus === 'sent') {
        addToast('Business profile sent to AI memory.', 'success');
        onResyncComplete?.();
      } else {
        addToast('Could not sync profile to AI memory. Try again later.', 'error');
      }
    } catch {
      addToast('Network error. Try again later.', 'error');
    } finally {
      setResyncing(false);
    }
  }

  const submittedLabel = profile?.submittedAt
    ? `Submitted · ${locale?.toUpperCase() ?? 'EN'} · ${new Date(profile.submittedAt).toLocaleDateString()}`
    : 'Profile submitted.';

  const stateConfig = {
    not_started: {
      icon: Clock,
      iconClass: 'text-muted-foreground',
      label: 'Not started',
      description: 'Complete your business profile to give CauseFlow context about your company.',
    },
    skipped: {
      icon: SkipForward,
      iconClass: 'text-muted-foreground',
      label: 'Skipped',
      description: 'You skipped the business profile. Complete it to improve AI analysis quality.',
    },
    submitted: {
      icon: CheckCircle,
      iconClass: 'text-success',
      label: submittedLabel,
      description: 'AI memory is up to date with your company context.',
    },
    failed: {
      icon: XCircle,
      iconClass: 'text-destructive',
      label: 'Sync failed',
      description: 'Profile was saved but AI memory sync failed. Click Resync to retry.',
    },
  } as const;

  const { icon: Icon, iconClass, label, description } = stateConfig[state];

  const actionLabel =
    state === 'not_started' || state === 'skipped' ? 'Complete profile' : 'Edit profile';

  return (
    <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Icon className={cn('mt-0.5 h-5 w-5 shrink-0', iconClass)} />
          <div>
            <p className="text-sm font-medium text-foreground">Business Profile</p>
            <p className="mt-0.5 text-xs font-medium text-muted-foreground">{label}</p>
            <p className="mt-1 text-xs text-muted-foreground">{description}</p>
          </div>
        </div>

        {canManage && (
          <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
            <Link
              href="/onboarding/business-profile?edit=1"
              className={cn(
                'rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium',
                'hover:bg-accent transition-colors',
              )}
            >
              {actionLabel}
            </Link>

            {hindsightStatus === 'failed' && (
              <button
                type="button"
                onClick={handleResync}
                disabled={resyncing}
                className={cn(
                  'flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium',
                  'hover:bg-accent transition-colors disabled:pointer-events-none disabled:opacity-50',
                )}
              >
                {resyncing ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <RefreshCw className="h-3 w-3" />
                )}
                Resync to memory
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
