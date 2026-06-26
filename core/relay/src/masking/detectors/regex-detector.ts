import type { IDetector, Detection, Classification } from '../detector.port.js';

export class RegexDetector implements IDetector {
  constructor(
    public readonly name: string,
    public readonly classification: Classification,
    private readonly pattern: RegExp,
    private readonly validator?: (match: string) => boolean,
  ) {}

  detect(input: string): Detection[] {
    const detections: Detection[] = [];
    const re = new RegExp(this.pattern.source, this.pattern.flags.includes('g') ? this.pattern.flags : `${this.pattern.flags}g`);
    let m: RegExpExecArray | null;
    while ((m = re.exec(input)) !== null) {
      if (this.validator && !this.validator(m[0])) continue;
      detections.push({
        start: m.index,
        end: m.index + m[0].length,
        match: m[0],
        detector: this.name,
        classification: this.classification,
      });
      if (m[0].length === 0) re.lastIndex++;
    }
    return detections;
  }
}
