import { SITE } from '@causeflow/shared/constants';
import { redirect } from 'next/navigation';

/** AC-078: legacy /pricing bookmarks redirect to published OSS docs (no paid plan cards). */
export default function PricingPage() {
  redirect(SITE.docsUrl);
}
