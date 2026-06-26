'use client';

import { useEffect, useState } from 'react';
import type { BusinessProfile } from '@/contexts/onboarding/domain/business-profile-types';
import { BusinessProfileCard } from './business-profile-card';

export function BusinessProfileCardWrapper() {
  const [profile, setProfile] = useState<BusinessProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/onboarding/business-profile')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.profile) setProfile(data.profile);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return null;

  return (
    <BusinessProfileCard
      profile={profile}
      onResyncComplete={() => {
        fetch('/api/onboarding/business-profile')
          .then((r) => r.json())
          .then(({ profile: p }: { profile: BusinessProfile | null }) => setProfile(p))
          .catch(() => {});
      }}
    />
  );
}
