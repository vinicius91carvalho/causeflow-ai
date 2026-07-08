// AC-043 QA Test: MaskingEngine with masking.enabled = false
// Tests that MaskingEngine.mask(data) returns { masked: data, maskedFieldCount: 0 }
// without applying any patterns, when masking is disabled.

import { MaskingEngine } from '../../dist/masking/masking-engine.js';

let failures = [];
let allPass = true;

// ---- Test 1: Disabled engine returns original string unchanged ----
console.log('=== Test 1: disabled mask returns original string (with email) ===');
const engine1 = new MaskingEngine({ enabled: false, patterns: [] });
const input1 = 'My email is user@example.com and CPF is 123.456.789-00';
const result1 = engine1.mask(input1);
if (result1.masked !== input1) {
  allPass = false;
  failures.push(`Test 1 masked: expected input string unchanged, got "${result1.masked}"`);
}
if (result1.maskedFieldCount !== 0) {
  allPass = false;
  failures.push(`Test 1 maskedFieldCount: expected 0, got ${result1.maskedFieldCount}`);
}
console.log('  Input:', JSON.stringify(input1));
console.log('  Output:', JSON.stringify(result1.masked));
console.log('  maskedFieldCount:', result1.maskedFieldCount);

// ---- Test 2: Disabled engine returns original array unchanged ----
console.log('\n=== Test 2: disabled mask returns original array ===');
const engine2 = new MaskingEngine({ enabled: false, patterns: [] });
const input2 = ['john@example.com', '123.456.789-00', 'plain'];
const result2 = engine2.mask(input2);
if (JSON.stringify(result2.masked) !== JSON.stringify(input2)) {
  allPass = false;
  failures.push(`Test 2 masked: expected array unchanged, got ${JSON.stringify(result2.masked)}`);
}
if (result2.maskedFieldCount !== 0) {
  allPass = false;
  failures.push(`Test 2 maskedFieldCount: expected 0, got ${result2.maskedFieldCount}`);
}
console.log('  Input:', JSON.stringify(input2));
console.log('  Output:', JSON.stringify(result2.masked));
console.log('  maskedFieldCount:', result2.maskedFieldCount);

// ---- Test 3: Disabled engine returns original nested object unchanged ----
console.log('\n=== Test 3: disabled mask returns original nested object ===');
const engine3 = new MaskingEngine({ enabled: false, patterns: [] });
const input3 = { user: { email: 'a@b.co', phone: '+55 11 91234-5678' } };
const result3 = engine3.mask(input3);
if (JSON.stringify(result3.masked) !== JSON.stringify(input3)) {
  allPass = false;
  failures.push(`Test 3 masked: expected object unchanged, got ${JSON.stringify(result3.masked)}`);
}
if (result3.maskedFieldCount !== 0) {
  allPass = false;
  failures.push(`Test 3 maskedFieldCount: expected 0, got ${result3.maskedFieldCount}`);
}
console.log('  Input:', JSON.stringify(input3));
console.log('  Output:', JSON.stringify(result3.masked));
console.log('  maskedFieldCount:', result3.maskedFieldCount);

// ---- Test 4: Disabled engine with credit card number ----
console.log('\n=== Test 4: disabled mask returns original credit card number ===');
const engine4 = new MaskingEngine({ enabled: false, patterns: [] });
const input4 = 'Card: 4111-1111-1111-1111';
const result4 = engine4.mask(input4);
if (result4.masked !== input4) {
  allPass = false;
  failures.push(`Test 4 masked: expected input unchanged, got "${result4.masked}"`);
}
if (result4.maskedFieldCount !== 0) {
  allPass = false;
  failures.push(`Test 4 maskedFieldCount: expected 0, got ${result4.maskedFieldCount}`);
}
console.log('  Input:', JSON.stringify(input4));
console.log('  Output:', JSON.stringify(result4.masked));
console.log('  maskedFieldCount:', result4.maskedFieldCount);

// ---- Test 5: Disabled engine with Bearer token ----
console.log('\n=== Test 5: disabled mask returns original Bearer token ===');
const engine5 = new MaskingEngine({ enabled: false, patterns: [] });
const input5 = 'Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNqP3E2iq3M8Z4wv1Q';
const result5 = engine5.mask(input5);
if (result5.masked !== input5) {
  allPass = false;
  failures.push(`Test 5 masked: expected input unchanged, got "${result5.masked}"`);
}
if (result5.maskedFieldCount !== 0) {
  allPass = false;
  failures.push(`Test 5 maskedFieldCount: expected 0, got ${result5.maskedFieldCount}`);
}
console.log('  Input:', JSON.stringify(input5.substring(0, 60) + '...'));
console.log('  Output:', JSON.stringify(result5.masked.substring(0, 60) + '...'));
console.log('  maskedFieldCount:', result5.maskedFieldCount);

// ---- Test 6: Disabled engine with BR phone ----
console.log('\n=== Test 6: disabled mask returns original BR phone ===');
const engine6 = new MaskingEngine({ enabled: false, patterns: [] });
const input6 = 'Phone: (11) 91234-5678';
const result6 = engine6.mask(input6);
if (result6.masked !== input6) {
  allPass = false;
  failures.push(`Test 6 masked: expected input unchanged, got "${result6.masked}"`);
}
if (result6.maskedFieldCount !== 0) {
  allPass = false;
  failures.push(`Test 6 maskedFieldCount: expected 0, got ${result6.maskedFieldCount}`);
}
console.log('  Input:', JSON.stringify(input6));
console.log('  Output:', JSON.stringify(result6.masked));
console.log('  maskedFieldCount:', result6.maskedFieldCount);

// ---- Test 7: Disabled engine with user-defined pattern ----
console.log('\n=== Test 7: disabled mask ignores user-defined patterns ===');
const engine7 = new MaskingEngine({
  enabled: false,
  patterns: [
    { name: 'session_id', regex: 'sess_[a-f0-9]{16}', replacement: 'sess_***' },
  ],
});
const input7 = 'session: sess_0123456789abcdef';
const result7 = engine7.mask(input7);
if (result7.masked !== input7) {
  allPass = false;
  failures.push(`Test 7 masked: expected input unchanged, got "${result7.masked}"`);
}
if (result7.maskedFieldCount !== 0) {
  allPass = false;
  failures.push(`Test 7 maskedFieldCount: expected 0, got ${result7.maskedFieldCount}`);
}
console.log('  Input:', JSON.stringify(input7));
console.log('  Output:', JSON.stringify(result7.masked));
console.log('  maskedFieldCount:', result7.maskedFieldCount);

// ---- Test 8: Null/numbers pass through unchanged ----
console.log('\n=== Test 8: disabled mask returns null and numbers unchanged ===');
const engine8 = new MaskingEngine({ enabled: false, patterns: [] });
const result8_null = engine8.mask(null);
if (result8_null.masked !== null) {
  allPass = false;
  failures.push(`Test 8 null: expected null, got ${result8_null.masked}`);
}
if (result8_null.maskedFieldCount !== 0) {
  allPass = false;
  failures.push(`Test 8 null maskedFieldCount: expected 0, got ${result8_null.maskedFieldCount}`);
}
const result8_num = engine8.mask(42);
if (result8_num.masked !== 42) {
  allPass = false;
  failures.push(`Test 8 number: expected 42, got ${result8_num.masked}`);
}
if (result8_num.maskedFieldCount !== 0) {
  allPass = false;
  failures.push(`Test 8 number maskedFieldCount: expected 0, got ${result8_num.maskedFieldCount}`);
}
console.log('  null Input: null, Output:', result8_null.masked, 'maskedFieldCount:', result8_null.maskedFieldCount);
console.log('  number Input: 42, Output:', result8_num.masked, 'maskedFieldCount:', result8_num.maskedFieldCount);

// ---- Test 9: Sanity — enabled engine still masks (regression) ----
console.log('\n=== Test 9: Sanity — enabled engine still masks (regression) ===');
const engine9 = new MaskingEngine({ enabled: true, patterns: [] });
const input9 = 'email user@example.com and CPF 123.456.789-00';
const result9 = engine9.mask(input9);
const expected9 = 'email ***@***.*** and CPF ***.***.***-**';
if (result9.masked !== expected9) {
  allPass = false;
  failures.push(`Test 9 masked: expected "${expected9}", got "${result9.masked}"`);
}
if (result9.maskedFieldCount !== 1) {
  // One string, multiple pattern matches — counts as 1
  allPass = false;
  failures.push(`Test 9 maskedFieldCount: expected 1, got ${result9.maskedFieldCount}`);
}
console.log('  Input:', JSON.stringify(input9));
console.log('  Output:', JSON.stringify(result9.masked));
console.log('  maskedFieldCount:', result9.maskedFieldCount);

// ---- Summary ----
console.log('\n========================================');
if (allPass) {
  console.log('PASS: AC-043 — All 9 tests pass');
  process.exit(0);
} else {
  console.error('FAILURES:');
  failures.forEach((f) => console.error('  -', f));
  process.exit(1);
}
