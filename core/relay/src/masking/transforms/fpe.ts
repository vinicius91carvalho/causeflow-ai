import { createHmac } from 'node:crypto';
import type { Detection, Transformer } from '../detector.port.js';

/**
 * Format-preserving transformation via HMAC-derived deterministic tokens.
 *
 * Not true NIST FF1 FPE (which would require a dedicated library such as
 * ubiq-security-fpe). This is a lighter-weight alternative for correlation:
 * same input → same pseudonym, length roughly preserved, charset preserved.
 *
 * Use the `fpe` transform only when the downstream agent needs to correlate
 * records across rows without seeing the real value.
 */
export class FpeTransformer implements Transformer {
  constructor(private readonly key: string) {}

  apply(detection: Detection, _original: string): string {
    const pseudonym = createHmac('sha256', this.key).update(detection.match).digest('hex');
    return mapCharset(detection.match, pseudonym);
  }
}

function mapCharset(original: string, digest: string): string {
  let out = '';
  let cursor = 0;
  for (const ch of original) {
    const next = () => {
      const v = digest[cursor % digest.length]!;
      cursor++;
      return v;
    };
    if (/\d/.test(ch)) {
      out += (parseInt(next(), 16) % 10).toString();
    } else if (/[a-z]/.test(ch)) {
      out += String.fromCharCode(97 + (parseInt(next(), 16) % 26));
    } else if (/[A-Z]/.test(ch)) {
      out += String.fromCharCode(65 + (parseInt(next(), 16) % 26));
    } else {
      out += ch;
    }
  }
  return out;
}
