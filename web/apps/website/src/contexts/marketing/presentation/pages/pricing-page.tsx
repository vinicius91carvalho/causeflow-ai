import { notFound } from 'next/navigation';

/** Root AC-003: /pricing hard-removed — framework not-found (no redirect, no plan cards). */
export default function PricingPage() {
  notFound();
}
