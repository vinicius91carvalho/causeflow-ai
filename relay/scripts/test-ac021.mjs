// AC-021 Integrated Verification
// Execute request with resourceId='order-pg', operation='query', params.sql='SELECT id, status FROM orders'
// must return JSON-RPC 2.0 response with result shape { rows, rowCount, fields, executionTimeMs, masked, maskedFieldCount }.
// Also verifies PII masking: data containing CPF/email/credit card triggers masked=true, maskedFieldCount>0.
import { WebSocket } from 'ws';

const STUB_URL = 'ws://localhost:5191/v1/relay/connect?token=harness-smoke-token&tenantId=harness-tenant';

let nextId = 1;
function rpcRequest(method, params) {
  return JSON.stringify({ jsonrpc: '2.0', id: nextId++, method, params });
}

function connectAndTest() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(STUB_URL);
    const results = [];
    let timeout;

    ws.on('open', () => {
      console.log('[test] connected to control-plane-stub');

      // ---- Test 1: Basic execute with SELECT id, status FROM orders ----
      console.log('[test] Sending execute request: SELECT id, status FROM orders');
      ws.send(rpcRequest('execute', {
        resourceId: 'order-pg',
        operation: 'query',
        params: { sql: 'SELECT id, status FROM orders' },
      }));

      // ---- Test 2: Execute with PII data ----
      // Insert a row with CPF and email to verify masking triggers
      console.log('[test] Sending execute with PII-containing data');
      // First we need some PII in the DB. We'll use INSERT via a separate request
      // Actually, the relay is R/O, so we'll add test data directly.
    });

    ws.on('message', (raw) => {
      const msg = JSON.parse(raw.toString());
      console.log('[test] Response:', JSON.stringify(msg, null, 2));

      if (msg.jsonrpc === '2.0' && msg.id !== undefined) {
        results.push(msg);
      }

      // After first response, send the PII test request
      if (results.length === 1 && !msg.error) {
        // The first response is the basic query — now test PII masking
        // We'll send a query that includes PII in the result
        ws.send(rpcRequest('execute', {
          resourceId: 'order-pg',
          operation: 'query',
          params: { sql: "SELECT 1 as id, 'paid' as status, '123.456.789-00' as cpf, 'user@example.com' as email, '4111-1111-1111-1111' as card" },
        }));
      }

      // After second response, add more PII tests
      if (results.length === 2 && !msg.error) {
        // Non-PII data (should be masked: false)
        ws.send(rpcRequest('execute', {
          resourceId: 'order-pg',
          operation: 'query',
          params: { sql: "SELECT 1 as id, 'test' as label" },
        }));
      }

      // After third response, test with mixed PII/non-PII
      if (results.length === 3 && !msg.error) {
        ws.send(rpcRequest('execute', {
          resourceId: 'order-pg',
          operation: 'query',
          params: { sql: "SELECT 1 as id, 'hello world' as note, '123.456.789-00' as cpf" },
        }));
      }

      // After fourth response, check audit log shape for denied request
      if (results.length === 4 && !msg.error) {
        // Ask for unknown resource to see denied audit
        ws.send(rpcRequest('execute', {
          resourceId: 'nonexistent',
          operation: 'query',
          params: { sql: 'SELECT 1' },
        }));
      }

      // After all responses (or any error), close
      if (results.length >= 5 || msg.error) {
        clearTimeout(timeout);
        ws.close();
        resolve(results);
      }
    });

    ws.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });

    timeout = setTimeout(() => {
      ws.close();
      resolve(results); // resolve with whatever we have
    }, 15000);
  });
}

async function main() {
  console.log('=== AC-021 Integrated Verification ===\n');

  let results;
  try {
    results = await connectAndTest();
  } catch (err) {
    console.error('Connection failed:', err.message);
    process.exit(1);
  }

  console.log(`\n=== Received ${results.length} responses ===\n`);

  const checks = {};
  let allPass = true;

  // ---- Response 1: Basic SELECT id, status FROM orders ----
  const r1 = results.find(r => r.id === 1);
  if (r1) {
    // Check JSON-RPC 2.0
    checks['jsonrpc_20'] = r1.jsonrpc === '2.0';
    if (!checks['jsonrpc_20']) { allPass = false; console.error('FAIL: jsonrpc is not 2.0'); }
    else console.log('PASS: jsonrpc is 2.0');

    checks['id_echoed'] = r1.id === 1;
    if (!checks['id_echoed']) { allPass = false; console.error('FAIL: id not echoed'); }
    else console.log('PASS: id echoed');

    // Check result shape
    const res = r1.result;
    checks['result_exists'] = res !== undefined;
    if (!checks['result_exists']) { allPass = false; console.error('FAIL: no result'); }
    else console.log('PASS: result exists');

    if (res) {
      checks['rows_array'] = Array.isArray(res.rows);
      if (!checks['rows_array']) { allPass = false; console.error('FAIL: rows is not array'); }
      else console.log('PASS: rows is array, length=' + res.rows.length);

      checks['rowCount_integer'] = Number.isInteger(res.rowCount);
      if (!checks['rowCount_integer']) { allPass = false; console.error('FAIL: rowCount not integer'); }
      else console.log('PASS: rowCount=' + res.rowCount);

      checks['rowCount_matches'] = res.rowCount === res.rows.length;
      if (!checks['rowCount_matches']) { allPass = false; console.error('FAIL: rowCount mismatch rows.length'); }
      else console.log('PASS: rowCount matches rows.length');

      checks['fields_array'] = Array.isArray(res.fields);
      if (!checks['fields_array']) { allPass = false; console.error('FAIL: fields not array'); }
      else console.log('PASS: fields is array, length=' + res.fields.length);

      checks['fields_have_name_type'] = res.fields.every(f => typeof f.name === 'string' && typeof f.type === 'string');
      if (!checks['fields_have_name_type']) { allPass = false; console.error('FAIL: fields missing name/type'); }
      else console.log('PASS: fields all have name and type');

      checks['executionTimeMs_present'] = typeof res.executionTimeMs === 'number';
      if (!checks['executionTimeMs_present']) { allPass = false; console.error('FAIL: executionTimeMs missing'); }
      else console.log('PASS: executionTimeMs=' + res.executionTimeMs);

      checks['executionTimeMs_positive'] = res.executionTimeMs >= 0;
      if (!checks['executionTimeMs_positive']) { allPass = false; console.error('FAIL: executionTimeMs not >= 0'); }
      else console.log('PASS: executionTimeMs >= 0');

      checks['masked_boolean'] = typeof res.masked === 'boolean';
      if (!checks['masked_boolean']) { allPass = false; console.error('FAIL: masked not boolean'); }
      else console.log('PASS: masked=' + res.masked);

      checks['maskedFieldCount_integer'] = Number.isInteger(res.maskedFieldCount);
      if (!checks['maskedFieldCount_integer']) { allPass = false; console.error('FAIL: maskedFieldCount not integer'); }
      else console.log('PASS: maskedFieldCount=' + res.maskedFieldCount);

      checks['masked_equals_condition'] = res.masked === (res.maskedFieldCount > 0);
      if (!checks['masked_equals_condition']) { allPass = false; console.error('FAIL: masked != (maskedFieldCount > 0)'); }
      else console.log('PASS: masked matches maskedFieldCount>0');
    }
  } else {
    console.error('FAIL: No response for request id=1 (basic execute)');
    allPass = false;
  }

  // ---- Response 2: Execute with PII data ----
  const r2 = results.find(r => r.id === 2);
  if (r2 && !r2.error) {
    const res = r2.result;
    checks['pii_masking_cpf'] = res.masked === true && res.maskedFieldCount > 0;
    if (!checks['pii_masking_cpf']) { allPass = false; console.error('FAIL: PII data should have masked=true'); }
    else console.log('PASS: PII query returns masked=true');

    // Verify the CPF was actually masked
    const cpfRow = res.rows.find(r => r.cpf !== undefined);
    if (cpfRow) {
      checks['cpf_masked_value'] = cpfRow.cpf === '***.***.***-**';
      if (!checks['cpf_masked_value']) { allPass = false; console.error(`FAIL: CPF not masked: ${cpfRow.cpf}`); }
      else console.log('PASS: CPF masked to ***.***.***-**');
    }

    const emailRow = res.rows.find(r => r.email !== undefined);
    if (emailRow) {
      checks['email_masked_value'] = emailRow.email === '***@***.***';
      if (!checks['email_masked_value']) { allPass = false; console.error(`FAIL: Email not masked: ${emailRow.email}`); }
      else console.log('PASS: Email masked to ***@***.***');
    }

    const cardRow = res.rows.find(r => r.card !== undefined);
    if (cardRow) {
      checks['card_masked_value'] = cardRow.card === '****-****-****-****';
      if (!checks['card_masked_value']) { allPass = false; console.error(`FAIL: Card not masked: ${cardRow.card}`); }
      else console.log('PASS: Credit card masked to ****-****-****-****');
    }
  } else if (r2 && r2.error) {
    checks['pii_masking_error'] = false;
    console.error(`FAIL: PII query returned error: ${r2.error.message}`);
    allPass = false;
  }

  // ---- Response 3: Non-PII data (should have masked=false) ----
  const r3 = results.find(r => r.id === 3);
  if (r3 && !r3.error) {
    const res = r3.result;
    checks['non_pii_masked_false'] = res.masked === false && res.maskedFieldCount === 0;
    if (!checks['non_pii_masked_false']) { allPass = false; console.error(`FAIL: non-PII should have masked=false, got masked=${res.masked}, maskedFieldCount=${res.maskedFieldCount}`); }
    else console.log('PASS: non-PII query returns masked=false, maskedFieldCount=0');
  }

  // ---- Response 4: Mixed data ----
  const r4 = results.find(r => r.id === 4);
  if (r4 && !r4.error) {
    const res = r4.result;
    checks['mixed_masking'] = res.masked === true && res.maskedFieldCount > 0;
    if (!checks['mixed_masking']) { allPass = false; console.error(`FAIL: mixed data should have masked=true, got masked=${res.masked}`); }
    else console.log(`PASS: mixed data returns masked=true, maskedFieldCount=${res.maskedFieldCount}`);

    // Check non-PII field is unchanged
    const noteRow = res.rows.find(r => r.note !== undefined);
    if (noteRow) {
      checks['non_pii_unchanged'] = noteRow.note === 'hello world';
      if (!checks['non_pii_unchanged']) { allPass = false; console.error(`FAIL: non-PII note changed: ${noteRow.note}`); }
      else console.log('PASS: non-PII field unchanged');
    }
  }

  // ---- Response 5: Unknown resource denied ----
  const r5 = results.find(r => r.id === 5);
  if (r5) {
    checks['denied_error_code'] = r5.error && r5.error.code === -32600;
    if (!checks['denied_error_code']) { allPass = false; console.error(`FAIL: expected -32600 for unknown resource, got: ${JSON.stringify(r5.error)}`); }
    else console.log('PASS: unknown resource returns -32600');
  }

  // ---- Summary ----
  const passCount = Object.values(checks).filter(Boolean).length;
  const failCount = Object.values(checks).filter(v => v === false).length;
  console.log(`\n=== Results: ${passCount} passed, ${failCount} failed ===`);
  console.log('All pass:', allPass);

  return { allPass, checks, results };
}

main().then(({ allPass, checks }) => {
  const verdict = allPass ? 'PASS' : 'FAIL';
  console.log(`\n=== VERDICT: ${verdict} ===`);
  process.exit(allPass ? 0 : 1);
}).catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
