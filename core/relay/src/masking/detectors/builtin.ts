import type { IDetector } from '../detector.port.js';
import { RegexDetector } from './regex-detector.js';
import { isValidCpf, isValidCnpj, luhnCheck, ibanMod97 } from './br-validators.js';

export function cpfDetector(): IDetector {
  return new RegexDetector(
    'cpf',
    'pii',
    /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g,
    isValidCpf,
  );
}

export function cnpjDetector(): IDetector {
  return new RegexDetector(
    'cnpj',
    'pii',
    /\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g,
    isValidCnpj,
  );
}

export function rgDetector(): IDetector {
  return new RegexDetector(
    'rg',
    'pii',
    /\b\d{1,2}\.\d{3}\.\d{3}-?[\dxX]\b/g,
  );
}

export function pisDetector(): IDetector {
  return new RegexDetector(
    'pis',
    'pii',
    /\b\d{3}\.?\d{5}\.?\d{2}-?\d\b/g,
  );
}

export function emailDetector(): IDetector {
  return new RegexDetector(
    'email',
    'pii',
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
  );
}

export function phoneBrDetector(): IDetector {
  return new RegexDetector(
    'phone_br',
    'pii',
    /(?:\+55\s?)?(?:\(\d{2}\)\s?|\d{2}\s?)?9?\d{4}[-\s]?\d{4}\b/g,
    (m) => {
      const digits = m.replace(/\D/g, '');
      return digits.length >= 10 && digits.length <= 13;
    },
  );
}

export function creditCardDetector(): IDetector {
  return new RegexDetector(
    'credit_card',
    'pci',
    /\b(?:\d[ -]*?){13,19}\b/g,
    luhnCheck,
  );
}

export function bearerDetector(): IDetector {
  return new RegexDetector(
    'bearer_token',
    'secret',
    /\bBearer\s+[A-Za-z0-9\-._~+/]{16,}=*/g,
  );
}

export function jwtDetector(): IDetector {
  return new RegexDetector(
    'jwt',
    'secret',
    /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g,
  );
}

export function awsAccessKeyDetector(): IDetector {
  return new RegexDetector(
    'aws_access_key',
    'secret',
    /\b(?:AKIA|ASIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASCA)[A-Z0-9]{16}\b/g,
  );
}

export function awsSecretKeyDetector(): IDetector {
  return new RegexDetector(
    'aws_secret_key',
    'secret',
    /\b(?:aws_secret_access_key|AWS_SECRET_ACCESS_KEY|secret_key)\s*[=:]\s*['"]?[A-Za-z0-9/+]{40}['"]?/g,
  );
}

export function gcpKeyDetector(): IDetector {
  return new RegexDetector(
    'gcp_api_key',
    'secret',
    /\bAIza[0-9A-Za-z_\-]{35}\b/g,
  );
}

export function pemBlockDetector(): IDetector {
  return new RegexDetector(
    'pem_block',
    'secret',
    /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP |ENCRYPTED |)?(?:PRIVATE KEY|CERTIFICATE)-----[\s\S]*?-----END (?:RSA |EC |DSA |OPENSSH |PGP |ENCRYPTED |)?(?:PRIVATE KEY|CERTIFICATE)-----/g,
  );
}

export function ibanDetector(): IDetector {
  return new RegexDetector(
    'iban',
    'pci',
    /\b[A-Z]{2}\d{2}[A-Z0-9]{4}[A-Z0-9]{4}[A-Z0-9]{4}[A-Z0-9]{0,20}\b/g,
    ibanMod97,
  );
}

export function ipv4Detector(): IDetector {
  return new RegexDetector(
    'ipv4',
    'business',
    /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g,
  );
}

export function ipv6Detector(): IDetector {
  return new RegexDetector(
    'ipv6',
    'business',
    /\b(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}\b/g,
  );
}

export function pixDetector(): IDetector {
  return new RegexDetector(
    'pix_random_key',
    'pii',
    /\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b/g,
  );
}
