import { describe, expect, it } from 'vitest';
import { FOOTER_COMPANY_LINKS, FOOTER_PRODUCT_LINKS, HEADER_NAV_ITEMS } from './navigation';

describe('HEADER_NAV_ITEMS', () => {
  it('includes Docs link to docs.causeflow.ai', () => {
    const docs = HEADER_NAV_ITEMS.find((item) => item.label === 'Docs');
    expect(docs).toBeDefined();
    expect(docs?.href).toBe('https://docs.causeflow.ai');
  });
});

describe('FOOTER_PRODUCT_LINKS', () => {
  it('includes Docs link', () => {
    const docs = FOOTER_PRODUCT_LINKS.find((item) => item.label === 'Docs');
    expect(docs).toBeDefined();
    expect(docs?.href).toBe('https://docs.causeflow.ai');
  });
});

describe('FOOTER_COMPANY_LINKS', () => {
  it('includes Platform Status link', () => {
    const status = FOOTER_COMPANY_LINKS.find((item) => item.label === 'Platform Status');
    expect(status).toBeDefined();
  });
});
