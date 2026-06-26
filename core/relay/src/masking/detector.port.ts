export type Classification = 'pii' | 'phi' | 'pci' | 'secret' | 'business';

export interface Detection {
  start: number;
  end: number;
  match: string;
  detector: string;
  classification: Classification;
}

export interface IDetector {
  readonly name: string;
  readonly classification: Classification;
  detect(input: string): Detection[];
}

export type TransformAction = 'mask' | 'drop' | 'fpe' | 'pass';

export interface Transformer {
  apply(detection: Detection, original: string): string;
}
