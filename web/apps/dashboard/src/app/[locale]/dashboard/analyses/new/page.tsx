export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';

// Redirect to the new incidents route
export default function NewAnalysisPage() {
  redirect('/dashboard/incidents/new');
}
