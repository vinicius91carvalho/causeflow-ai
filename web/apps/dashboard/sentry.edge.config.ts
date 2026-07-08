import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NEXT_PUBLIC_DEPLOYMENT_STAGE || 'development',

  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // SOC2/GDPR/LGPD: scrub PII before sending
  beforeSend(event) {
    if (event.request?.headers) {
      delete event.request.headers.authorization;
      delete event.request.headers.cookie;
      delete event.request.headers['x-api-key'];
      delete event.request.headers['x-clerk-auth-token'];
      delete event.request.headers['x-session-token'];
    }
    // Scrub request body (may contain tokens/credentials)
    if (event.request?.data) {
      // AC-042: wholesale scrub of request.data satisfies the "same redaction
      // in the observability layer" requirement.
      delete event.request.data;
    }
    // Scrub cookies
    if (event.request?.cookies) {
      delete event.request.cookies;
    }
    if (event.user) {
      delete event.user.ip_address;
      // Scrub user email (may be auto-captured)
      delete event.user.email;
    }
    return event;
  },
});
