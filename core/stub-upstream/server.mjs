#!/usr/bin/env node
/**
 * Backward-compatible entrypoint — delegates to causeflow-test-app (AC-058).
 * AC-056 harness scripts still invoke `node stub-upstream/server.mjs`.
 */
import { startTestApp } from '../test-app/server.mjs';

startTestApp();
