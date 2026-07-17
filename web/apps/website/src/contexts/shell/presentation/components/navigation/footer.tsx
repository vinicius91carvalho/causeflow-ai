import { ROUTES, SITE } from '@causeflow/shared/constants';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';

const productLinks = [
  { label: 'Product', href: ROUTES.PRODUCT, external: false },
  { label: 'Integrations', href: ROUTES.INTEGRATIONS, external: false },
  { label: 'Security', href: ROUTES.SECURITY, external: false },
  { label: 'About', href: ROUTES.ABOUT, external: false },
  { label: 'Docs', href: SITE.docsUrl, external: true },
];

const legalLinks = [
  { labelKey: 'footer.privacyPolicy', href: ROUTES.PRIVACY },
  { labelKey: 'footer.termsOfService', href: ROUTES.TERMS },
];

export async function Footer() {
  const t = await getTranslations('common');

  return (
    <footer className="border-t border-border bg-muted/50">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand column — OSS project identity (no company-sales LLC chrome) */}
          <div>
            <div className="font-bold text-lg">
              <span className="text-foreground">CauseFlow</span>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">{t('footer.description')}</p>
          </div>

          {/* Product column */}
          <div>
            <h3 className="text-sm font-semibold">{t('footer.productColumn')}</h3>
            <ul className="mt-4 space-y-2">
              {productLinks.map((link) => (
                <li key={link.href}>
                  {link.external ? (
                    <a
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-muted-foreground hover:text-foreground"
                    >
                      {t(`nav.${link.label.toLowerCase()}`)}
                    </a>
                  ) : (
                    <Link
                      href={link.href}
                      className="text-sm text-muted-foreground hover:text-foreground"
                    >
                      {t(`nav.${link.label.toLowerCase()}`)}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* Connect column — OSS: GitHub + LinkedIn; no founder/early-access conversion CTAs */}
          <div>
            <h3 className="text-sm font-semibold">{t('footer.connectColumn')}</h3>
            <ul className="mt-4 space-y-2">
              <li>
                <a
                  href={SITE.social.github}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  GitHub
                </a>
              </li>
              <li>
                <a
                  href={SITE.social.linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  LinkedIn
                </a>
              </li>
            </ul>
          </div>

          {/* Legal column */}
          <div>
            <h3 className="text-sm font-semibold">{t('footer.legalColumn')}</h3>
            <ul className="mt-4 space-y-2">
              {legalLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground hover:text-foreground"
                  >
                    {t(link.labelKey)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-border pt-8 sm:flex-row">
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} CauseFlow. All rights reserved.
          </p>
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground">
              {t('footer.lgpdCompliant')}
            </span>
            <span className="inline-flex items-center rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground">
              {t('footer.gdprCompliant')}
            </span>
            <span className="inline-flex items-center rounded-full border border-dashed border-border px-2.5 py-0.5 text-xs text-muted-foreground">
              {t('footer.soc2TypeII')}
            </span>
            <span className="inline-flex items-center rounded-full border border-dashed border-border px-2.5 py-0.5 text-xs text-muted-foreground">
              {t('footer.iso27001')}
            </span>
            <span className="inline-flex items-center rounded-full border border-dashed border-border px-2.5 py-0.5 text-xs text-muted-foreground">
              {t('footer.hipaa')}
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
