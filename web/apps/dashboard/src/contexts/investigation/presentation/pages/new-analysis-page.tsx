import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

// Redirect to the new incidents route
export default function NewAnalysisPage() {
  redirect('/dashboard/incidents/new');
}
