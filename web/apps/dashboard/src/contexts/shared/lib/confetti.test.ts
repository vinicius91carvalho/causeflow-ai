import { beforeEach, describe, expect, it, vi } from 'vitest';

const confettiSpy = vi.fn();

vi.mock('canvas-confetti', () => ({
  default: (...args: unknown[]) => confettiSpy(...args),
}));

import { analysisCompleteConfetti, planSelectConfetti, signUpConfetti } from './confetti';

describe('confetti', () => {
  beforeEach(() => {
    confettiSpy.mockClear();
  });

  describe('signUpConfetti (end-of-tutorial)', () => {
    it('fires two side cannons (left + right)', () => {
      signUpConfetti();
      expect(confettiSpy).toHaveBeenCalledTimes(2);
    });

    it('uses only the brand colors #10D9A3 and #A855F7', () => {
      signUpConfetti();
      for (const call of confettiSpy.mock.calls) {
        const opts = call[0] as { colors: string[] };
        expect(opts.colors).toEqual(['#10D9A3', '#A855F7']);
      }
    });

    it('uses no star shapes', () => {
      signUpConfetti();
      for (const call of confettiSpy.mock.calls) {
        const opts = call[0] as { shapes: string[] };
        expect(opts.shapes).not.toContain('star');
      }
    });

    it('left cannon fires from x=0 angled up-right', () => {
      signUpConfetti();
      const left = confettiSpy.mock.calls[0]?.[0] as {
        origin: { x: number };
        angle: number;
      };
      expect(left.origin.x).toBe(0);
      expect(left.angle).toBe(60);
    });

    it('right cannon fires from x=1 angled up-left', () => {
      signUpConfetti();
      const right = confettiSpy.mock.calls[1]?.[0] as {
        origin: { x: number };
        angle: number;
      };
      expect(right.origin.x).toBe(1);
      expect(right.angle).toBe(120);
    });
  });

  describe('planSelectConfetti', () => {
    it('fires once', () => {
      planSelectConfetti();
      expect(confettiSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('analysisCompleteConfetti', () => {
    it('fires once', () => {
      analysisCompleteConfetti();
      expect(confettiSpy).toHaveBeenCalledTimes(1);
    });
  });
});
