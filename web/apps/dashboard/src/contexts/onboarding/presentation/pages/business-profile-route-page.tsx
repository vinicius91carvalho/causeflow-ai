import { getLocale } from 'next-intl/server';
import type { SupportedLocale } from '@/contexts/onboarding/domain/business-profile-types';
import { BusinessProfilePage } from '@/contexts/onboarding/presentation/pages/business-profile-page';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const rawLocale = await getLocale();
  const locale: SupportedLocale = rawLocale === 'pt-br' ? 'pt-br' : 'en';
  return <BusinessProfilePage locale={locale} />;
}
