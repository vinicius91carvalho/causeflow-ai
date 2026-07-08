import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ locale: string; id: string }>;
};

// Redirect to the new incidents route
export default async function AnalysisDetailPage({ params }: Props) {
  const { id } = await params;
  redirect(`/dashboard/incidents/${id}`);
}
