#!/usr/bin/env node
// AC-032 Boundary Test: Real WebSocket relay connection
// Tests the relay WS endpoint at a real external boundary.
import WebSocket from 'ws';
import { SignJWT } from 'jose';
import { createHash, createHmac } from 'crypto';

const PORT = process.env.PORT || '5185';
const JWT_SECRET = process.env.JWT_SECRET || 'localstack-jwt-secret-dev';
const WS_URL = `ws://localhost:${PORT}/v1/relay/connect`;

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const NC = '\x1b[0m';

let passed = 0;
let failed = 0;

function pass(msg) { console.log(`  ${GREEN}✓${NC} ${msg}`); passed++; }
function fail(msg) { console.log(`  ${RED}✗${NC} ${msg}`); failed++; }
function info(msg) { console.log(`  ${YELLOW}→${NC} ${msg}`); }

async function generateRelayJWT() {
    const secret = new TextEncoder().encode(JWT_SECRET);
    const token = await new SignJWT({
        tenantId: 'test-tenant',
        relayId: 'test-relay-1',
        scope: 'relay',
    })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setIssuer('causeflow-control-plane')
        .setAudience('causeflow-relay')
        .setSubject('relay:test-tenant:test-relay-1')
        .setExpirationTime('24h')
        .sign(secret);
    return token;
}

// ── Test 1: WS connection with valid auth ─────────────────────────────
async function testValidAuth() {
    info('Test 1: WebSocket connection with valid JWT auth');
    const token = await generateRelayJWT();
    
    return new Promise((resolve) => {
        const ws = new WebSocket(WS_URL, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'X-Tenant-Id': 'test-tenant',
                'X-Relay-Id': 'test-relay-1',
            }
        });

        const timeout = setTimeout(() => {
            fail('Connection timeout');
            ws.close();
            resolve(false);
        }, 5000);

        ws.on('open', () => {
            clearTimeout(timeout);
            pass('WebSocket connection established with valid JWT');

            // Test heartbeat message
            ws.send(JSON.stringify({
                type: 'heartbeat',
                relayId: 'test-relay-1',
                tenantId: 'test-tenant',
                timestamp: Date.now(),
            }));
            pass('Heartbeat message sent');

            // Test resource update
            ws.send(JSON.stringify({
                type: 'resource_update',
                relayId: 'test-relay-1',
                tenantId: 'test-tenant',
                resources: [{
                    resourceId: 'test-pg',
                    type: 'postgres',
                    name: 'Test PostgreSQL',
                    database: 'testdb',
                    readOnly: true,
                    capabilities: ['query', 'list_tables', 'describe_table', 'explain']
                }]
            }));
            pass('Resource update sent');

            ws.close();
            resolve(true);
        });

        ws.on('error', (err) => {
            clearTimeout(timeout);
            fail(`Connection error: ${err.message}`);
            resolve(false);
        });

        ws.on('close', (code, reason) => {
            if (reason && reason.length > 0) {
                info(`Connection closed: code=${code} reason=${reason}`);
            }
        });
    });
}

// ── Test 2: Unauthenticated connection ───────────────────────────────
function testNoAuth() {
    info('Test 2: Unauthenticated WebSocket connection (should reject)');
    return new Promise((resolve) => {
        const ws = new WebSocket(WS_URL);

        let closed = false;
        const timeout = setTimeout(() => {
            if (!closed) {
                fail('Unauthenticated connection not rejected within timeout');
                ws.close();
            }
            resolve(false);
        }, 5000);

        ws.on('open', () => {
            clearTimeout(timeout);
            fail('Unauthenticated connection was accepted (should reject)');
            ws.close();
            resolve(false);
        });

        ws.on('close', () => {
            if (!closed) {
                closed = true;
                clearTimeout(timeout);
                pass('Unauthenticated connection correctly rejected');
                resolve(true);
            }
        });

        ws.on('error', () => {
            if (!closed) {
                closed = true;
                clearTimeout(timeout);
                pass('Unauthenticated connection correctly rejected (error event)');
                resolve(true);
            }
        });
    });
}

// ── Test 3: Wrong token ──────────────────────────────────────────────
function testWrongToken() {
    info('Test 3: WebSocket with wrong JWT token (should reject)');
    return new Promise((resolve) => {
        const ws = new WebSocket(WS_URL, {
            headers: {
                'Authorization': 'Bearer invalid-token-that-is-not-valid',
                'X-Tenant-Id': 'test-tenant',
            }
        });

        let closed = false;
        const timeout = setTimeout(() => {
            if (!closed) {
                fail('Wrong token connection not rejected within timeout');
                ws.close();
            }
            resolve(false);
        }, 5000);

        ws.on('open', () => {
            clearTimeout(timeout);
            fail('Wrong token connection was accepted (should reject)');
            ws.close();
            resolve(false);
        });

        ws.on('close', () => {
            if (!closed) {
                closed = true;
                clearTimeout(timeout);
                pass('Wrong token connection correctly rejected');
                resolve(true);
            }
        });

        ws.on('error', () => {
            if (!closed) {
                closed = true;
                clearTimeout(timeout);
                pass('Wrong token connection correctly rejected (error event)');
                resolve(true);
            }
        });
    });
}

// ── Test 4: Tenant mismatch ──────────────────────────────────────────
async function testTenantMismatch() {
    info('Test 4: Tenant mismatch in header vs JWT (should reject)');
    const token = await generateRelayJWT();
    // Token has tenantId=test-tenant, header has different tenant
    return new Promise((resolve) => {
        const ws = new WebSocket(WS_URL, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'X-Tenant-Id': 'different-tenant',
                'X-Relay-Id': 'test-relay-1',
            }
        });

        let closed = false;
        const timeout = setTimeout(() => {
            if (!closed) {
                fail('Tenant mismatch connection not rejected within timeout');
                ws.close();
            }
            resolve(false);
        }, 5000);

        ws.on('open', () => {
            clearTimeout(timeout);
            fail('Tenant mismatch connection was accepted (should reject)');
            ws.close();
            resolve(false);
        });

        ws.on('close', () => {
            if (!closed) {
                closed = true;
                clearTimeout(timeout);
                pass('Tenant mismatch connection correctly rejected');
                resolve(true);
            }
        });

        ws.on('error', () => {
            if (!closed) {
                closed = true;
                clearTimeout(timeout);
                pass('Tenant mismatch connection correctly rejected (error event)');
                resolve(true);
            }
        });
    });
}

// ── Test 5: RPC-style message from control plane to relay ────────────
async function testRpcMessage() {
    info('Test 5: RPC message exchange');
    const token = await generateRelayJWT();
    
    return new Promise((resolve) => {
        const ws = new WebSocket(WS_URL, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'X-Tenant-Id': 'test-tenant',
                'X-Relay-Id': 'test-relay-1',
            }
        });

        const timeout = setTimeout(() => {
            fail('RPC test timeout');
            ws.close();
            resolve(false);
        }, 5000);

        ws.on('open', () => {
            // The relay WS server handles heartbeat/resource_update messages internally
            // and doesn't send back RPC responses to the relay.
            // The RPC requests are FROM the control plane TO the relay.
            // Since we're simulating a relay client, we don't expect RPC requests
            // unless triggered. The important thing is the connection stays open.
            
            // Send heartbeat and verify the relay stays connected
            ws.send(JSON.stringify({
                type: 'heartbeat',
                relayId: 'test-relay-1',
                tenantId: 'test-tenant',
                timestamp: Date.now(),
            }));

            // Listen for incoming messages from the server
            let messageReceived = false;
            ws.on('message', (data) => {
                messageReceived = true;
                try {
                    const msg = JSON.parse(data.toString());
                    info(`Received message from server: ${JSON.stringify(msg).substring(0, 100)}`);
                } catch (e) {
                    info(`Received raw message from server`);
                }
            });

            // Wait a bit and check connection is still alive
            setTimeout(() => {
                clearTimeout(timeout);
                if (ws.readyState === WebSocket.OPEN) {
                    pass('Connection remains open after heartbeat (relay registered)');
                } else {
                    fail('Connection closed unexpectedly');
                }
                ws.close();
                resolve(true);
            }, 1000);
        });

        ws.on('error', (err) => {
            clearTimeout(timeout);
            fail(`RPC test error: ${err.message}`);
            resolve(false);
        });
    });
}

// ── Run all tests ────────────────────────────────────────────────────
async function main() {
    console.log(`\n${YELLOW}═══ AC-032 Relay Boundary Test ═══${NC}`);
    console.log(`API URL: http://localhost:${PORT}`);
    console.log(`WS  URL: ${WS_URL}\n`);

    // Check API health first
    try {
        const res = await fetch(`http://localhost:${PORT}/health`);
        const health = await res.json();
        if (health.status === 'ok') {
            pass(`API is healthy on port ${PORT}`);
        } else {
            fail(`API health check returned: ${JSON.stringify(health)}`);
        }
    } catch (err) {
        fail(`API not reachable on port ${PORT}: ${err.message}`);
        console.log(`\n${RED}Cannot proceed - API is not running.${NC}`);
        process.exit(1);
    }

    // Run relay WS tests
    await testValidAuth();
    await testNoAuth();
    await testWrongToken();
    await testTenantMismatch();
    await testRpcMessage();

    // Summary
    const total = passed + failed;
    console.log(`\n${YELLOW}═══ Results: ${passed}/${total} passed ═══${NC}`);
    if (failed > 0) {
        console.log(`${RED}${failed} test(s) failed${NC}`);
        process.exit(1);
    }
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
