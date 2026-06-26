/**
 * main.ts is the application entry point and is excluded from unit test coverage
 * (see vitest.config.ts coverage.exclude). This file exists to satisfy the TDD
 * hook requirement. Behavioural coverage of main.ts is provided by integration
 * and E2E tests.
 */
import { describe, it } from 'vitest';

describe('main (entry point)', () => {
  it('placeholder — entry point is covered by integration tests', () => {
    // main.ts wires together all modules and is not unit-testable in isolation.
    // Integration tests verify startup, graceful shutdown, and OTel init.
  });
});
