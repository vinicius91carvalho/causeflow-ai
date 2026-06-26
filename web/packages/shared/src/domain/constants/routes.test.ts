import { describe, expect, it } from 'vitest';
import { ROUTES } from './routes';

describe('ROUTES', () => {
  it('HOME equals "/"', () => {
    expect(ROUTES.HOME).toBe('/');
  });

  it('PRODUCT equals "/product"', () => {
    expect(ROUTES.PRODUCT).toBe('/product');
  });

  it('INTEGRATIONS equals "/integrations"', () => {
    expect(ROUTES.INTEGRATIONS).toBe('/integrations');
  });

  it('PRICING equals "/pricing"', () => {
    expect(ROUTES.PRICING).toBe('/pricing');
  });

  it('ABOUT equals "/about"', () => {
    expect(ROUTES.ABOUT).toBe('/about');
  });

  it('SECURITY equals "/security"', () => {
    expect(ROUTES.SECURITY).toBe('/security');
  });

  it('GET_STARTED equals "/get-started"', () => {
    expect(ROUTES.GET_STARTED).toBe('/get-started');
  });
});
