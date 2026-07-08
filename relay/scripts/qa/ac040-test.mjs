// AC-040 QA Test: MaskingEngine.mask() with default patterns
// Tests that an array of [email, CPF, plain] is correctly masked

import { MaskingEngine } from '../../dist/masking/masking-engine.js';

const engine = new MaskingEngine({
  enabled: true,
  patterns: [],
});

const input = ['john@example.com', '123.456.789-00', 'plain'];
const result = engine.mask(input);

const expectedMasked = ['***@***.***', '***.***.***-**', 'plain'];
const expectedCount = 2;

const masked = result.masked;
let allMatch = true;
const failures = [];

if (masked[0] !== expectedMasked[0]) {
  allMatch = false;
  failures.push(`email: expected "${expectedMasked[0]}", got "${masked[0]}"`);
}
if (masked[1] !== expectedMasked[1]) {
  allMatch = false;
  failures.push(`cpf: expected "${expectedMasked[1]}", got "${masked[1]}"`);
}
if (masked[2] !== expectedMasked[2]) {
  allMatch = false;
  failures.push(`plain: expected "${expectedMasked[2]}", got "${masked[2]}"`);
}
if (result.maskedFieldCount !== expectedCount) {
  allMatch = false;
  failures.push(`maskedFieldCount: expected ${expectedCount}, got ${result.maskedFieldCount}`);
}

console.log('Input:', JSON.stringify(input));
console.log('Output:', JSON.stringify(result.masked));
console.log('Masked field count:', result.maskedFieldCount);
console.log('Expected mask:', JSON.stringify(expectedMasked));
console.log('All match:', allMatch);

if (!allMatch) {
  console.error('FAILURES:', failures.join('; '));
  process.exit(1);
}

console.log('PASS: AC-040');
process.exit(0);
