import { NextResponse } from 'next/server';
import { BILLING_DISABLED_MESSAGE } from './billing-disabled';
import { isOssRuntime } from './oss-runtime';

/**
 * OSS commercial removal (root AC-012 / D-007 prefer delete): billing mutations
 * for checkout/portal/credits fail closed with 404 (not a permanent 410 facade)
 * without calling Core checkout/portal/subscribe clients.
 */
export function ossBillingGoneResponse(): NextResponse | null {
  if (!isOssRuntime()) return null;
  return NextResponse.json({ error: BILLING_DISABLED_MESSAGE }, { status: 404 });
}
