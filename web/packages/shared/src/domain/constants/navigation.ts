import type { NavItem } from '../types';
import { ROUTES } from './routes';
import { SITE } from './site';

export const HEADER_NAV_ITEMS: NavItem[] = [
  { label: 'Product', href: ROUTES.PRODUCT },
  { label: 'Integrations', href: ROUTES.INTEGRATIONS },
  { label: 'Pricing', href: ROUTES.PRICING },
  { label: 'Security', href: ROUTES.SECURITY },
  { label: 'Docs', href: SITE.docsUrl },
];

export const FOOTER_PRODUCT_LINKS: NavItem[] = [
  { label: 'How It Works', href: ROUTES.PRODUCT },
  { label: 'Integrations', href: ROUTES.INTEGRATIONS },
  { label: 'Security', href: ROUTES.SECURITY },
  { label: 'Pricing', href: ROUTES.PRICING },
  { label: 'Docs', href: SITE.docsUrl },
];

export const FOOTER_COMPANY_LINKS: NavItem[] = [
  { label: 'Contact', href: `mailto:${SITE.email}` },
  { label: 'Platform Status', href: 'https://status.causeflow.ai' },
];

export const FOOTER_LEGAL_LINKS: NavItem[] = [
  { label: 'Privacy Policy', href: ROUTES.PRIVACY },
  { label: 'Terms of Service', href: ROUTES.TERMS },
  { label: 'LGPD/GDPR', href: ROUTES.PRIVACY },
];
