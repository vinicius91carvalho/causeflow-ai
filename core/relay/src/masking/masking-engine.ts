import fastRedact from 'fast-redact';
import type { IDetector, Detection, TransformAction } from './detector.port.js';
import type { MaskingConfig, ColumnRule } from '../config/schema.js';
import { RegexDetector } from './detectors/regex-detector.js';
import { MaskTransformer } from './transforms/mask.js';
import { DropTransformer } from './transforms/drop.js';
import { FpeTransformer } from './transforms/fpe.js';
import {
  cpfDetector,
  cnpjDetector,
  rgDetector,
  pisDetector,
  pixDetector,
  emailDetector,
  phoneBrDetector,
  creditCardDetector,
  bearerDetector,
  jwtDetector,
  awsAccessKeyDetector,
  awsSecretKeyDetector,
  gcpKeyDetector,
  pemBlockDetector,
  ibanDetector,
  ipv4Detector,
  ipv6Detector,
} from './detectors/builtin.js';

export interface MaskResult {
  masked: unknown;
  detections: { detector: string; count: number }[];
  maskedFieldCount: number;
}

export interface MaskContext {
  resourceId?: string;
  table?: string;
  columnRules?: ColumnRule[];
}

export class MaskingEngine {
  private detectors: IDetector[] = [];
  private enabled: boolean;
  private maskTransformer: MaskTransformer;
  private dropTransformer: DropTransformer;
  private fpeTransformer: FpeTransformer | null;
  private structuredRedactor: ((input: Record<string, unknown>) => unknown) | null;

  constructor(config: MaskingConfig, fpeKey?: string) {
    this.enabled = config.enabled;
    this.maskTransformer = new MaskTransformer();
    this.dropTransformer = new DropTransformer();
    this.fpeTransformer = fpeKey ? new FpeTransformer(fpeKey) : null;

    if (config.detectors.cpf) this.detectors.push(cpfDetector());
    if (config.detectors.cnpj) this.detectors.push(cnpjDetector());
    if (config.detectors.rg) this.detectors.push(rgDetector());
    if (config.detectors.pis) this.detectors.push(pisDetector());
    if (config.detectors.pix) this.detectors.push(pixDetector());
    if (config.detectors.email) this.detectors.push(emailDetector());
    if (config.detectors.phone) this.detectors.push(phoneBrDetector());
    if (config.detectors.creditCard) this.detectors.push(creditCardDetector());
    if (config.detectors.bearer) this.detectors.push(bearerDetector());
    if (config.detectors.jwt) this.detectors.push(jwtDetector());
    if (config.detectors.awsKeys) {
      this.detectors.push(awsAccessKeyDetector());
      this.detectors.push(awsSecretKeyDetector());
    }
    if (config.detectors.gcpKeys) this.detectors.push(gcpKeyDetector());
    if (config.detectors.pem) this.detectors.push(pemBlockDetector());
    if (config.detectors.iban) this.detectors.push(ibanDetector());
    if (config.detectors.ipv4) this.detectors.push(ipv4Detector());
    if (config.detectors.ipv6) this.detectors.push(ipv6Detector());

    for (const p of config.patterns) {
      this.detectors.push(new RegexDetector(p.name, p.classification, new RegExp(p.regex, 'g')));
    }

    this.structuredRedactor = config.redactPaths.length > 0
      ? (fastRedact({
        paths: config.redactPaths,
        censor: '[REDACTED]',
        serialize: false,
      }) as unknown as (input: Record<string, unknown>) => unknown)
      : null;
  }

  mask(data: unknown, ctx: MaskContext = {}): MaskResult {
    if (!this.enabled) {
      return { masked: data, detections: [], maskedFieldCount: 0 };
    }

    const detectionCounts = new Map<string, number>();
    let maskedFieldCount = 0;
    const columnActionCache = this.indexColumnRules(ctx.columnRules ?? []);

    const process = (value: unknown, path: string[]): unknown => {
      if (value === null || value === undefined) return value;

      if (typeof value === 'string') {
        const columnAction = this.resolveColumnAction(path, columnActionCache);
        if (columnAction === 'drop') {
          maskedFieldCount++;
          return '';
        }
        if (columnAction === 'pass') return value;

        const masked = this.applyDetectors(value, columnAction, detectionCounts);
        if (masked !== value) maskedFieldCount++;
        return masked;
      }

      if (Array.isArray(value)) {
        return value.map((v, i) => process(v, [...path, String(i)]));
      }

      if (typeof value === 'object') {
        const out: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(value)) {
          out[k] = process(v, [...path, k]);
        }
        return out;
      }

      return value;
    };

    let result = process(data, []);

    if (this.structuredRedactor && result && typeof result === 'object' && !Array.isArray(result)) {
      const redacted = this.structuredRedactor(result as Record<string, unknown>);
      if (typeof redacted === 'string') {
        try {
          result = JSON.parse(redacted);
        } catch {
          /* keep result */
        }
      } else {
        result = redacted;
      }
    }

    return {
      masked: result,
      detections: Array.from(detectionCounts.entries()).map(([detector, count]) => ({ detector, count })),
      maskedFieldCount,
    };
  }

  private applyDetectors(
    input: string,
    action: TransformAction,
    counts: Map<string, number>,
  ): string {
    if (action === 'pass') return input;

    const allDetections: Detection[] = [];
    for (const d of this.detectors) {
      const ds = d.detect(input);
      if (ds.length > 0) {
        counts.set(d.name, (counts.get(d.name) ?? 0) + ds.length);
        allDetections.push(...ds);
      }
    }

    if (allDetections.length === 0) return input;

    allDetections.sort((a, b) => a.start - b.start);
    const deduped: Detection[] = [];
    let lastEnd = -1;
    for (const det of allDetections) {
      if (det.start >= lastEnd) {
        deduped.push(det);
        lastEnd = det.end;
      }
    }

    let out = '';
    let cursor = 0;
    for (const det of deduped) {
      out += input.slice(cursor, det.start);
      out += this.runTransform(action, det, input);
      cursor = det.end;
    }
    out += input.slice(cursor);
    return out;
  }

  private runTransform(action: TransformAction, det: Detection, original: string): string {
    switch (action) {
      case 'drop':
        return this.dropTransformer.apply(det, original);
      case 'fpe':
        if (this.fpeTransformer) return this.fpeTransformer.apply(det, original);
        return this.maskTransformer.apply(det, original);
      case 'mask':
      default:
        return this.maskTransformer.apply(det, original);
    }
  }

  private indexColumnRules(rules: ColumnRule[]): Map<string, TransformAction> {
    const out = new Map<string, TransformAction>();
    for (const r of rules) {
      out.set(`${r.table}.${r.column}`, r.action);
      out.set(`*.${r.column}`, r.action);
    }
    return out;
  }

  private resolveColumnAction(path: string[], index: Map<string, TransformAction>): TransformAction {
    if (path.length === 0) return 'mask';
    const last = path[path.length - 1]!;
    const table = path.length >= 2 ? path[path.length - 2]! : '*';
    return index.get(`${table}.${last}`) ?? index.get(`*.${last}`) ?? 'mask';
  }
}
