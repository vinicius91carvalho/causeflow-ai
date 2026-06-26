import type { Detection, Transformer } from '../detector.port.js';

const REPLACEMENTS: Record<string, string> = {
  cpf: '***.***.***-**',
  cnpj: '**.***.***/****-**',
  rg: '**.***.***-*',
  pis: '***.*****.**-*',
  email: '***@***.***',
  phone_br: '(**) *****-****',
  credit_card: '****-****-****-****',
  bearer_token: 'Bearer ***',
  jwt: 'eyJ***.***.***',
  aws_access_key: 'AKIA****************',
  aws_secret_key: '****_AWS_SECRET_****',
  gcp_api_key: 'AIza***********************************',
  pem_block: '-----REDACTED PEM BLOCK-----',
  iban: '****-****-****-****',
  ipv4: '***.***.***.***',
  ipv6: '****:****:****:****:****:****:****:****',
  pix_random_key: '********-****-****-****-************',
};

export class MaskTransformer implements Transformer {
  apply(detection: Detection, _original: string): string {
    return REPLACEMENTS[detection.detector] ?? '***';
  }
}
