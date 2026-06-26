import type { Detection, Transformer } from '../detector.port.js';

export class DropTransformer implements Transformer {
  apply(_detection: Detection, _original: string): string {
    return '';
  }
}
