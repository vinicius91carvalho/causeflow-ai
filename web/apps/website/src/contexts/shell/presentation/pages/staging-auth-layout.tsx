import type { Metadata } from 'next';
import '@causeflow/ui/styles';

export const metadata: Metadata = {
  title: 'Staging Access — CauseFlow AI',
  description: 'Authenticate to access the CauseFlow AI staging environment.',
  robots: { index: false, follow: false },
};

export default function StagingAuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-slate-950 antialiased">{children}</body>
    </html>
  );
}
