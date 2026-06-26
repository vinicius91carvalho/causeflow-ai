import { getRequestConfig } from 'next-intl/server';
import { websiteMessages } from '@/lib/i18n/compose';
import { routing } from './routing';

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;

  if (!locale || !routing.locales.includes(locale as (typeof routing.locales)[number])) {
    locale = routing.defaultLocale;
  }

  return {
    locale,
    messages: websiteMessages[locale as keyof typeof websiteMessages],
  };
});
