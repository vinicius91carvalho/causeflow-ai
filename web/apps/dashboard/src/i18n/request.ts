import { getRequestConfig } from 'next-intl/server';
import { isOssRuntime } from '@/contexts/billing/application/oss-runtime';
import { dashboardMessages } from '@/lib/i18n/compose';
import { stripCommercialMessages } from '@/lib/i18n/strip-commercial-messages';
import { routing } from './routing';

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;

  if (!locale || !routing.locales.includes(locale as (typeof routing.locales)[number])) {
    locale = routing.defaultLocale;
  }

  const baseMessages = dashboardMessages[locale as keyof typeof dashboardMessages];
  const messages = isOssRuntime() ? stripCommercialMessages(baseMessages) : baseMessages;

  return {
    locale,
    messages,
  };
});
