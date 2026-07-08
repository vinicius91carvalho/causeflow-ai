// AC-042 QA Test: User-defined patterns from masking.patterns
// Tests that a user-defined session_id pattern is applied on top of defaults,
// masks sess_<16hex> to sess_***, and increments maskedFieldCount.

import { MaskingEngine } from '../../dist/masking/masking-engine.js';

let failures = [];
let allPass = true;

// ---- Test 1: User-defined session_id pattern on raw string ----
console.log('=== Test 1: User-defined session_id pattern on raw string ===');
const engine1 = new MaskingEngine({
  enabled: true,
  patterns: [
    { name: 'session_id', regex: 'sess_[a-f0-9]{16}', replacement: 'sess_***' },
  ],
});
const result1 = engine1.mask('sess_0123456789abcdef');
const expected1 = 'sess_***';
if (result1.masked !== expected1) {
  allPass = false;
  failures.push(`Test 1 masked: expected "${expected1}", got "${result1.masked}"`);
}
if (result1.maskedFieldCount !== 1) {
  allPass = false;
  failures.push(`Test 1 maskedFieldCount: expected 1, got ${result1.maskedFieldCount}`);
}
console.log('  Input:', 'sess_0123456789abcdef');
console.log('  Output:', result1.masked);
console.log('  maskedFieldCount:', result1.maskedFieldCount);

// ---- Test 2: User-defined pattern inside an object (like a DB row) ----
console.log('\n=== Test 2: session_id pattern inside a row object ===');
const engine2 = new MaskingEngine({
  enabled: true,
  patterns: [
    { name: 'session_id', regex: 'sess_[a-f0-9]{16}', replacement: 'sess_***' },
  ],
});
const input2 = {
  id: 1,
  session_id: 'sess_0123456789abcdef',
  email: 'user@example.com',
  name: 'Alice',
};
const result2 = engine2.mask(input2);
const masked2 = result2.masked;

if (masked2.session_id !== 'sess_***') {
  allPass = false;
  failures.push(`Test 2 session_id: expected "sess_***", got "${masked2.session_id}"`);
}
if (masked2.email !== '***@***.***') {
  allPass = false;
  failures.push(`Test 2 email: expected "***@***.***", got "${masked2.email}"`);
}
if (masked2.name !== 'Alice') {
  allPass = false;
  failures.push(`Test 2 name: expected "Alice", got "${masked2.name}"`);
}
if (masked2.id !== 1) {
  allPass = false;
  failures.push(`Test 2 id: expected 1, got ${masked2.id}`);
}
// session_id + email = 2 masked fields
if (result2.maskedFieldCount !== 2) {
  allPass = false;
  failures.push(`Test 2 maskedFieldCount: expected 2, got ${result2.maskedFieldCount}`);
}
console.log('  Input:', JSON.stringify(input2));
console.log('  Output:', JSON.stringify(masked2));
console.log('  maskedFieldCount:', result2.maskedFieldCount);

// ---- Test 3: User-defined pattern does not match partial session_id ----
console.log('\n=== Test 3: Non-matching string should not be masked ===');
const engine3 = new MaskingEngine({
  enabled: true,
  patterns: [
    { name: 'session_id', regex: 'sess_[a-f0-9]{16}', replacement: 'sess_***' },
  ],
});
const result3 = engine3.mask('sess_short');
if (result3.masked !== 'sess_short') {
  allPass = false;
  failures.push(`Test 3 masked: expected "sess_short", got "${result3.masked}"`);
}
if (result3.maskedFieldCount !== 0) {
  allPass = false;
  failures.push(`Test 3 maskedFieldCount: expected 0, got ${result3.maskedFieldCount}`);
}
console.log('  Input:', 'sess_short');
console.log('  Output:', result3.masked);
console.log('  maskedFieldCount:', result3.maskedFieldCount);

// ---- Test 4: User-defined pattern with no defaults interference ----
// Regression: verify the phone_br default pattern does NOT interfere
// with a session_id that looks like digits
console.log('\n=== Test 4: Default phone_br pattern should not corrupt session_id ===');
const engine4 = new MaskingEngine({
  enabled: true,
  patterns: [
    { name: 'session_id', regex: 'sess_[a-f0-9]{16}', replacement: 'sess_***' },
  ],
});
// This session_id has 16 hex digits: 0123456789abcdef
const input4 = 'session: sess_0123456789abcdef';
const result4 = engine4.mask(input4);
// The user-defined pattern should match first and replace the whole thing
// The phone_br default could match '123456789' within '0123456789abcdef' if applied before
// But since user-defined runs first, the session_id gets masked first
// After masking, the result should be 'session: sess_***'
if (result4.masked !== 'session: sess_***') {
  allPass = false;
  failures.push(`Test 4 masked: expected "session: sess_***", got "${result4.masked}"`);
}
if (result4.maskedFieldCount !== 1) {
  allPass = false;
  failures.push(`Test 4 maskedFieldCount: expected 1, got ${result4.maskedFieldCount}`);
}
console.log('  Input:', input4);
console.log('  Output:', result4.masked);
console.log('  maskedFieldCount:', result4.maskedFieldCount);

// ---- Test 5: Multiple user-defined patterns ----
console.log('\n=== Test 5: Multiple user-defined patterns ===');
const engine5 = new MaskingEngine({
  enabled: true,
  patterns: [
    { name: 'session_id', regex: 'sess_[a-f0-9]{16}', replacement: 'sess_***' },
    { name: 'api_key', regex: 'sk-[a-zA-Z0-9]{24}', replacement: 'sk-***' },
  ],
});
const input5 = 'session: sess_aabbccddee001122, key: sk-abcdefghijklmnopqrstuvwx';
const result5 = engine5.mask(input5);
// Both patterns should match
const hasSessionMasked = result5.masked.includes('sess_***');
const hasApiKeyMasked = result5.masked.includes('sk-***');
if (!hasSessionMasked) {
  allPass = false;
  failures.push('Test 5: session_id not masked');
}
if (!hasApiKeyMasked) {
  allPass = false;
  failures.push('Test 5: api_key not masked');
}
if (result5.maskedFieldCount !== 1) {
  // Both patterns match on the SAME string, so maskedFieldCount should be 1
  // (it counts per-string, not per-pattern)
  allPass = false;
  failures.push(`Test 5 maskedFieldCount: expected 1, got ${result5.maskedFieldCount}`);
}
console.log('  Input:', input5);
console.log('  Output:', result5.masked);
console.log('  maskedFieldCount:', result5.maskedFieldCount);

// ---- Test 6: Regression — AC-040 still passes ----
console.log('\n=== Test 6: Regression — AC-040 (default patterns) ===');
const engine6 = new MaskingEngine({
  enabled: true,
  patterns: [], // Just defaults
});
const result6 = engine6.mask(['john@example.com', '123.456.789-00', 'plain']);
if (result6.masked[0] !== '***@***.***') {
  allPass = false;
  failures.push(`Test 6 email: expected "***@***.***", got "${result6.masked[0]}"`);
}
if (result6.masked[1] !== '***.***.***-**') {
  allPass = false;
  failures.push(`Test 6 cpf: expected "***.***.***-**", got "${result6.masked[1]}"`);
}
if (result6.masked[2] !== 'plain') {
  allPass = false;
  failures.push(`Test 6 plain: expected "plain", got "${result6.masked[2]}"`);
}
if (result6.maskedFieldCount !== 2) {
  allPass = false;
  failures.push(`Test 6 maskedFieldCount: expected 2, got ${result6.maskedFieldCount}`);
}
console.log('  Input:', JSON.stringify(['john@example.com', '123.456.789-00', 'plain']));
console.log('  Output:', JSON.stringify(result6.masked));
console.log('  maskedFieldCount:', result6.maskedFieldCount);

// ---- Test 7: Regression — AC-041 (nested object masking) ----
console.log('\n=== Test 7: Regression — AC-041 (nested object masking) ===');
const engine7 = new MaskingEngine({
  enabled: true,
  patterns: [],
});
const input7 = { user: { email: 'a@b.co', notes: 'hello' } };
const result7 = engine7.mask(input7);
if (result7.masked.user.email !== '***@***.***') {
  allPass = false;
  failures.push(`Test 7 email: expected "***@***.***", got "${result7.masked.user.email}"`);
}
if (result7.masked.user.notes !== 'hello') {
  allPass = false;
  failures.push(`Test 7 notes: expected "hello", got "${result7.masked.user.notes}"`);
}
if (result7.maskedFieldCount !== 1) {
  allPass = false;
  failures.push(`Test 7 maskedFieldCount: expected 1, got ${result7.maskedFieldCount}`);
}
console.log('  Input:', JSON.stringify(input7));
console.log('  Output:', JSON.stringify(result7.masked));
console.log('  maskedFieldCount:', result7.maskedFieldCount);

// ---- Summary ----
console.log('\n========================================');
if (allPass) {
  console.log('PASS: AC-042 — All 7 tests pass');
  process.exit(0);
} else {
  console.error('FAILURES:');
  failures.forEach((f) => console.error('  -', f));
  process.exit(1);
}
