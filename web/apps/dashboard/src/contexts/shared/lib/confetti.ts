import confetti from 'canvas-confetti';

// End-of-tutorial celebration: Two side cannons firing brand colors (no stars).
// Brand colors: CauseFlow light green (#10D9A3) + purple (#A855F7).
export function signUpConfetti() {
  const colors = ['#10D9A3', '#A855F7'];
  const defaults = {
    particleCount: 60,
    spread: 55,
    startVelocity: 55,
    ticks: 200,
    shapes: ['circle', 'square'] as ('circle' | 'square')[],
    colors,
  };
  // Left cannon — fires from bottom-left, angled up-right
  confetti({ ...defaults, angle: 60, origin: { x: 0, y: 0.7 } });
  // Right cannon — fires from bottom-right, angled up-left
  confetti({ ...defaults, angle: 120, origin: { x: 1, y: 0.7 } });
}

// Plan selection: Teal/cyan cascade
export function planSelectConfetti() {
  confetti({
    particleCount: 80,
    angle: 90,
    spread: 120,
    origin: { y: 0 },
    colors: ['#14B8A6', '#06B6D4', '#3B82F6', '#0EA5E9', '#22D3EE'],
    shapes: ['star', 'circle'],
    ticks: 200,
  });
}

// Analysis complete: Green sparkle
export function analysisCompleteConfetti() {
  confetti({
    particleCount: 50,
    spread: 60,
    origin: { y: 0.7 },
    colors: ['#22C55E', '#84CC16', '#10B981'],
    ticks: 100,
  });
}
