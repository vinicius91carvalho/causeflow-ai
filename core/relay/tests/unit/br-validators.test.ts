import { describe, it, expect } from 'vitest';
import { isValidCpf, isValidCnpj, luhnCheck, ibanMod97 } from '../../src/masking/detectors/br-validators.js';

describe('BR validators', () => {
  it('validates CPF', () => {
    expect(isValidCpf('390.533.447-05')).toBe(true);
    expect(isValidCpf('111.111.111-11')).toBe(false);
    expect(isValidCpf('12345678900')).toBe(false);
  });

  it('validates CNPJ', () => {
    expect(isValidCnpj('11.222.333/0001-81')).toBe(true);
    expect(isValidCnpj('00.000.000/0000-00')).toBe(false);
  });

  it('Luhn check', () => {
    expect(luhnCheck('4111 1111 1111 1111')).toBe(true);
    expect(luhnCheck('4111 1111 1111 1112')).toBe(false);
  });

  it('IBAN mod-97', () => {
    expect(ibanMod97('DE89370400440532013000')).toBe(true);
    expect(ibanMod97('DE89370400440532013001')).toBe(false);
  });
});
