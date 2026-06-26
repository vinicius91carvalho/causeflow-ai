'use client';

import { ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import type { MaskingSummary } from '../../../domain/feed-types';

const DETECTOR_LABELS: Record<string, string> = {
  cpf: 'CPF',
  cnpj: 'CNPJ',
  rg: 'RG',
  pis: 'PIS',
  pix_random_key: 'PIX',
  email: 'email',
  phone_br: 'phone',
  credit_card: 'card',
  bearer_token: 'bearer',
  jwt: 'JWT',
  aws_access_key: 'AWS key',
  aws_secret_key: 'AWS secret',
  gcp_api_key: 'GCP key',
  pem_block: 'PEM',
  iban: 'IBAN',
  ipv4: 'IPv4',
  ipv6: 'IPv6',
};

const SECRET_DETECTORS = new Set([
  'bearer_token',
  'jwt',
  'aws_access_key',
  'aws_secret_key',
  'gcp_api_key',
  'pem_block',
]);

function formatSummary(masking: MaskingSummary): string {
  if (masking.detections.length === 0) {
    return masking.totalFields === 1
      ? '1 field redacted'
      : `${masking.totalFields} fields redacted`;
  }
  const top = masking.detections.slice(0, 3).map((d) => {
    const label = DETECTOR_LABELS[d.detector] ?? d.detector;
    return `${d.count} ${label}${d.count === 1 ? '' : 's'}`;
  });
  const extra = masking.detections.length - 3;
  if (extra > 0) top.push(`+${extra} more`);
  return top.join(', ');
}

export function MaskingBadge({ masking }: { masking: MaskingSummary }) {
  const [open, setOpen] = useState(false);
  if (masking.totalFields === 0) return null;

  const summary = formatSummary(masking);
  const hasSecrets = masking.detections.some((d) => SECRET_DETECTORS.has(d.detector));

  return (
    <div className="relative">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold transition-colors ${
          hasSecrets
            ? 'bg-destructive/15 text-destructive hover:bg-destructive/20'
            : 'bg-success/15 text-success hover:bg-success/20'
        }`}
        title="PII and secrets were redacted by the relay before reaching the control plane"
        aria-expanded={open}
      >
        <ShieldCheck className="h-3 w-3 shrink-0" />
        <span>{summary}</span>
      </button>
      {open && masking.detections.length > 0 && (
        <div className="absolute left-0 top-full z-10 mt-1 min-w-[10rem] rounded-md border bg-popover p-2 text-[11px] text-popover-foreground shadow-md">
          <div className="mb-1 text-muted-foreground">Masked by relay</div>
          <ul className="space-y-0.5">
            {masking.detections.map((d) => (
              <li key={d.detector} className="flex items-center justify-between gap-3">
                <span className="font-mono">{DETECTOR_LABELS[d.detector] ?? d.detector}</span>
                <span className="text-muted-foreground">{d.count}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
