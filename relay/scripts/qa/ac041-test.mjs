// AC-041 QA Test: MaskingEngine.mask() recursive object walking
// Tests that objects with nested objects and arrays are correctly masked

import { MaskingEngine } from '../../dist/masking/masking-engine.js';

const engine = new MaskingEngine({
  enabled: true,
  patterns: [],
});

// ---- Test 1: Nested object with email and plain text ----
const input1 = { user: { email: 'a@b.co', notes: 'hello' } };
const result1 = engine.mask(input1);
const masked1 = result1.masked;
let failures = [];
let allPass = true;

if (masked1.user.email !== '***@***.***') {
  allPass = false;
  failures.push(`Test 1 email: expected "***@***.***", got "${masked1.user.email}"`);
}
if (masked1.user.notes !== 'hello') {
  allPass = false;
  failures.push(`Test 1 notes: expected "hello", got "${masked1.user.notes}"`);
}
if (result1.maskedFieldCount !== 1) {
  allPass = false;
  failures.push(`Test 1 maskedFieldCount: expected 1, got ${result1.maskedFieldCount}`);
}

console.log('Test 1 - Nested object with email and notes');
console.log('  Input:', JSON.stringify(input1));
console.log('  Output:', JSON.stringify(masked1));
console.log('  Masked field count:', result1.maskedFieldCount);

// ---- Test 2: Array nested inside an object ----
const input2 = { users: ['alice@example.com', 'bob@test.org', 'plain'], meta: { seen: false } };
const result2 = engine.mask(input2);
const masked2 = result2.masked;

if (masked2.users[0] !== '***@***.***') {
  allPass = false;
  failures.push(`Test 2 users[0]: expected "***@***.***", got "${masked2.users[0]}"`);
}
if (masked2.users[1] !== '***@***.***') {
  allPass = false;
  failures.push(`Test 2 users[1]: expected "***@***.***", got "${masked2.users[1]}"`);
}
if (masked2.users[2] !== 'plain') {
  allPass = false;
  failures.push(`Test 2 users[2]: expected "plain", got "${masked2.users[2]}"`);
}
if (masked2.meta.seen !== false) {
  allPass = false;
  failures.push(`Test 2 meta.seen: expected false, got ${masked2.meta.seen}`);
}
// email pattern: alice@example.com and bob@test.org => 2 masked fields inside array
// ... but maskedFieldCount counts each string that was masked, not each field path
if (result2.maskedFieldCount !== 2) {
  allPass = false;
  failures.push(`Test 2 maskedFieldCount: expected 2, got ${result2.maskedFieldCount}`);
}

console.log('Test 2 - Array nested inside object');
console.log('  Input:', JSON.stringify(input2));
console.log('  Output:', JSON.stringify(masked2));
console.log('  Masked field count:', result2.maskedFieldCount);

// ---- Test 3: Deeply nested with mixed types ----
const input3 = {
  profile: {
    email: 'test@deep.co',
    metadata: [{ key: 'token', value: 'sk-abc123' }],
    tags: ['a', 'b']
  },
  count: 42
};
const result3 = engine.mask(input3);
const masked3 = result3.masked;
// email should be masked
if (masked3.profile.email !== '***@***.***') {
  allPass = false;
  failures.push(`Test 3 profile.email: expected "***@***.***", got "${masked3.profile.email}"`);
}
// the 'sk-abc123' matches bearer_token pattern? Let's check: Bearer\s+... so no spaces = no match
// deep nested array elements preserved
if (masked3.profile.metadata[0].key !== 'token') {
  allPass = false;
  failures.push(`Test 3 metadata[0].key: expected "token", got "${masked3.profile.metadata[0].key}"`);
}
if (masked3.profile.tags.length !== 2) {
  allPass = false;
  failures.push(`Test 3 tags.length: expected 2, got ${masked3.profile.tags.length}`);
}
// email matched => 1 masked field (sk-abc123 does NOT match bearer_token because missing "Bearer ")
if (result3.maskedFieldCount !== 1) {
  allPass = false;
  failures.push(`Test 3 maskedFieldCount: expected 1, got ${result3.maskedFieldCount}`);
}

console.log('Test 3 - Deeply nested with mixed types');
console.log('  Input:', JSON.stringify(input3));
console.log('  Output:', JSON.stringify(masked3));
console.log('  Masked field count:', result3.maskedFieldCount);

if (!allPass) {
  console.error('FAILURES:', failures.join('; '));
  process.exit(1);
}

console.log('\nPASS: AC-041');
process.exit(0);
