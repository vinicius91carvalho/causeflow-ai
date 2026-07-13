import { NextResponse } from 'next/server';
import { BILLING_DISABLED_MESSAGE } from './billing-disabled';
import { isOssRuntime } from './oss-runtime';

/**
 * OSS commercial removal (AC-075): billing mutations fail closed with 410 Gone
 * without calling Core checkout/portal/subscribe clients.
 */
export function ossBillingGoneResponse(): NextResponse | null {
  if (!isOssRuntime()) return null;
  return NextResponse.json({ error: BILLING_DISABLED_MESSAGE }, { status: 410 });
}
