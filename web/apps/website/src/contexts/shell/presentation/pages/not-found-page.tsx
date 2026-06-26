import { useTranslations } from 'next-intl';

export default function NotFound() {
  const t = useTranslations('notFound');
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4">
      <h1 className="text-6xl font-bold">404</h1>
      <p className="mt-4 text-xl text-muted-foreground">{t('title')}</p>
      <a href="/" className="mt-8 text-primary underline">
        {t('cta')}
      </a>
    </main>
  );
}
