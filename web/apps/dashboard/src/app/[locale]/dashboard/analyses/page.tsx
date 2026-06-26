export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';

// Redirect to the new incidents route
export default function AnalysesPage() {
  redirect('/dashboard/incidents');
}
